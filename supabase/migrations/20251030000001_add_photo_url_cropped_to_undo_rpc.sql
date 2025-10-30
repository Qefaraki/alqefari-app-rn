/**
 * Migration: Add photo_url_cropped to undo_profile_update whitelist
 * Created: 2025-10-30
 * Purpose: Enable undo system to restore cropped photo variants
 *
 * PROBLEM:
 * - User crops a photo → photo_url_cropped set
 * - User edits profile (other fields) → audit log captures photo_url_cropped
 * - User undos edit → undo_profile_update restores photo_url but NOT photo_url_cropped
 * - Result: Cropped photo persists even though profile was "undone"
 *
 * SOLUTION:
 * Add photo_url_cropped field to undo_profile_update whitelist (line 166+)
 *
 * IMPACT:
 * - Low risk: Only adds field restoration capability
 * - Zero performance impact (single field addition)
 * - Maintains consistency between photo_url and photo_url_cropped
 *
 * TESTING:
 * 1. Crop photo → photo_url_cropped = URL
 * 2. Edit name → audit log captures both photo_url and photo_url_cropped
 * 3. Undo name change → verify both photo fields restored
 * 4. UI should display cropped photo (components prefer photo_url_cropped || photo_url)
 *
 * Related: Phase 4 of Option A crop photo display fix
 */

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
  -- Get current user's profile ID (for permission checking only)
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
  -- Restore old data with JSONB validation
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
    photo_url_cropped = CASE WHEN v_old_data ? 'photo_url_cropped' THEN (v_old_data->>'photo_url_cropped')::text ELSE photo_url_cropped END,  -- ✅ PHASE 4 FIX: Added
    social_media_links = CASE
      WHEN v_old_data ? 'social_media_links'
        AND v_old_data->'social_media_links' IS NOT NULL
        AND jsonb_typeof(v_old_data->'social_media_links') = 'object'
      THEN (v_old_data->'social_media_links')::jsonb
      ELSE social_media_links
    END,

    -- Arrays and structured data
    -- ✅ FIX: Add jsonb_typeof check to prevent "cannot extract elements from a scalar" error
    achievements = CASE
      WHEN v_old_data ? 'achievements' AND jsonb_typeof(v_old_data->'achievements') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(v_old_data->'achievements'))::text[]
      ELSE achievements
    END,
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

    -- Metadata (Use auth.uid() for updated_by)
    version = version + 1,
    updated_at = NOW(),
    updated_by = auth.uid()  -- auth.users.id, not profiles.id
  WHERE id = v_profile_id;

  -- Mark as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR (Compensation Log Record)
  -- CRITICAL FIX: Use auth.uid() for actor_id instead of v_current_user_id
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    old_data, new_data, changed_fields, description, severity, is_undoable
  ) VALUES (
    'profiles', v_profile_id, 'undo_profile_update', auth.uid(),  -- ✅ FIX: auth.uid() instead of v_current_user_id
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
'Safely undoes a profile update with comprehensive validation and error handling.

FIXES APPLIED:
1. PHOTO_URL_CROPPED FIX (v2025-10-30-01):
   - photo_url_cropped now restored during undo (line 167)
   - Maintains consistency between photo_url and photo_url_cropped fields
   - Required for Option A crop display fix (Phase 4)

2. SCALAR ERROR FIX (v2025-10-15-02):
   - achievements field now checks jsonb_typeof() = ''array'' before extraction
   - Prevents "cannot extract elements from a scalar" when old_data contains null
   - Matches proven pattern from batch_save functions

3. FOREIGN KEY FIX (v2025-10-15-01):
   - actor_id in CLR uses auth.uid() (auth.users.id) instead of profiles.id
   - undone_by correctly uses profiles.id (v_current_user_id)
   - Matches audit_log_enhanced_actor_id_fkey constraint

VALIDATION:
- dob_data/dod_data: Only restored if contains hijri OR gregorian
- social_media_links/timeline: Only restored if valid object type
- achievements: Only restored if valid array type
- Invalid JSONB values are skipped, preserving current profile data
- photo_url and photo_url_cropped restored independently (NEW)

SECURITY:
- Uses check_undo_permission() for family-based access control
- Advisory lock prevents concurrent undo attempts
- Version checking prevents overwriting newer changes
- Parent validation ensures restored relationships are valid';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Test that photo_url_cropped is in whitelist
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'undo_profile_update'
  AND routine_definition LIKE '%photo_url_cropped%';
-- Expected: 1 row showing function definition with photo_url_cropped

-- Verify function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'undo_profile_update';
-- Expected: 1 row (FUNCTION)
