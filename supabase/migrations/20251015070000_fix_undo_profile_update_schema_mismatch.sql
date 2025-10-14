-- Migration: Fix undo_profile_update schema mismatch
-- Created: 2025-10-15
-- Description: Updates undo_profile_update to match current profiles table schema
--
-- PROBLEM:
-- The undo_profile_update function was referencing old schema columns that no longer exist:
-- - given_name, father_name, grandfather_name (replaced by single 'name' field)
-- - is_alive (replaced by 'status')
-- - birth_date, birth_year_hijri (replaced by 'dob_data' JSONB)
-- - death_date, death_year_hijri (replaced by 'dod_data' JSONB)
-- - notes (renamed to 'bio')
--
-- SOLUTION:
-- Replace UPDATE profiles SET section with all current schema fields:
-- - Basic info: name, kunya, nickname, gender, status
-- - Dates: dob_data, dod_data (JSONB)
-- - Contact: phone, email
-- - Location: birth_place, current_residence
-- - Professional: occupation, education, professional_title, title_abbreviation
-- - Identity: family_origin, photo_url, social_media_links
-- - Privacy: dob_is_public, profile_visibility
-- - Bio: bio (replaces notes)
--
-- Keep all safety mechanisms intact:
-- - Advisory locks, version checking, parent validation, idempotency
--
-- Related Documentation: /docs/UNDO_SYSTEM.md, /docs/FIELD_MAPPING.md

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
  -- SCHEMA FIX: Restore old data to match CURRENT profiles schema
  -- ========================================================================
  UPDATE profiles
  SET
    -- Basic information
    name = COALESCE((v_old_data->>'name')::text, name),
    kunya = CASE WHEN v_old_data ? 'kunya' THEN (v_old_data->>'kunya')::text ELSE kunya END,
    nickname = CASE WHEN v_old_data ? 'nickname' THEN (v_old_data->>'nickname')::text ELSE nickname END,
    gender = CASE WHEN v_old_data ? 'gender' THEN (v_old_data->>'gender')::text ELSE gender END,
    status = CASE WHEN v_old_data ? 'status' THEN (v_old_data->>'status')::text ELSE status END,

    -- Date information (JSONB fields)
    dob_data = CASE WHEN v_old_data ? 'dob_data' THEN (v_old_data->'dob_data')::jsonb ELSE dob_data END,
    dod_data = CASE WHEN v_old_data ? 'dod_data' THEN (v_old_data->'dod_data')::jsonb ELSE dod_data END,

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
    social_media_links = CASE WHEN v_old_data ? 'social_media_links' THEN (v_old_data->'social_media_links')::jsonb ELSE social_media_links END,

    -- Arrays and structured data
    achievements = CASE WHEN v_old_data ? 'achievements' THEN ARRAY(SELECT jsonb_array_elements_text(v_old_data->'achievements'))::text[] ELSE achievements END,
    timeline = CASE WHEN v_old_data ? 'timeline' THEN (v_old_data->'timeline')::jsonb ELSE timeline END,

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

-- Update function documentation
COMMENT ON FUNCTION public.undo_profile_update(uuid, text) IS
'Safely undoes a profile update operation with version checking, parent validation, and idempotency.

SCHEMA COMPATIBILITY:
- Updated to match current profiles table schema (v2025-10-15)
- Handles all current fields including JSONB fields (dob_data, dod_data, social_media_links, timeline)
- Gracefully handles missing fields from old audit logs

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations on same audit log entry
- Row-level locks (FOR UPDATE NOWAIT) prevent race conditions during version check
- Parent existence validation prevents creating orphaned profiles
- Idempotency check prevents double-undo operations

PARAMETERS:
- p_audit_log_id: UUID of the audit log entry to undo
- p_undo_reason: Optional text explaining why the undo was performed

RETURNS:
- JSON object with success status and message/error';
