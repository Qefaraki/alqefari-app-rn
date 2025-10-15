-- Migration: Fix Batch Save Missing HID (Bug #13)
-- Issue: Children created without hid → excluded by get_branch_data() filter (hid IS NOT NULL)
-- Root Cause: INSERT statement doesn't include hid field, generate_next_hid() never called
-- Fix: Add HID generation logic before INSERT (inherit from father, or mother if Al Qefari)
-- Impact: 14 male profiles created today without HID (now invisible on tree)
-- Pattern: Matches admin_create_profile, admin_bulk_create_children
-- Status: BUG #13 - Children exist in DB but invisible on tree and QuickAdd

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
  -- BUG #13 FIX: Variables for HID generation
  v_parent_with_hid_id uuid;
  v_parent_with_hid text;
  v_child_hid text;
BEGIN
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
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل مباشرة على هذا الملف الشخصي' USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 5. BATCH SIZE VALIDATION
  -- ========================================================================

  v_batch_size := jsonb_array_length(p_children_to_create) + jsonb_array_length(p_children_to_update) + jsonb_array_length(p_children_to_delete);
  IF v_batch_size > 50 THEN
    RAISE EXCEPTION 'حجم الدفعة يتجاوز الحد الأقصى المسموح (50 عملية)' USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 6. CREATE OPERATION GROUP
  -- ========================================================================

  INSERT INTO operation_groups (created_by, group_type, operation_count, description)
  VALUES (v_actor_profile_id, 'batch_update', v_batch_size, p_operation_description)
  RETURNING id INTO v_operation_group_id;

  -- ========================================================================
  -- 7. DETERMINE PARENT WITH HID (for HID inheritance)
  -- ========================================================================

  -- BUG #13 FIX: Find which parent has HID (Al Qefari bloodline)
  -- Priority: Father > Mother (paternal lineage)

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
  -- 8. CREATE NEW CHILDREN
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_create)
  LOOP
    v_calculated_generation := v_parent_generation + 1;
    IF v_child->>'name' IS NULL OR trim(v_child->>'name') = '' THEN RAISE EXCEPTION 'الاسم مطلوب لجميع الملفات الشخصية الجديدة' USING ERRCODE = 'P0001'; END IF;
    IF v_child->>'gender' IS NULL OR v_child->>'gender' NOT IN ('male', 'female') THEN RAISE EXCEPTION 'الجنس مطلوب ويجب أن يكون male أو female' USING ERRCODE = 'P0001'; END IF;

    -- BUG #13 FIX: Generate HID from parent (if parent has HID)
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
      v_child_hid,  -- ✅ NEW: Include HID
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

    INSERT INTO audit_log_enhanced (actor_id, record_id, action_type, table_name, old_data, new_data, operation_group_id)
    SELECT v_auth_user_id, v_new_profile_id, 'profile_create', 'profiles', NULL, to_jsonb(p.*) - 'version' - 'updated_at', v_operation_group_id FROM profiles p WHERE p.id = v_new_profile_id;

    v_created_count := v_created_count + 1;
  END LOOP;

  -- ========================================================================
  -- 9. UPDATE EXISTING CHILDREN
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_update)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);
    IF v_child_id IS NULL THEN RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للتحديثات' USING ERRCODE = 'P0001'; END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_child_id) INTO v_permission_level;
    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN RAISE EXCEPTION 'ليس لديك صلاحية تعديل هذا الملف الشخصي' USING ERRCODE = 'P0001'; END IF;

    SELECT to_jsonb(p.*) - 'version' - 'updated_at' INTO v_old_data FROM profiles p WHERE p.id = v_child_id AND p.deleted_at IS NULL FOR UPDATE NOWAIT;
    IF v_old_data IS NULL THEN RAISE EXCEPTION 'الملف الشخصي المطلوب تحديثه غير موجود أو محذوف' USING ERRCODE = 'P0001'; END IF;
    IF (v_old_data->>'version')::integer != v_child_version THEN RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى' USING ERRCODE = 'P0001'; END IF;

    IF v_child ? 'status' AND v_child->>'status' NOT IN ('alive', 'deceased', 'unknown') THEN RAISE EXCEPTION 'قيمة الحالة غير صالحة. يجب أن تكون alive أو deceased أو unknown' USING ERRCODE = '23514'; END IF;
    IF v_child ? 'gender' AND v_child->>'gender' NOT IN ('male', 'female') THEN RAISE EXCEPTION 'قيمة الجنس غير صالحة. يجب أن تكون male أو female' USING ERRCODE = '23514'; END IF;
    IF v_child ? 'profile_visibility' AND v_child->>'profile_visibility' NOT IN ('public', 'family', 'private') THEN RAISE EXCEPTION 'قيمة رؤية الملف الشخصي غير صالحة' USING ERRCODE = '23514'; END IF;

    UPDATE profiles SET name = CASE WHEN v_child ? 'name' THEN v_child->>'name' ELSE name END, kunya = CASE WHEN v_child ? 'kunya' THEN v_child->>'kunya' ELSE kunya END, nickname = CASE WHEN v_child ? 'nickname' THEN v_child->>'nickname' ELSE nickname END, status = CASE WHEN v_child ? 'status' THEN v_child->>'status' ELSE status END, sibling_order = CASE WHEN v_child ? 'sibling_order' THEN (v_child->>'sibling_order')::integer ELSE sibling_order END, father_id = CASE WHEN v_child ? 'father_id' THEN (v_child->>'father_id')::uuid ELSE father_id END, mother_id = CASE WHEN v_child ? 'mother_id' THEN (v_child->>'mother_id')::uuid ELSE mother_id END, gender = CASE WHEN v_child ? 'gender' THEN v_child->>'gender' ELSE gender END, dob_data = CASE WHEN v_child ? 'dob_data' THEN (v_child->'dob_data')::jsonb ELSE dob_data END, dod_data = CASE WHEN v_child ? 'dod_data' THEN (v_child->'dod_data')::jsonb ELSE dod_data END, bio = CASE WHEN v_child ? 'bio' THEN v_child->>'bio' ELSE bio END, birth_place = CASE WHEN v_child ? 'birth_place' THEN v_child->>'birth_place' ELSE birth_place END, current_residence = CASE WHEN v_child ? 'current_residence' THEN v_child->>'current_residence' ELSE current_residence END, occupation = CASE WHEN v_child ? 'occupation' THEN v_child->>'occupation' ELSE occupation END, education = CASE WHEN v_child ? 'education' THEN v_child->>'education' ELSE education END, phone = CASE WHEN v_child ? 'phone' THEN v_child->>'phone' ELSE phone END, email = CASE WHEN v_child ? 'email' THEN v_child->>'email' ELSE email END, photo_url = CASE WHEN v_child ? 'photo_url' THEN v_child->>'photo_url' ELSE photo_url END, social_media_links = CASE WHEN v_child ? 'social_media_links' THEN (v_child->'social_media_links')::jsonb ELSE social_media_links END, achievements = CASE WHEN v_child ? 'achievements' AND jsonb_typeof(v_child->'achievements') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(v_child->'achievements')) ELSE achievements END, timeline = CASE WHEN v_child ? 'timeline' THEN (v_child->'timeline')::jsonb ELSE timeline END, dob_is_public = CASE WHEN v_child ? 'dob_is_public' THEN (v_child->>'dob_is_public')::boolean ELSE dob_is_public END, profile_visibility = CASE WHEN v_child ? 'profile_visibility' THEN v_child->>'profile_visibility' ELSE profile_visibility END, version = version + 1, updated_at = now() WHERE id = v_child_id;

    INSERT INTO audit_log_enhanced (actor_id, record_id, action_type, table_name, old_data, new_data, operation_group_id)
    SELECT v_auth_user_id, v_child_id, 'profile_update', 'profiles', v_old_data, to_jsonb(p.*) - 'version' - 'updated_at', v_operation_group_id FROM profiles p WHERE p.id = v_child_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- 10. DELETE CHILDREN (WITH PERMISSION CHECKS)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_delete)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_version := COALESCE((v_child->>'version')::integer, 1);
    IF v_child_id IS NULL THEN RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للحذف' USING ERRCODE = 'P0001'; END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_child_id) INTO v_permission_level;
    IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN RAISE EXCEPTION 'ليس لديك صلاحية حذف هذا الملف الشخصي' USING ERRCODE = 'P0001'; END IF;

    SELECT to_jsonb(p.*) - 'version' - 'updated_at' INTO v_old_data FROM profiles p WHERE p.id = v_child_id AND p.deleted_at IS NULL FOR UPDATE NOWAIT;
    IF v_old_data IS NULL THEN RAISE EXCEPTION 'الملف الشخصي المطلوب حذفه غير موجود أو محذوف بالفعل' USING ERRCODE = 'P0001'; END IF;
    IF (v_old_data->>'version')::integer != v_child_version THEN RAISE EXCEPTION 'تم تعديل الملف الشخصي من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى' USING ERRCODE = 'P0001'; END IF;

    UPDATE profiles SET deleted_at = now(), version = version + 1 WHERE id = v_child_id;

    INSERT INTO audit_log_enhanced (actor_id, record_id, action_type, table_name, old_data, new_data, operation_group_id)
    VALUES (v_auth_user_id, v_child_id, 'profile_soft_delete', 'profiles', v_old_data, NULL, v_operation_group_id);

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- ========================================================================
  -- 11. RETURN SUCCESS RESULT
  -- ========================================================================

  RETURN jsonb_build_object('success', true, 'operation_group_id', v_operation_group_id, 'results', jsonb_build_object('created', v_created_count, 'updated', v_updated_count, 'deleted', v_deleted_count), 'message', format('تمت معالجة %s عملية بنجاح (إنشاء: %s، تحديث: %s، حذف: %s)', v_batch_size, v_created_count, v_updated_count, v_deleted_count));

