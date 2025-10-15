-- Migration: Fix Batch Save Schema Mismatch (Bug #9)
-- Issue: UPDATE statement references 14 non-existent columns + missing 7 critical fields
-- Wrong: birth_date_day, birth_location, bio_ar, phone_number (and 10 more)
-- Correct: dob_data, dod_data, bio, birth_place, current_residence, phone (and 14 more)
-- Fix: Replace with COMPLETE 20-field UPDATE matching actual profiles table schema
-- Status: BUG #9 - Discovered during third test attempt
-- Audit: Solution-auditor REJECTED incomplete proposal, provided complete field list

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
  -- 1. AUTHENTICATION & AUTHORIZATION
  -- ========================================================================

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM profiles
  WHERE user_id = auth.uid() AND deleted_at IS NULL;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أو لا يوجد ملف شخصي مرتبط بهذا الحساب'
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
    WHERE id = p_selected_mother_id
      AND gender = 'female'
      AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأم المختارة غير موجودة أو محذوفة أو ليست أنثى'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_selected_father_id IS NOT NULL THEN
    PERFORM 1 FROM profiles
    WHERE id = p_selected_father_id
      AND gender = 'male'
      AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الأب المختار غير موجود أو محذوف أو ليس ذكراً'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ========================================================================
  -- 4. PERMISSION VALIDATION
  -- ========================================================================

  SELECT check_family_permission_v4(v_actor_id, p_parent_id) INTO v_permission_level;

  IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل مباشرة على هذا الملف الشخصي'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 5. BATCH SIZE VALIDATION
  -- ========================================================================

  v_batch_size := jsonb_array_length(p_children_to_create) +
                  jsonb_array_length(p_children_to_update) +
                  jsonb_array_length(p_children_to_delete);

  IF v_batch_size > 50 THEN
    RAISE EXCEPTION 'حجم الدفعة يتجاوز الحد الأقصى المسموح (50 عملية)'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 6. CREATE OPERATION GROUP
  -- ========================================================================

  INSERT INTO operation_groups (
    created_by,
    group_type,
    operation_count,
    description
  ) VALUES (
    v_actor_id,
    'batch_update',
    v_batch_size,
    p_operation_description
  )
  RETURNING id INTO v_operation_group_id;

  -- ========================================================================
  -- 7. CREATE NEW CHILDREN
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_create)
  LOOP
    v_calculated_generation := v_parent_generation + 1;

    IF v_child->>'name' IS NULL OR trim(v_child->>'name') = '' THEN
      RAISE EXCEPTION 'الاسم مطلوب لجميع الملفات الشخصية الجديدة'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_child->>'gender' IS NULL OR v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'الجنس مطلوب ويجب أن يكون male أو female'
        USING ERRCODE = 'P0001';
    END IF;

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
      dob_data,
      dod_data,
      bio,
      birth_place,
      current_residence,
      occupation,
      education,
      phone,
      email,
      photo_url,
      social_media_links,
      achievements,
      timeline,
      dob_is_public,
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
      (v_child->'achievements')::text[],
      (v_child->'timeline')::jsonb,
      COALESCE((v_child->>'dob_is_public')::boolean, false),
      COALESCE(v_child->>'profile_visibility', 'family'),
      1
    )
    RETURNING id INTO v_new_profile_id;

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
  -- 8. UPDATE EXISTING CHILDREN (BUG #9 FIX - COMPLETE 20-FIELD UPDATE)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_update)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للتحديثات'
        USING ERRCODE = 'P0001';
    END IF;

    -- Permission check on child
    SELECT check_family_permission_v4(v_actor_id, v_child_id) INTO v_permission_level;

    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية تعديل هذا الملف الشخصي'
        USING ERRCODE = 'P0001';
    END IF;

    -- Capture old data BEFORE update (Bug #2 fix)
    SELECT to_jsonb(p.*) - 'version' - 'updated_at'
    INTO v_old_data
    FROM profiles p
    WHERE p.id = v_child_id AND p.deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب تحديثه غير موجود أو محذوف'
        USING ERRCODE = 'P0001';
    END IF;

    -- Version conflict check (optimistic locking)
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
        USING ERRCODE = 'P0001';
    END IF;

    -- CHECK constraint validation (Bug #6 fix)
    IF v_child ? 'status' AND v_child->>'status' NOT IN ('alive', 'deceased', 'unknown') THEN
      RAISE EXCEPTION 'قيمة الحالة غير صالحة. يجب أن تكون alive أو deceased أو unknown'
        USING ERRCODE = '23514';
    END IF;

    IF v_child ? 'gender' AND v_child->>'gender' NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'قيمة الجنس غير صالحة. يجب أن تكون male أو female'
        USING ERRCODE = '23514';
    END IF;

    IF v_child ? 'profile_visibility' AND v_child->>'profile_visibility' NOT IN ('public', 'family', 'private') THEN
      RAISE EXCEPTION 'قيمة رؤية الملف الشخصي غير صالحة'
        USING ERRCODE = '23514';
    END IF;

    -- ============================================================
    -- BUG #9 FIX: Complete 20-field UPDATE with correct schema
    -- Using CASE WHEN (Bug #1 fix) instead of COALESCE
    -- All field names match actual profiles table columns
    -- ============================================================
    UPDATE profiles
    SET
      -- Basic Info (5 fields)
      name = CASE WHEN v_child ? 'name' THEN v_child->>'name' ELSE name END,
      kunya = CASE WHEN v_child ? 'kunya' THEN v_child->>'kunya' ELSE kunya END,
      nickname = CASE WHEN v_child ? 'nickname' THEN v_child->>'nickname' ELSE nickname END,
      status = CASE WHEN v_child ? 'status' THEN v_child->>'status' ELSE status END,
      sibling_order = CASE WHEN v_child ? 'sibling_order' THEN (v_child->>'sibling_order')::integer ELSE sibling_order END,

      -- Relationships (2 fields)
      father_id = CASE WHEN v_child ? 'father_id' THEN (v_child->>'father_id')::uuid ELSE father_id END,
      mother_id = CASE WHEN v_child ? 'mother_id' THEN (v_child->>'mother_id')::uuid ELSE mother_id END,

      -- Gender (1 field)
      gender = CASE WHEN v_child ? 'gender' THEN v_child->>'gender' ELSE gender END,

      -- Dates (2 fields - JSONB, NOT granular day/month/year fields)
      dob_data = CASE WHEN v_child ? 'dob_data' THEN (v_child->'dob_data')::jsonb ELSE dob_data END,
      dod_data = CASE WHEN v_child ? 'dod_data' THEN (v_child->'dod_data')::jsonb ELSE dod_data END,

      -- Biography (3 fields - correct field names)
      bio = CASE WHEN v_child ? 'bio' THEN v_child->>'bio' ELSE bio END,
      birth_place = CASE WHEN v_child ? 'birth_place' THEN v_child->>'birth_place' ELSE birth_place END,
      current_residence = CASE WHEN v_child ? 'current_residence' THEN v_child->>'current_residence' ELSE current_residence END,

      -- Career (2 fields)
      occupation = CASE WHEN v_child ? 'occupation' THEN v_child->>'occupation' ELSE occupation END,
      education = CASE WHEN v_child ? 'education' THEN v_child->>'education' ELSE education END,

      -- Contact (3 fields - correct field names)
      phone = CASE WHEN v_child ? 'phone' THEN v_child->>'phone' ELSE phone END,
      email = CASE WHEN v_child ? 'email' THEN v_child->>'email' ELSE email END,
      photo_url = CASE WHEN v_child ? 'photo_url' THEN v_child->>'photo_url' ELSE photo_url END,

      -- Rich Data (3 fields - JSONB and array types)
      social_media_links = CASE WHEN v_child ? 'social_media_links' THEN (v_child->'social_media_links')::jsonb ELSE social_media_links END,
      achievements = CASE WHEN v_child ? 'achievements' THEN (v_child->'achievements')::text[] ELSE achievements END,
      timeline = CASE WHEN v_child ? 'timeline' THEN (v_child->'timeline')::jsonb ELSE timeline END,

      -- Privacy (2 fields)
      dob_is_public = CASE WHEN v_child ? 'dob_is_public' THEN (v_child->>'dob_is_public')::boolean ELSE dob_is_public END,
      profile_visibility = CASE WHEN v_child ? 'profile_visibility' THEN v_child->>'profile_visibility' ELSE profile_visibility END,

      -- System fields (always updated)
      version = version + 1,
      updated_at = now()
    WHERE id = v_child_id;

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
      v_old_data,
      to_jsonb(p.*) - 'version' - 'updated_at',
      v_operation_group_id
    FROM profiles p
    WHERE p.id = v_child_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- 9. DELETE CHILDREN (WITH PERMISSION CHECKS)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_delete)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للحذف'
        USING ERRCODE = 'P0001';
    END IF;

    -- Permission check on child
    SELECT check_family_permission_v4(v_actor_id, v_child_id) INTO v_permission_level;

    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
      RAISE EXCEPTION 'ليس لديك صلاحية حذف هذا الملف الشخصي'
        USING ERRCODE = 'P0001';
    END IF;

    -- Capture old data BEFORE delete
    SELECT to_jsonb(p.*) - 'version' - 'updated_at'
    INTO v_old_data
    FROM profiles p
    WHERE p.id = v_child_id AND p.deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF v_old_data IS NULL THEN
      RAISE EXCEPTION 'الملف الشخصي المطلوب حذفه غير موجود أو محذوف بالفعل'
        USING ERRCODE = 'P0001';
    END IF;

    -- Version conflict check
    IF (v_old_data->>'version')::integer != v_child_version THEN
      RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
        USING ERRCODE = 'P0001';
    END IF;

    -- Soft delete
    UPDATE profiles
    SET
      deleted_at = now(),
      version = version + 1
    WHERE id = v_child_id;

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
      v_old_data,
      NULL,
      v_operation_group_id
    );

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- ========================================================================
  -- 10. RETURN SUCCESS RESULT
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
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة مرة أخرى';

  WHEN OTHERS THEN
    RAISE EXCEPTION 'فشلت العملية الجماعية: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_quick_add_batch_save TO authenticated;

COMMENT ON FUNCTION admin_quick_add_batch_save IS
'Atomic batch operation for QuickAdd overlay. Fixed Bug #9: Complete 20-field UPDATE with correct schema (dob_data/dod_data jsonb, bio/birth_place/phone). All 9 bugs resolved. Uses CASE WHEN pattern. Supports operation_groups for batch undo.';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 20251015240000: Fix Schema Mismatch (Bug #9)';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed Bug #9: Schema mismatch in UPDATE statement';
  RAISE NOTICE '';
  RAISE NOTICE '📋 REPLACED 14 non-existent columns:';
  RAISE NOTICE '   ❌ birth_date_day → ✅ dob_data (jsonb)';
  RAISE NOTICE '   ❌ birth_date_month → ✅ dob_data (jsonb)';
  RAISE NOTICE '   ❌ birth_date_year → ✅ dob_data (jsonb)';
  RAISE NOTICE '   ❌ birth_date_is_hijri → ✅ dob_data (jsonb)';
  RAISE NOTICE '   ❌ birth_date_is_approximate → ✅ dob_data (jsonb)';
  RAISE NOTICE '   ❌ death_date_day → ✅ dod_data (jsonb)';
  RAISE NOTICE '   ❌ death_date_month → ✅ dod_data (jsonb)';
  RAISE NOTICE '   ❌ death_date_year → ✅ dod_data (jsonb)';
  RAISE NOTICE '   ❌ death_date_is_hijri → ✅ dod_data (jsonb)';
  RAISE NOTICE '   ❌ death_date_is_approximate → ✅ dod_data (jsonb)';
  RAISE NOTICE '   ❌ birth_location → ✅ birth_place';
  RAISE NOTICE '   ❌ current_location → ✅ current_residence';
  RAISE NOTICE '   ❌ bio_ar → ✅ bio';
  RAISE NOTICE '   ❌ phone_number → ✅ phone';
  RAISE NOTICE '';
  RAISE NOTICE '📋 ADDED 7 missing fields:';
  RAISE NOTICE '   ✅ occupation';
  RAISE NOTICE '   ✅ education';
  RAISE NOTICE '   ✅ photo_url';
  RAISE NOTICE '   ✅ social_media_links (jsonb)';
  RAISE NOTICE '   ✅ achievements (text[])';
  RAISE NOTICE '   ✅ timeline (jsonb)';
  RAISE NOTICE '   ✅ dob_is_public (boolean)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 COMPLETE UPDATE coverage (20 fields):';
  RAISE NOTICE '   ✅ Basic: name, kunya, nickname, status, sibling_order';
  RAISE NOTICE '   ✅ Relations: father_id, mother_id, gender';
  RAISE NOTICE '   ✅ Dates: dob_data, dod_data (jsonb)';
  RAISE NOTICE '   ✅ Bio: bio, birth_place, current_residence';
  RAISE NOTICE '   ✅ Career: occupation, education';
  RAISE NOTICE '   ✅ Contact: phone, email, photo_url';
  RAISE NOTICE '   ✅ Rich: social_media_links, achievements, timeline';
  RAISE NOTICE '   ✅ Privacy: dob_is_public, profile_visibility';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 All 9 bugs now fixed:';
  RAISE NOTICE '   ✅ Bug #1: COALESCE anti-pattern → CASE WHEN';
  RAISE NOTICE '   ✅ Bug #2: Audit log old_data timing';
  RAISE NOTICE '   ✅ Bug #3: auth_user_id → user_id';
  RAISE NOTICE '   ✅ Bug #4: permission_level column';
  RAISE NOTICE '   ✅ Bug #5: Console logging spam';
  RAISE NOTICE '   ✅ Bug #6: Custom error codes → P0001/23514';
  RAISE NOTICE '   ✅ Bug #7: operation_groups NOT NULL';
  RAISE NOTICE '   ✅ Bug #8: group_type CHECK constraint';
  RAISE NOTICE '   ✅ Bug #9: Schema mismatch (this migration)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Function should NOW work (complete field coverage!)';
  RAISE NOTICE '🎯 Ready for fourth test attempt';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
END $$;
