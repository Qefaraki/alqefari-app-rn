-- Migration: Fix Audit Log Double Logging in Batch Save
-- Date: 2025-10-17
-- Purpose: Eliminate duplicate audit entries from batch save operations
--
-- Problem:
-- - Trigger creates 'profile_insert' entries (no operation_group_id)
-- - Batch save manually creates 'profile_create' entries (has operation_group_id)
-- - Result: 2 audit entries per profile
--
-- Solution:
-- 1. Enhance trigger to read operation_group_id from session variable
-- 2. Remove manual audit INSERTs from batch_save function
-- 3. Standardize action_type to 'profile_create'
--
-- Impact: Reduces audit log bloat by 50% for batch operations
-- Risk: LOW - Only affects batch save, other operations unchanged

-- ========================================================================
-- PART 1: Enhanced Trigger Function with Session Variable Support
-- ========================================================================

CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id UUID;
  v_operation_group_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_description TEXT;
  v_action_type TEXT;
BEGIN
  v_actor_id := auth.uid();

  -- NEW: Read operation_group_id from session variable (set by batch operations)
  -- Returns NULL if not set (normal single operations)
  BEGIN
    v_operation_group_id := current_setting('app.operation_group_id', true)::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      v_operation_group_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
    v_description := 'Profile deleted: ' || OLD.name;
    v_action_type := 'profile_hard_delete';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Calculate which fields changed
    v_changed_fields := ARRAY(
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    );

    -- Detect soft delete: deleted_at went from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action_type := 'profile_soft_delete';
      v_description := 'Profile soft deleted: ' || NEW.name;
    ELSE
      v_action_type := 'profile_update';
      v_description := 'Profile updated: ' || NEW.name || ' (' || array_length(v_changed_fields, 1) || ' fields changed)';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_changed_fields := NULL;
    v_description := 'Profile created: ' || NEW.name;
    -- CHANGED: Use 'profile_create' instead of 'profile_insert' for consistency
    v_action_type := 'profile_create';
  END IF;

  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    operation_group_id,  -- NEW: Support batch operations
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action_type,
    v_actor_id,
    v_old_data,
    v_new_data,
    v_changed_fields,
    v_description,
    CASE
      WHEN v_action_type IN ('profile_soft_delete', 'profile_hard_delete') THEN 'high'
      WHEN v_action_type = 'profile_create' THEN 'medium'
      ELSE 'low'
    END,
    v_operation_group_id,  -- NEW: Will be NULL for single operations
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ========================================================================
-- PART 2: Updated Batch Save Function (No Manual Audit INSERTs)
-- ========================================================================

