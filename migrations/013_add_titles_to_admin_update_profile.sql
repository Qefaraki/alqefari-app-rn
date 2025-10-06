-- Migration 013: Add professional title fields to admin_update_profile whitelist
-- Issue: Titles don't persist when saving because admin_update_profile ignores them
-- Root cause: UPDATE statement has hardcoded field whitelist, missing title fields
-- Solution: Add professional_title and title_abbreviation to UPDATE statement

DROP FUNCTION IF EXISTS admin_update_profile(UUID, INTEGER, JSONB);

CREATE FUNCTION admin_update_profile(
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
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor for audit
    v_actor_id := auth.uid();

    -- Lock and validate version
    SELECT * INTO v_profile FROM profiles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Check version for optimistic locking
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى';
    END IF;

    -- Update the profile with the updates
    UPDATE profiles SET
        name = COALESCE((p_updates->>'name')::TEXT, name),
        kunya = CASE WHEN p_updates ? 'kunya' THEN (p_updates->>'kunya')::TEXT ELSE kunya END,
        nickname = CASE WHEN p_updates ? 'nickname' THEN (p_updates->>'nickname')::TEXT ELSE nickname END,
        professional_title = CASE WHEN p_updates ? 'professional_title' THEN (p_updates->>'professional_title')::TEXT ELSE professional_title END,        -- ✅ ADDED
        title_abbreviation = CASE WHEN p_updates ? 'title_abbreviation' THEN (p_updates->>'title_abbreviation')::TEXT ELSE title_abbreviation END,        -- ✅ ADDED
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
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_profile;

    -- Return the updated profile
    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION admin_update_profile(UUID, INTEGER, JSONB) IS 'Migration 013: Added professional_title and title_abbreviation to whitelist';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 013 complete:';
  RAISE NOTICE '   - admin_update_profile() now accepts professional_title';
  RAISE NOTICE '   - admin_update_profile() now accepts title_abbreviation';
  RAISE NOTICE '   - Titles will now persist when saving profiles';
END $$;