EXCEPTION
  WHEN lock_not_available THEN RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة مرة أخرى';
  WHEN OTHERS THEN RAISE EXCEPTION 'فشلت العملية الجماعية: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_quick_add_batch_save TO authenticated;

COMMENT ON FUNCTION admin_quick_add_batch_save IS 'Atomic batch operation for QuickAdd overlay. Fixed Bug #13: Generates HID for children using generate_next_hid(parent_hid). Inherits from father (priority) or mother (if Al Qefari). All 13 bugs resolved.';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 20251015280000: Fix Batch Save Missing HID (Bug #13)';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed Bug #13: Children created without HID';
  RAISE NOTICE '';
  RAISE NOTICE '❌ BROKEN: INSERT INTO profiles (...) - no hid field';
  RAISE NOTICE '✅ FIXED: INSERT INTO profiles (..., hid, ...) VALUES (..., v_child_hid, ...)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 HID Generation Logic:';
  RAISE NOTICE '   ✅ If father is parent → Use father.hid';
  RAISE NOTICE '   ✅ If mother is parent + father selected → Use father.hid';
  RAISE NOTICE '   ✅ If mother is parent + no father → Use mother.hid (if Al Qefari)';
  RAISE NOTICE '   ✅ If both parents Munasib → hid = NULL (rare edge case)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Uses generate_next_hid(parent_hid):';
  RAISE NOTICE '   ✅ Concurrency safe (advisory locks per parent)';
  RAISE NOTICE '   ✅ Dotted notation (e.g., "1.10.6.2.1.1" → "1.10.6.2.1.1.1")';
  RAISE NOTICE '   ✅ Matches admin_create_profile pattern';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Impact:';
  RAISE NOTICE '   ✅ New children now visible on tree (get_branch_data filter passes)';
  RAISE NOTICE '   ✅ Children inherit paternal lineage (father HID priority)';
  RAISE NOTICE '   ✅ Munasib women children get father''s HID (correct)';
  RAISE NOTICE '';
  RAISE NOTICE '🚨 Next Step: Run data migration to backfill 14 broken profiles';
  RAISE NOTICE '   Query: SELECT id, name FROM profiles WHERE hid IS NULL AND gender = ''male'' AND deleted_at IS NULL';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
END $$;
