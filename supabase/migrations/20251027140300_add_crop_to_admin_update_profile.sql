-- Migration: Add crop fields to admin_update_profile() whitelist
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Allow updating crop fields via main admin_update_profile() RPC
-- Related: Field Mapping Checklist step 3 (docs/FIELD_MAPPING.md)

-- ============================================================================
-- UPDATE: admin_update_profile - Add crop field support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_id UUID,
  p_version INTEGER,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_profile profiles;
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_permission TEXT;
BEGIN
    -- Get current user's auth ID
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- Get actor's profile ID
    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    -- Lock and validate profile exists
    SELECT * INTO v_profile FROM profiles WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or deleted';
    END IF;

    -- Check version for optimistic locking
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى';
    END IF;

    -- Permission check: Use family permission system
    SELECT check_family_permission_v4(v_actor_profile_id, p_id) INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this profile';
    END IF;

    -- Update profile with whitelisted fields (including NEW crop fields)
    UPDATE profiles SET
        name = COALESCE((p_updates->>'name')::TEXT, name),
        kunya = CASE WHEN p_updates ? 'kunya' THEN (p_updates->>'kunya')::TEXT ELSE kunya END,
        nickname = CASE WHEN p_updates ? 'nickname' THEN (p_updates->>'nickname')::TEXT ELSE nickname END,
        gender = COALESCE((p_updates->>'gender')::TEXT, gender),
        status = COALESCE((p_updates->>'status')::TEXT, status),
        bio = CASE WHEN p_updates ? 'bio' THEN (p_updates->>'bio')::TEXT ELSE bio END,
        birth_place = CASE WHEN p_updates ? 'birth_place' THEN (p_updates->>'birth_place')::TEXT ELSE birth_place END,
        birth_place_normalized = CASE WHEN p_updates ? 'birth_place_normalized' THEN (p_updates->'birth_place_normalized')::JSONB ELSE birth_place_normalized END,
        current_residence = CASE WHEN p_updates ? 'current_residence' THEN (p_updates->>'current_residence')::TEXT ELSE current_residence END,
        current_residence_normalized = CASE WHEN p_updates ? 'current_residence_normalized' THEN (p_updates->'current_residence_normalized')::JSONB ELSE current_residence_normalized END,
        occupation = CASE WHEN p_updates ? 'occupation' THEN (p_updates->>'occupation')::TEXT ELSE occupation END,
        education = CASE WHEN p_updates ? 'education' THEN (p_updates->>'education')::TEXT ELSE education END,
        phone = CASE WHEN p_updates ? 'phone' THEN (p_updates->>'phone')::TEXT ELSE phone END,
        email = CASE WHEN p_updates ? 'email' THEN (p_updates->>'email')::TEXT ELSE email END,
        photo_url = CASE WHEN p_updates ? 'photo_url' THEN (p_updates->>'photo_url')::TEXT ELSE photo_url END,
        original_photo_url = CASE WHEN p_updates ? 'original_photo_url' THEN (p_updates->>'original_photo_url')::TEXT ELSE original_photo_url END,
        crop_metadata = CASE WHEN p_updates ? 'crop_metadata' THEN (p_updates->'crop_metadata')::JSONB ELSE crop_metadata END,
        dob_data = CASE WHEN p_updates ? 'dob_data' THEN (p_updates->'dob_data')::JSONB ELSE dob_data END,
        dod_data = CASE WHEN p_updates ? 'dod_data' THEN (p_updates->'dod_data')::JSONB ELSE dod_data END,
        social_media_links = CASE WHEN p_updates ? 'social_media_links' THEN (p_updates->'social_media_links')::JSONB ELSE social_media_links END,
        achievements = CASE WHEN p_updates ? 'achievements' THEN ARRAY(SELECT jsonb_array_elements_text(p_updates->'achievements')) ELSE achievements END,
        timeline = CASE WHEN p_updates ? 'timeline' THEN (p_updates->'timeline')::JSONB ELSE timeline END,
        dob_is_public = CASE WHEN p_updates ? 'dob_is_public' THEN (p_updates->>'dob_is_public')::BOOLEAN ELSE dob_is_public END,
        profile_visibility = CASE WHEN p_updates ? 'profile_visibility' THEN (p_updates->>'profile_visibility')::TEXT ELSE profile_visibility END,
        sibling_order = CASE WHEN p_updates ? 'sibling_order' THEN (p_updates->>'sibling_order')::INTEGER ELSE sibling_order END,
        father_id = CASE WHEN p_updates ? 'father_id' THEN (p_updates->>'father_id')::UUID ELSE father_id END,
        mother_id = CASE WHEN p_updates ? 'mother_id' THEN (p_updates->>'mother_id')::UUID ELSE mother_id END,
        role = CASE WHEN p_updates ? 'role' THEN (p_updates->>'role')::TEXT ELSE role END,
        family_origin = CASE WHEN p_updates ? 'family_origin' THEN (p_updates->>'family_origin')::TEXT ELSE family_origin END,

        -- ============================================================================
        -- NEW: Crop field support (added 2025-10-27)
        -- ============================================================================
        crop_top = CASE WHEN p_updates ? 'crop_top' THEN (p_updates->>'crop_top')::NUMERIC(4,3) ELSE crop_top END,
        crop_bottom = CASE WHEN p_updates ? 'crop_bottom' THEN (p_updates->>'crop_bottom')::NUMERIC(4,3) ELSE crop_bottom END,
        crop_left = CASE WHEN p_updates ? 'crop_left' THEN (p_updates->>'crop_left')::NUMERIC(4,3) ELSE crop_left END,
        crop_right = CASE WHEN p_updates ? 'crop_right' THEN (p_updates->>'crop_right')::NUMERIC(4,3) ELSE crop_right END,

        updated_at = NOW(),
        updated_by = v_actor_id,
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_profile;

    -- Return updated profile
    RETURN to_jsonb(v_profile);

EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'admin_update_profile error: %', SQLERRM;
        RAISE;
END;
$function$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION admin_update_profile IS
  'Main profile update RPC with field whitelist. Now includes crop_top/bottom/left/right support (2025-10-27).';

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================

-- Update crop via main RPC:
-- SELECT * FROM admin_update_profile(
--   p_id := 'profile-uuid',
--   p_version := 5,
--   p_updates := '{"crop_top": 0.1, "crop_bottom": 0.2, "crop_left": 0.05, "crop_right": 0.05}'::jsonb
-- );

-- Note: For atomic 4-field crop updates with validation, use admin_update_profile_crop() instead
