-- Migration: Fix Check Constraint Violation in Batch Save
-- Issue: Unsafe COALESCE pattern returns NULL when JSONB key missing + database has NULL
-- Fix: Use CASE WHEN to check key existence before accessing value
-- Also: Fix audit log old_data corruption (captured AFTER update instead of BEFORE)

-- Part 1: Data Integrity Repair
-- Fix any existing NULL values in CHECK-constrained fields
UPDATE profiles
SET
  status = 'alive',
  version = version + 1
WHERE deleted_at IS NULL
  AND status IS NULL;

-- Part 2: Replace the batch save function with bug fixes
CREATE OR REPLACE FUNCTION admin_quick_add_batch_save(
  p_parent_id uuid,
  p_parent_gender text,
  p_selected_mother_id uuid DEFAULT NULL,
  p_selected_father_id uuid DEFAULT NULL,
  p_children_to_create jsonb DEFAULT '[]'::jsonb,
  p_children_to_update jsonb DEFAULT '[]'::jsonb,
  p_children_to_delete jsonb DEFAULT '[]'::jsonb,
  p_operation_description text DEFAULT 'إضافة سريعة جماعية'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role text;
  v_permission_level text;
  v_parent_record record;
  v_parent_generation integer;
  v_batch_size integer;
  v_operation_group_id uuid;
  v_child jsonb;
  v_child_id uuid;
  v_child_version integer;
  v_new_profile_id uuid;
  v_calculated_generation integer;
  v_old_data jsonb;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_deleted_count integer := 0;
BEGIN
  -- ========================================================================
  -- STEP 1: AUTHENTICATION & AUTHORIZATION
  -- ========================================================================

  -- Get authenticated user's profile ID from JWT
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتنفيذ هذه العملية'
      USING ERRCODE = 'authentication_required',
            HINT = 'auth.uid() returned NULL';
  END IF;

  -- Get actor profile and role
  SELECT role INTO v_actor_role
  FROM profiles
  WHERE auth_user_id = v_actor_id AND deleted_at IS NULL;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف شخصي مرتبط بهذا الحساب'
      USING ERRCODE = 'profile_not_found',
            HINT = 'User authenticated but no profile exists';
  END IF;

  -- ========================================================================
  -- STEP 2: VALIDATION - PARENT, SELECTED PARENTS, BATCH SIZE
  -- ========================================================================

  -- Validate and lock parent profile
  SELECT p.*, p.generation
  INTO v_parent_record
  FROM profiles p
  WHERE p.id = p_parent_id
    AND p.deleted_at IS NULL
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الملف الشخصي للوالد غير موجود أو محذوف'
      USING ERRCODE = 'parent_not_found',
            HINT = 'Parent profile does not exist or is soft-deleted';
  END IF;

  v_parent_generation := v_parent_record.generation;

  -- Validate parent gender matches function parameter
  IF v_parent_record.gender != p_parent_gender THEN
    RAISE EXCEPTION 'الجنس المحدد لا يتطابق مع جنس الملف الشخصي'
      USING ERRCODE = 'gender_mismatch',
            HINT = format('Expected %s, got %s', v_parent_record.gender, p_parent_gender);
  END IF;

  -- Validate selected mother (if provided)
  IF p_selected_mother_id IS NOT NULL THEN
    PERFORM 1 FROM profiles
    WHERE id = p_selected_mother_id
      AND gender = 'female'
      AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأم المختارة غير موجودة أو محذوفة أو ليست أنثى'
        USING ERRCODE = 'invalid_mother',
              HINT = 'Selected mother must exist, not be deleted, and be female';
    END IF;
  END IF;

  -- Validate selected father (if provided)
  IF p_selected_father_id IS NOT NULL THEN
    PERFORM 1 FROM profiles
    WHERE id = p_selected_father_id
      AND gender = 'male'
      AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأب المختار غير موجود أو محذوف أو ليس ذكراً'
        USING ERRCODE = 'invalid_father',
              HINT = 'Selected father must exist, not be deleted, and be male';
    END IF;
  END IF;

  -- Check permission level for parent profile
  SELECT permission_level INTO v_permission_level
  FROM check_family_permission_v4(v_actor_id, p_parent_id);

  -- Reject 'family' permission (suggest-only)
  IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل مباشرة على هذا الملف الشخصي'
      USING ERRCODE = 'permission_denied',
            HINT = format('Permission level: %s (requires inner/admin/moderator)', v_permission_level);
  END IF;

  -- Validate batch size (max 50 operations)
  v_batch_size := jsonb_array_length(p_children_to_create) +
                  jsonb_array_length(p_children_to_update) +
                  jsonb_array_length(p_children_to_delete);

  IF v_batch_size > 50 THEN
    RAISE EXCEPTION 'حجم الدفعة يتجاوز الحد الأقصى المسموح (50 عملية)'
      USING ERRCODE = 'batch_size_exceeded',
            HINT = format('Batch size: %s operations', v_batch_size);
  END IF;

  -- ========================================================================
  -- STEP 3: CREATE OPERATION GROUP FOR BATCH UNDO
  -- ========================================================================

  INSERT INTO operation_groups (description)
  VALUES (p_operation_description)
  RETURNING id INTO v_operation_group_id;

  -- ========================================================================
  -- STEP 4: PROCESS CREATES
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_create)
  LOOP
    -- Calculate generation (parent + 1, don't trust frontend)
    v_calculated_generation := v_parent_generation + 1;

    -- Validate required fields for new profile
    IF v_child->>'name' IS NULL OR trim(v_child->>'name') = '' THEN
      RAISE EXCEPTION 'الاسم مطلوب لجميع الملفات الشخصية الجديدة'
        USING ERRCODE = 'name_required',
              HINT = 'Name cannot be NULL or empty';
    END IF;

    IF v_child->>'gender' IS NULL OR v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'الجنس مطلوب ويجب أن يكون male أو female'
        USING ERRCODE = 'gender_required',
              HINT = format('Got gender: %s', v_child->>'gender');
    END IF;

    -- Insert new profile
    INSERT INTO profiles (
      name,
      gender,
      generation,
      father_id,
      mother_id,
      kunya,
      nickname,
      status,
      sibling_order,
      profile_visibility,
      version
    ) VALUES (
      v_child->>'name',
      v_child->>'gender',
      v_calculated_generation,
      CASE WHEN p_parent_gender = 'male' THEN p_parent_id ELSE p_selected_father_id END,
      CASE WHEN p_parent_gender = 'female' THEN p_parent_id ELSE p_selected_mother_id END,
      v_child->>'kunya',
      v_child->>'nickname',
      COALESCE(v_child->>'status', 'alive'),
      COALESCE((v_child->>'sibling_order')::integer, 0),
      COALESCE(v_child->>'profile_visibility', 'family'),
      1
    )
    RETURNING id INTO v_new_profile_id;

    -- Create audit log entry
    INSERT INTO audit_log_enhanced (
      actor_id,
      profile_id,
      action_type,
      old_data,
      new_data,
      operation_group_id
    )
    SELECT
      v_actor_id,
      v_new_profile_id,
      'profile_create',
      NULL,
      to_jsonb(p.*) - 'version' - 'updated_at',
      v_operation_group_id
    FROM profiles p
    WHERE p.id = v_new_profile_id;

    v_created_count := v_created_count + 1;
  END LOOP;

  -- ========================================================================
  -- STEP 5: PROCESS UPDATES (WITH BUG FIX)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_update)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للتحديثات'
        USING ERRCODE = 'child_id_required',
              HINT = 'Each update must include id field';
    END IF;

    -- Validate permission on child
    SELECT permission_level INTO v_permission_level
    FROM check_family_permission_v4(v_actor_id, v_child_id);

    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية تعديل هذا الملف الشخصي'
        USING ERRCODE = 'permission_denied',
              HINT = format('Child ID: %s, Permission: %s', v_child_id, v_permission_level);
    END IF;

    -- *** BUG FIX: Capture old_data BEFORE update ***
    SELECT to_jsonb(p.*) - 'version' - 'updated_at'
    INTO v_old_data
    FROM profiles p
    WHERE p.id = v_child_id AND p.deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب تحديثه غير موجود أو محذوف'
        USING ERRCODE = 'child_not_found',
              HINT = format('Child ID: %s', v_child_id);
    END IF;

    -- Check optimistic lock version
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
        USING ERRCODE = 'version_conflict',
              HINT = format('Expected version %s, got %s', v_old_data->>'version', v_child_version);
    END IF;

    -- *** BUG FIX: Validate CHECK-constrained fields if present ***
    IF v_child ? 'status' AND v_child->>'status' NOT IN ('alive', 'deceased', 'unknown') THEN
      RAISE EXCEPTION 'قيمة الحالة غير صالحة. يجب أن تكون alive أو deceased أو unknown'
        USING ERRCODE = 'check_violation',
              HINT = format('Got status: %s', v_child->>'status');
    END IF;

    IF v_child ? 'gender' AND v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'قيمة الجنس غير صالحة. يجب أن تكون male أو female'
        USING ERRCODE = 'check_violation',
              HINT = format('Got gender: %s', v_child->>'gender');
    END IF;

    IF v_child ? 'profile_visibility' AND v_child->>'profile_visibility' NOT IN ('public', 'family', 'private') THEN
      RAISE EXCEPTION 'قيمة رؤية الملف الشخصي غير صالحة'
        USING ERRCODE = 'check_violation',
              HINT = format('Got profile_visibility: %s', v_child->>'profile_visibility');
    END IF;

    -- *** BUG FIX: Use CASE WHEN instead of COALESCE ***
    -- Only update fields that are present in JSONB (key exists check)
    UPDATE profiles
    SET
      name = CASE WHEN v_child ? 'name' THEN v_child->>'name' ELSE name END,
      kunya = CASE WHEN v_child ? 'kunya' THEN v_child->>'kunya' ELSE kunya END,
      nickname = CASE WHEN v_child ? 'nickname' THEN v_child->>'nickname' ELSE nickname END,
      status = CASE WHEN v_child ? 'status' THEN v_child->>'status' ELSE status END,
      sibling_order = CASE WHEN v_child ? 'sibling_order' THEN (v_child->>'sibling_order')::integer ELSE sibling_order END,
      father_id = CASE WHEN v_child ? 'father_id' THEN (v_child->>'father_id')::uuid ELSE father_id END,
      mother_id = CASE WHEN v_child ? 'mother_id' THEN (v_child->>'mother_id')::uuid ELSE mother_id END,
      gender = CASE WHEN v_child ? 'gender' THEN v_child->>'gender' ELSE gender END,
      profile_visibility = CASE WHEN v_child ? 'profile_visibility' THEN v_child->>'profile_visibility' ELSE profile_visibility END,
      birth_date_day = CASE WHEN v_child ? 'birth_date_day' THEN (v_child->>'birth_date_day')::integer ELSE birth_date_day END,
      birth_date_month = CASE WHEN v_child ? 'birth_date_month' THEN (v_child->>'birth_date_month')::integer ELSE birth_date_month END,
      birth_date_year = CASE WHEN v_child ? 'birth_date_year' THEN (v_child->>'birth_date_year')::integer ELSE birth_date_year END,
      birth_date_is_hijri = CASE WHEN v_child ? 'birth_date_is_hijri' THEN (v_child->>'birth_date_is_hijri')::boolean ELSE birth_date_is_hijri END,
      birth_date_is_approximate = CASE WHEN v_child ? 'birth_date_is_approximate' THEN (v_child->>'birth_date_is_approximate')::boolean ELSE birth_date_is_approximate END,
      death_date_day = CASE WHEN v_child ? 'death_date_day' THEN (v_child->>'death_date_day')::integer ELSE death_date_day END,
      death_date_month = CASE WHEN v_child ? 'death_date_month' THEN (v_child->>'death_date_month')::integer ELSE death_date_month END,
      death_date_year = CASE WHEN v_child ? 'death_date_year' THEN (v_child->>'death_date_year')::integer ELSE death_date_year END,
      death_date_is_hijri = CASE WHEN v_child ? 'death_date_is_hijri' THEN (v_child->>'death_date_is_hijri')::boolean ELSE death_date_is_hijri END,
      death_date_is_approximate = CASE WHEN v_child ? 'death_date_is_approximate' THEN (v_child->>'death_date_is_approximate')::boolean ELSE death_date_is_approximate END,
      birth_location = CASE WHEN v_child ? 'birth_location' THEN v_child->>'birth_location' ELSE birth_location END,
      current_location = CASE WHEN v_child ? 'current_location' THEN v_child->>'current_location' ELSE current_location END,
      bio_ar = CASE WHEN v_child ? 'bio_ar' THEN v_child->>'bio_ar' ELSE bio_ar END,
      phone_number = CASE WHEN v_child ? 'phone_number' THEN v_child->>'phone_number' ELSE phone_number END,
      email = CASE WHEN v_child ? 'email' THEN v_child->>'email' ELSE email END,
      version = version + 1,
      updated_at = now()
    WHERE id = v_child_id;

    -- Create audit log entry with old_data captured BEFORE update
    INSERT INTO audit_log_enhanced (
      actor_id,
      profile_id,
      action_type,
      old_data,
      new_data,
      operation_group_id
    )
    SELECT
      v_actor_id,
      v_child_id,
      'profile_update',
      v_old_data,  -- *** BUG FIX: Use captured old_data ***
      to_jsonb(p.*) - 'version' - 'updated_at',
      v_operation_group_id
    FROM profiles p
    WHERE p.id = v_child_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- STEP 6: PROCESS DELETES (WITH BUG FIX)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_delete)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للحذف'
        USING ERRCODE = 'child_id_required',
              HINT = 'Each delete must include id field';
    END IF;

    -- Validate permission on child
    SELECT permission_level INTO v_permission_level
    FROM check_family_permission_v4(v_actor_id, v_child_id);

    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية حذف هذا الملف الشخصي'
        USING ERRCODE = 'permission_denied',
              HINT = format('Child ID: %s, Permission: %s', v_child_id, v_permission_level);
    END IF;

    -- *** BUG FIX: Capture old_data BEFORE delete ***
    SELECT to_jsonb(p.*) - 'version' - 'updated_at'
    INTO v_old_data
    FROM profiles p
    WHERE p.id = v_child_id AND p.deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب حذفه غير موجود أو محذوف بالفعل'
        USING ERRCODE = 'child_not_found',
              HINT = format('Child ID: %s', v_child_id);
    END IF;

    -- Check optimistic lock version
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
        USING ERRCODE = 'version_conflict',
              HINT = format('Expected version %s, got %s', v_old_data->>'version', v_child_version);
    END IF;

    -- Soft delete profile
    UPDATE profiles
    SET
      deleted_at = now(),
      version = version + 1
    WHERE id = v_child_id;

    -- Create audit log entry with old_data captured BEFORE delete
    INSERT INTO audit_log_enhanced (
      actor_id,
      profile_id,
      action_type,
      old_data,
      new_data,
      operation_group_id
    )
    VALUES (
      v_actor_id,
      v_child_id,
      'profile_soft_delete',
      v_old_data,  -- *** BUG FIX: Use captured old_data ***
      NULL,
      v_operation_group_id
    );

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- ========================================================================
  -- STEP 7: RETURN SUCCESS RESPONSE
  -- ========================================================================

  RETURN jsonb_build_object(
    'success', true,
    'operation_group_id', v_operation_group_id,
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'deleted_count', v_deleted_count,
    'message', format(
      'تمت معالجة %s عملية بنجاح (إنشاء: %s، تحديث: %s، حذف: %s)',
      v_batch_size,
      v_created_count,
      v_updated_count,
      v_deleted_count
    )
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة مرة أخرى'
      USING ERRCODE = 'lock_conflict',
            HINT = 'Another transaction holds a lock on this profile';

  WHEN OTHERS THEN
    -- Re-raise with formatted error message
    RAISE EXCEPTION 'فشلت العملية الجماعية: %', SQLERRM
      USING ERRCODE = SQLSTATE,
            HINT = format('Error at profile: %s', v_child_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_quick_add_batch_save TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_quick_add_batch_save IS
'Atomic batch operation for QuickAdd overlay. Fixes: (1) COALESCE bug causing check constraint violations, (2) Audit log old_data corruption. Supports create/update/delete with full safety mechanisms.';
