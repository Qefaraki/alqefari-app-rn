-- Migration 089: Add family permission checks to admin_update_profile
-- Issue: Current function only allows admins, blocking regular users with 'inner' permission
-- Fix: Use check_family_permission_v4() like admin_update_marriage does
-- Created: 2025-01-14

CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_version INTEGER,
    p_updates JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
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
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this profile. You can only edit your own profile, your spouse, parents, siblings, and descendants.';
    END IF;

    -- Update profile with whitelisted fields
    UPDATE profiles SET
        name = COALESCE((p_updates->>'name')::TEXT, name),
        kunya = CASE WHEN p_updates ? 'kunya' THEN (p_updates->>'kunya')::TEXT ELSE kunya END,
        nickname = CASE WHEN p_updates ? 'nickname' THEN (p_updates->>'nickname')::TEXT ELSE nickname END,
        gender = COALESCE((p_updates->>'gender')::TEXT, gender),
        status = COALESCE((p_updates->>'status')::TEXT, status),
        bio = CASE WHEN p_updates ? 'bio' THEN (p_updates->>'bio')::TEXT ELSE bio END,
        birth_place = CASE WHEN p_updates ? 'birth_place' THEN (p_updates->>'birth_place')::TEXT ELSE birth_place END,
        current_residence = CASE WHEN p_updates ? 'current_residence' THEN (p_updates->>'current_residence')::TEXT ELSE current_residence END,
        occupation = CASE WHEN p_updates ? 'occupation' THEN (p_updates->>'occupation')::TEXT ELSE occupation END,
        education = CASE WHEN p_updates ? 'education' THEN (p_updates->>'education')::TEXT ELSE education END,
        phone = CASE WHEN p_updates ? 'phone' THEN (p_updates->>'phone')::TEXT ELSE phone END,
        email = CASE WHEN p_updates ? 'email' THEN (p_updates->>'email')::TEXT ELSE email END,
        photo_url = CASE WHEN p_updates ? 'photo_url' THEN (p_updates->>'photo_url')::TEXT ELSE photo_url END,
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
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_update_profile(UUID, INTEGER, JSONB) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_update_profile IS
    'Updates profile with family permission checks.
     Only admins, moderators, or users with "inner" permission can edit.
     Inner permission includes: self, spouse, parents, siblings, all descendants.
     Uses check_family_permission_v4 for access control.
     Includes optimistic locking via version parameter.';

-- Verification notice
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 089 complete: Family permissions added to admin_update_profile';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Enhancement:';
    RAISE NOTICE '  - Regular users can now edit profiles they have "inner" permission on';
    RAISE NOTICE '  - Admins still have full access';
    RAISE NOTICE '  - Moderators can edit their assigned branch';
    RAISE NOTICE '  - Permission validated using check_family_permission_v4()';
    RAISE NOTICE '  - Maintains optimistic locking with version parameter';
    RAISE NOTICE '';
    RAISE NOTICE 'Compatible with: TabFamily permission system (Phase 1 UI layer)';
END $$;
