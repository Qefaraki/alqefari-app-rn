-- Migration: Fix undo JSONB validation
-- Created: 2025-10-15
-- Description: Adds validation to JSONB field restoration in undo_profile_update
--              to prevent CHECK constraint violations
--
-- PROBLEM:
-- The undo function was blindly restoring JSONB fields without validation.
-- This caused CHECK constraint violations when:
-- - dob_data or dod_data contained empty objects {}
-- - JSONB lacked required date systems (hijri OR gregorian)
-- - Invalid JSONB structures were stored in old audit data
--
-- SOLUTION:
-- Add validation before restoring JSONB fields:
-- 1. Check field exists in old_data
-- 2. Check value is not NULL
-- 3. Check value is an object type
-- 4. For date fields: Check contains hijri OR gregorian
-- 5. Only restore if ALL checks pass, otherwise keep current value
--
-- AFFECTED FIELDS:
-- - dob_data (requires hijri OR gregorian)
-- - dod_data (requires hijri OR gregorian)
-- - social_media_links (requires object validation)
-- - timeline (requires object validation)

CREATE OR REPLACE FUNCTION public.undo_profile_update(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_profile_id UUID;
  v_old_data jsonb;
  v_current_version INTEGER;
  v_expected_version INTEGER;
  v_father_exists BOOLEAN;
  v_mother_exists BOOLEAN;
BEGIN
  -- Get current user's profile ID
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح. يجب تسجيل الدخول.');
  END IF;

  -- Advisory lock (prevent concurrent undo)
  PERFORM pg_advisory_xact_lock(hashtext(p_audit_log_id::text));

  -- Get audit log entry WITH LOCK
  BEGIN
    SELECT * INTO v_log_entry FROM audit_log_enhanced WHERE id = p_audit_log_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'عملية التراجع قيد التنفيذ من قبل مستخدم آخر');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'سجل غير موجود');
  END IF;

  -- Idempotency check
  IF v_log_entry.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('تم التراجع عن هذا الإجراء بالفعل في %s', to_char(v_log_entry.undone_at, 'YYYY-MM-DD HH24:MI'))
    );
  END IF;

  -- Check permission
  v_permission_check := check_undo_permission(p_audit_log_id, v_current_user_id);
  IF NOT (v_permission_check->>'can_undo')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_permission_check->>'reason');
  END IF;

  v_profile_id := v_log_entry.record_id;
  v_old_data := v_log_entry.old_data;
  v_expected_version := (v_log_entry.new_data->>'version')::integer;

  -- Version checking with lock
  BEGIN
    SELECT version INTO v_current_version FROM profiles WHERE id = v_profile_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف قيد التعديل. يرجى المحاولة بعد قليل.');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  IF v_current_version != v_expected_version AND v_expected_version IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('تم تحديث الملف من مستخدم آخر (الإصدار الحالي: %s، المتوقع: %s). لا يمكن التراجع.', v_current_version, v_expected_version)
    );
  END IF;

  -- Parent existence validation
  IF (v_old_data->>'father_id') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = (v_old_data->>'father_id')::UUID AND deleted_at IS NULL
    ) INTO v_father_exists;

    IF NOT v_father_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأب محذوف. يجب استعادة الأب أولاً.');
    END IF;
  END IF;

  IF (v_old_data->>'mother_id') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = (v_old_data->>'mother_id')::UUID AND deleted_at IS NULL
    ) INTO v_mother_exists;

    IF NOT v_mother_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأم محذوف. يجب استعادة الأم أولاً.');
    END IF;
  END IF;

  -- ========================================================================
  -- SCHEMA FIX: Restore old data with JSONB validation
  -- ========================================================================
  UPDATE profiles
  SET
    -- Basic information
    name = COALESCE((v_old_data->>'name')::text, name),
    kunya = CASE WHEN v_old_data ? 'kunya' THEN (v_old_data->>'kunya')::text ELSE kunya END,
    nickname = CASE WHEN v_old_data ? 'nickname' THEN (v_old_data->>'nickname')::text ELSE nickname END,
    gender = CASE WHEN v_old_data ? 'gender' THEN (v_old_data->>'gender')::text ELSE gender END,
    status = CASE WHEN v_old_data ? 'status' THEN (v_old_data->>'status')::text ELSE status END,

    -- Date information (JSONB with validation)
    dob_data = CASE
      WHEN v_old_data ? 'dob_data'
        AND v_old_data->'dob_data' IS NOT NULL
        AND jsonb_typeof(v_old_data->'dob_data') = 'object'
        AND (v_old_data->'dob_data' ? 'hijri' OR v_old_data->'dob_data' ? 'gregorian')
      THEN (v_old_data->'dob_data')::jsonb
      ELSE dob_data
    END,
    dod_data = CASE
      WHEN v_old_data ? 'dod_data'
        AND v_old_data->'dod_data' IS NOT NULL
        AND jsonb_typeof(v_old_data->'dod_data') = 'object'
        AND (v_old_data->'dod_data' ? 'hijri' OR v_old_data->'dod_data' ? 'gregorian')
      THEN (v_old_data->'dod_data')::jsonb
      ELSE dod_data
    END,

    -- Bio and contact
    bio = CASE WHEN v_old_data ? 'bio' THEN (v_old_data->>'bio')::text ELSE bio END,
    phone = CASE WHEN v_old_data ? 'phone' THEN (v_old_data->>'phone')::text ELSE phone END,
    email = CASE WHEN v_old_data ? 'email' THEN (v_old_data->>'email')::text ELSE email END,

    -- Location
    birth_place = CASE WHEN v_old_data ? 'birth_place' THEN (v_old_data->>'birth_place')::text ELSE birth_place END,
    current_residence = CASE WHEN v_old_data ? 'current_residence' THEN (v_old_data->>'current_residence')::text ELSE current_residence END,

    -- Professional information
    occupation = CASE WHEN v_old_data ? 'occupation' THEN (v_old_data->>'occupation')::text ELSE occupation END,
    education = CASE WHEN v_old_data ? 'education' THEN (v_old_data->>'education')::text ELSE education END,
    professional_title = CASE WHEN v_old_data ? 'professional_title' THEN (v_old_data->>'professional_title')::text ELSE professional_title END,
    title_abbreviation = CASE WHEN v_old_data ? 'title_abbreviation' THEN (v_old_data->>'title_abbreviation')::text ELSE title_abbreviation END,

    -- Identity and media
    family_origin = CASE WHEN v_old_data ? 'family_origin' THEN (v_old_data->>'family_origin')::text ELSE family_origin END,
    photo_url = CASE WHEN v_old_data ? 'photo_url' THEN (v_old_data->>'photo_url')::text ELSE photo_url END,
    social_media_links = CASE
      WHEN v_old_data ? 'social_media_links'
        AND v_old_data->'social_media_links' IS NOT NULL
        AND jsonb_typeof(v_old_data->'social_media_links') = 'object'
      THEN (v_old_data->'social_media_links')::jsonb
      ELSE social_media_links
    END,

    -- Arrays and structured data
    achievements = CASE WHEN v_old_data ? 'achievements' THEN ARRAY(SELECT jsonb_array_elements_text(v_old_data->'achievements'))::text[] ELSE achievements END,
    timeline = CASE
      WHEN v_old_data ? 'timeline'
        AND v_old_data->'timeline' IS NOT NULL
        AND jsonb_typeof(v_old_data->'timeline') = 'object'
      THEN (v_old_data->'timeline')::jsonb
      ELSE timeline
    END,

    -- Privacy settings
    dob_is_public = CASE WHEN v_old_data ? 'dob_is_public' THEN (v_old_data->>'dob_is_public')::boolean ELSE dob_is_public END,
    profile_visibility = CASE WHEN v_old_data ? 'profile_visibility' THEN (v_old_data->>'profile_visibility')::text ELSE profile_visibility END,

    -- Parent relationships
    father_id = CASE WHEN v_old_data ? 'father_id' THEN (v_old_data->>'father_id')::uuid ELSE father_id END,
    mother_id = CASE WHEN v_old_data ? 'mother_id' THEN (v_old_data->>'mother_id')::uuid ELSE mother_id END,

    -- Metadata (always update)
    version = version + 1,
    updated_at = NOW(),
    updated_by = v_current_user_id
  WHERE id = v_profile_id;

  -- Mark as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR (Compensation Log Record)
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    old_data, new_data, changed_fields, description, severity, is_undoable
  ) VALUES (
    'profiles', v_profile_id, 'undo_profile_update', v_current_user_id,
    v_log_entry.new_data, v_log_entry.old_data, v_log_entry.changed_fields,
    'تراجع عن: ' || v_log_entry.description, 'medium', false
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم التراجع بنجاح');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء التراجع: ' || SQLERRM);
END;
$function$;

COMMENT ON FUNCTION public.undo_profile_update(uuid, text) IS
'Safely undoes a profile update with JSONB validation to prevent constraint violations.

VALIDATION ADDED (v2025-10-15):
- dob_data/dod_data: Only restored if contains hijri OR gregorian
- social_media_links/timeline: Only restored if valid object type
- Invalid JSONB values are skipped, preserving current profile data

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations
- Row-level locks prevent race conditions
- Parent existence validation prevents orphaned profiles
- Idempotency check prevents double-undo operations
- Version checking ensures data consistency';