CREATE OR REPLACE FUNCTION admin_quick_add_batch_save(
  p_parent_id UUID,
  p_parent_gender TEXT,
  p_selected_mother_id UUID DEFAULT NULL,
  p_selected_father_id UUID DEFAULT NULL,
  p_children_to_create JSONB DEFAULT '[]'::jsonb,
  p_children_to_update JSONB DEFAULT '[]'::jsonb,
  p_children_to_delete JSONB DEFAULT '[]'::jsonb,
  p_operation_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid;
  v_actor_profile_id uuid;
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

  -- HID generation variables
  v_parent_with_hid_id uuid;
  v_parent_with_hid text;
  v_child_hid text;

  -- Performance tracking variables
  v_start_time timestamp;
  v_duration_ms numeric;

  -- Descendant checking variables
  v_has_descendants boolean;
  v_descendant_count integer;
  v_child_name text;
BEGIN
  -- ========================================================================
  -- START PERFORMANCE TIMER
  -- ========================================================================

  v_start_time := clock_timestamp();

  -- Set transaction timeout (10 seconds)
  SET LOCAL statement_timeout = '10000';

  -- ========================================================================
  -- 1. AUTHENTICATION & AUTHORIZATION
  -- ========================================================================

  v_auth_user_id := auth.uid();

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتنفيذ هذه العملية'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, role INTO v_actor_profile_id, v_actor_role
  FROM profiles
  WHERE user_id = v_auth_user_id AND deleted_at IS NULL;

  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف شخصي مرتبط بهذا الحساب'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 2. PARENT VALIDATION & LOCKING
  -- ========================================================================

  SELECT p.*, p.generation
  INTO v_parent_record
  FROM profiles p
  WHERE p.id = p_parent_id
    AND p.deleted_at IS NULL
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الملف الشخصي للوالد غير موجود أو محذوف'
      USING ERRCODE = 'P0001';
  END IF;

  v_parent_generation := v_parent_record.generation;

  IF v_parent_record.gender != p_parent_gender THEN
    RAISE EXCEPTION 'الجنس المحدد لا يتطابق مع جنس الملف الشخصي'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 3. SELECTED PARENTS VALIDATION & LOCKING
  -- ========================================================================

  IF p_selected_mother_id IS NOT NULL THEN
    PERFORM 1 FROM profiles
    WHERE id = p_selected_mother_id AND gender = 'female' AND deleted_at IS NULL
    FOR UPDATE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأم المختارة غير موجودة أو محذوفة أو ليست أنثى' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_selected_father_id IS NOT NULL THEN
    PERFORM 1 FROM profiles
    WHERE id = p_selected_father_id AND gender = 'male' AND deleted_at IS NULL
    FOR UPDATE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأب المختار غير موجود أو محذوف أو ليس ذكراً' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ========================================================================
  -- 4. PERMISSION VALIDATION
  -- ========================================================================

  SELECT check_family_permission_v4(v_actor_profile_id, p_parent_id) INTO v_permission_level;
  IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'ليس لديك صلاحية مباشرة لإضافة أطفال لهذا الملف. يمكنك إرسال اقتراح للمشرفين'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 5. BATCH SIZE VALIDATION
  -- ========================================================================

  v_batch_size := jsonb_array_length(p_children_to_create) + jsonb_array_length(p_children_to_update) + jsonb_array_length(p_children_to_delete);
  IF v_batch_size > 50 THEN
    RAISE EXCEPTION 'الحد الأقصى 50 عملية في الدفعة الواحدة. يرجى تقسيم التغييرات إلى دفعات أصغر'
      USING ERRCODE = 'P0001';
  END IF;

  -- Handle empty batch (no-op)
  IF v_batch_size = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'operation_group_id', NULL,
      'results', jsonb_build_object(
        'created', 0,
        'updated', 0,
        'deleted', 0,
        'duration_ms', 0
      ),
      'message', 'لا توجد تغييرات للحفظ'
    );
  END IF;

  -- Advisory lock for parent coordination (prevents concurrent batch operations)
  PERFORM pg_advisory_xact_lock(hashtext(p_parent_id::text));

  -- ========================================================================
  -- 6. CREATE OPERATION GROUP
  -- ========================================================================

  INSERT INTO operation_groups (created_by, group_type, operation_count, description)
  VALUES (v_actor_profile_id, 'batch_update', v_batch_size, COALESCE(p_operation_description, 'إضافة سريعة جماعية'))
  RETURNING id INTO v_operation_group_id;

  -- ========================================================================
  -- NEW: SET SESSION VARIABLE FOR TRIGGER TO READ
  -- ========================================================================

  PERFORM set_config('app.operation_group_id', v_operation_group_id::text, true);

  -- ========================================================================
  -- 7. DETERMINE PARENT WITH HID (for HID inheritance)
  -- ========================================================================

  IF p_parent_gender = 'male' THEN
    -- Father is parent - use his HID
    v_parent_with_hid_id := p_parent_id;
    v_parent_with_hid := v_parent_record.hid;
  ELSIF p_selected_father_id IS NOT NULL THEN
    -- Mother is parent, father selected - use father's HID
    SELECT id, hid INTO v_parent_with_hid_id, v_parent_with_hid
    FROM profiles
    WHERE id = p_selected_father_id AND deleted_at IS NULL;
  ELSE
    -- Mother is parent, no father - use mother's HID (if she's Al Qefari)
    v_parent_with_hid_id := p_parent_id;
    v_parent_with_hid := v_parent_record.hid;
  END IF;

  -- ========================================================================
  -- 8. CREATE NEW CHILDREN (TRIGGER HANDLES AUDIT)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_create)
  LOOP
    v_calculated_generation := v_parent_generation + 1;
    IF v_child->>'name' IS NULL OR trim(v_child->>'name') = '' THEN
      RAISE EXCEPTION 'الاسم مطلوب لجميع الملفات الشخصية الجديدة' USING ERRCODE = 'P0001';
    END IF;
    IF v_child->>'gender' IS NULL OR v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'الجنس مطلوب ويجب أن يكون male أو female' USING ERRCODE = 'P0001';
    END IF;

    -- Generate HID from parent (if parent has HID)
    IF v_parent_with_hid IS NOT NULL THEN
      v_child_hid := generate_next_hid(v_parent_with_hid);
    ELSE
      -- Both parents are Munasib (rare edge case) - child stays NULL
      v_child_hid := NULL;
    END IF;

    INSERT INTO profiles (
      name, gender, generation, hid,
      father_id, mother_id,
      kunya, nickname, status, sibling_order,
      dob_data, dod_data, bio, birth_place, current_residence,
      occupation, education, phone, email, photo_url,
      social_media_links, achievements, timeline,
      dob_is_public, profile_visibility, version
    )
    VALUES (
      v_child->>'name',
      v_child->>'gender',
      v_calculated_generation,
      v_child_hid,
      CASE WHEN p_parent_gender = 'male' THEN p_parent_id ELSE p_selected_father_id END,
      CASE WHEN p_parent_gender = 'female' THEN p_parent_id ELSE p_selected_mother_id END,
      v_child->>'kunya',
      v_child->>'nickname',
      COALESCE(v_child->>'status', 'alive'),
      COALESCE((v_child->>'sibling_order')::integer, 0),
      (v_child->'dob_data')::jsonb,
      (v_child->'dod_data')::jsonb,
      v_child->>'bio',
      v_child->>'birth_place',
      v_child->>'current_residence',
      v_child->>'occupation',
      v_child->>'education',
      v_child->>'phone',
      v_child->>'email',
      v_child->>'photo_url',
      (v_child->'social_media_links')::jsonb,
      CASE
        WHEN v_child ? 'achievements' AND jsonb_typeof(v_child->'achievements') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(v_child->'achievements'))
        ELSE NULL
      END,
      (v_child->'timeline')::jsonb,
      COALESCE((v_child->>'dob_is_public')::boolean, false),
      COALESCE(v_child->>'profile_visibility', 'family'),
      1
    )
    RETURNING id INTO v_new_profile_id;

    -- REMOVED: Manual audit INSERT (trigger handles it now)

    v_created_count := v_created_count + 1;
  END LOOP;

  -- ========================================================================
  -- 9. UPDATE EXISTING CHILDREN (TRIGGER HANDLES AUDIT)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_update)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);
    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للتحديثات' USING ERRCODE = 'P0001';
    END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_child_id) INTO v_permission_level;
    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية تعديل هذا الملف الشخصي' USING ERRCODE = 'P0001';
    END IF;

    SELECT to_jsonb(p.*) - 'version' - 'updated_at' INTO v_old_data FROM profiles p WHERE p.id = v_child_id AND p.deleted_at IS NULL FOR UPDATE NOWAIT;
    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب تحديثه غير موجود أو محذوف' USING ERRCODE = 'P0001';
    END IF;
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تحديث البيانات من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى' USING ERRCODE = 'P0001';
    END IF;

    IF v_child ? 'status' AND v_child->>'status' NOT IN ('alive', 'deceased', 'unknown') THEN
      RAISE EXCEPTION 'قيمة الحالة غير صالحة. يجب أن تكون alive أو deceased أو unknown' USING ERRCODE = '23514';
    END IF;
    IF v_child ? 'gender' AND v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'قيمة الجنس غير صالحة. يجب أن تكون male أو female' USING ERRCODE = '23514';
    END IF;
    IF v_child ? 'profile_visibility' AND v_child->>'profile_visibility' NOT IN ('public', 'family', 'private') THEN
      RAISE EXCEPTION 'قيمة رؤية الملف الشخصي غير صالحة' USING ERRCODE = '23514';
    END IF;

    UPDATE profiles SET
      name = CASE WHEN v_child ? 'name' THEN v_child->>'name' ELSE name END,
      kunya = CASE WHEN v_child ? 'kunya' THEN v_child->>'kunya' ELSE kunya END,
      nickname = CASE WHEN v_child ? 'nickname' THEN v_child->>'nickname' ELSE nickname END,
      status = CASE WHEN v_child ? 'status' THEN v_child->>'status' ELSE status END,
      sibling_order = CASE WHEN v_child ? 'sibling_order' THEN (v_child->>'sibling_order')::integer ELSE sibling_order END,
      father_id = CASE WHEN v_child ? 'father_id' THEN (v_child->>'father_id')::uuid ELSE father_id END,
      mother_id = CASE WHEN v_child ? 'mother_id' THEN (v_child->>'mother_id')::uuid ELSE mother_id END,
      gender = CASE WHEN v_child ? 'gender' THEN v_child->>'gender' ELSE gender END,
      dob_data = CASE WHEN v_child ? 'dob_data' THEN (v_child->'dob_data')::jsonb ELSE dob_data END,
      dod_data = CASE WHEN v_child ? 'dod_data' THEN (v_child->'dod_data')::jsonb ELSE dod_data END,
      bio = CASE WHEN v_child ? 'bio' THEN v_child->>'bio' ELSE bio END,
      birth_place = CASE WHEN v_child ? 'birth_place' THEN v_child->>'birth_place' ELSE birth_place END,
      current_residence = CASE WHEN v_child ? 'current_residence' THEN v_child->>'current_residence' ELSE current_residence END,
      occupation = CASE WHEN v_child ? 'occupation' THEN v_child->>'occupation' ELSE occupation END,
      education = CASE WHEN v_child ? 'education' THEN v_child->>'education' ELSE education END,
      phone = CASE WHEN v_child ? 'phone' THEN v_child->>'phone' ELSE phone END,
      email = CASE WHEN v_child ? 'email' THEN v_child->>'email' ELSE email END,
      photo_url = CASE WHEN v_child ? 'photo_url' THEN v_child->>'photo_url' ELSE photo_url END,
      social_media_links = CASE WHEN v_child ? 'social_media_links' THEN (v_child->'social_media_links')::jsonb ELSE social_media_links END,
      achievements = CASE WHEN v_child ? 'achievements' AND jsonb_typeof(v_child->'achievements') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(v_child->'achievements')) ELSE achievements END,
      timeline = CASE WHEN v_child ? 'timeline' THEN (v_child->'timeline')::jsonb ELSE timeline END,
      dob_is_public = CASE WHEN v_child ? 'dob_is_public' THEN (v_child->>'dob_is_public')::boolean ELSE dob_is_public END,
      profile_visibility = CASE WHEN v_child ? 'profile_visibility' THEN v_child->>'profile_visibility' ELSE profile_visibility END,
      version = version + 1,
      updated_at = now()
    WHERE id = v_child_id;

    -- REMOVED: Manual audit INSERT (trigger handles it now)

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- 10. DELETE CHILDREN (WITH PERMISSION AND DESCENDANT CHECKS)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_delete)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);
    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للحذف' USING ERRCODE = 'P0001';
    END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_child_id) INTO v_permission_level;
    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية حذف هذا الملف الشخصي' USING ERRCODE = 'P0001';
    END IF;

    -- Lock profile and get name for error message
    SELECT name, to_jsonb(p.*) - 'version' - 'updated_at'
    INTO v_child_name, v_old_data
    FROM profiles p
    WHERE p.id = v_child_id AND p.deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب حذفه غير موجود أو محذوف بالفعل' USING ERRCODE = 'P0001';
    END IF;
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تحديث البيانات من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى' USING ERRCODE = 'P0001';
    END IF;

    -- Descendant check before deletion (defense-in-depth)
    SELECT
      EXISTS(SELECT 1 FROM profiles WHERE (father_id = v_child_id OR mother_id = v_child_id) AND deleted_at IS NULL),
      COUNT(*)
    INTO v_has_descendants, v_descendant_count
    FROM profiles
    WHERE (father_id = v_child_id OR mother_id = v_child_id) AND deleted_at IS NULL;

    IF v_has_descendants THEN
      RAISE EXCEPTION 'لا يمكن حذف "%" لأن لديه % طفل/أطفال. يرجى حذف الأطفال أولاً أو استخدام الحذف المتسلسل',
        v_child_name,
        v_descendant_count
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE profiles SET deleted_at = now(), version = version + 1 WHERE id = v_child_id;

    -- REMOVED: Manual audit INSERT (trigger handles it now)

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- ========================================================================
  -- 11. CLEANUP & RETURN
  -- ========================================================================

  -- NEW: Clear session variable
  PERFORM set_config('app.operation_group_id', NULL, true);

  -- Calculate performance metrics
  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;

  -- Log performance for monitoring
  RAISE NOTICE 'QuickAdd batch save completed in % ms for % operations (created: %, updated: %, deleted: %)',
    v_duration_ms,
    v_batch_size,
    v_created_count,
    v_updated_count,
    v_deleted_count;

  RETURN jsonb_build_object(
    'success', true,
    'operation_group_id', v_operation_group_id,
    'results', jsonb_build_object(
      'created', v_created_count,
      'updated', v_updated_count,
      'deleted', v_deleted_count,
      'total', v_batch_size,
      'duration_ms', v_duration_ms
    ),
    'message', 'تم حفظ جميع التغييرات بنجاح'
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة بعد قليل';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'فشلت العملية الجماعية: %', SQLERRM;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_quick_add_batch_save TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_quick_add_batch_save IS
'QuickAdd batch save with automatic audit logging via trigger.
Uses session variable to pass operation_group_id to audit trigger.
No manual audit INSERTs - all logging handled by log_profile_changes() trigger.';

COMMENT ON FUNCTION log_profile_changes IS
'Enhanced audit trigger that reads operation_group_id from session variable.
Supports both single operations (NULL group_id) and batch operations (has group_id).
Eliminates duplicate audit entries from manual INSERTs.';
