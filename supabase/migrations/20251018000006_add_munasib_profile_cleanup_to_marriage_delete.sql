-- Migration: add_munasib_profile_cleanup_to_marriage_delete
-- Purpose: Auto-delete orphaned munasib profiles and clear parent references from children
-- Behavior: After deleting marriage, if spouse is munasib with no other marriages, delete their profile and clear from children

CREATE OR REPLACE FUNCTION admin_soft_delete_marriage(p_marriage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_marriage marriages%ROWTYPE;
    v_permission TEXT;
    v_husband_profile profiles%ROWTYPE;
    v_wife_profile profiles%ROWTYPE;
    v_husband_other_marriages_count INT;
    v_wife_other_marriages_count INT;
    v_deleted_profile_ids UUID[] := '{}';
BEGIN
    SET search_path = public;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    SELECT * INTO v_marriage
    FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Marriage not found or already deleted');
    END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.husband_id) INTO v_permission;
    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.wife_id) INTO v_permission;
        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to delete this marriage';
        END IF;
    END IF;

    -- STEP 1: Soft-delete the marriage
    UPDATE marriages
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_marriage_id;

    -- STEP 2: Get full profile data for both spouses
    SELECT * INTO v_husband_profile
    FROM profiles
    WHERE id = v_marriage.husband_id;

    SELECT * INTO v_wife_profile
    FROM profiles
    WHERE id = v_marriage.wife_id;

    -- STEP 3: Check for orphaned munasib profiles and clean them up

    -- Check husband: If munasib AND no other active marriages
    IF v_husband_profile.hid IS NULL OR TRIM(v_husband_profile.hid) = '' THEN
        -- Count other active marriages for husband
        SELECT COUNT(*) INTO v_husband_other_marriages_count
        FROM marriages
        WHERE (husband_id = v_marriage.husband_id OR wife_id = v_marriage.husband_id)
          AND id != p_marriage_id
          AND deleted_at IS NULL;

        -- If no other marriages, soft-delete husband profile
        IF v_husband_other_marriages_count = 0 THEN
            UPDATE profiles
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = v_marriage.husband_id;

            v_deleted_profile_ids := array_append(v_deleted_profile_ids, v_marriage.husband_id);

            -- Clear father_id from all children
            UPDATE profiles
            SET father_id = NULL, updated_at = NOW()
            WHERE father_id = v_marriage.husband_id
              AND deleted_at IS NULL;
        END IF;
    END IF;

    -- Check wife: If munasib AND no other active marriages
    IF v_wife_profile.hid IS NULL OR TRIM(v_wife_profile.hid) = '' THEN
        -- Count other active marriages for wife
        SELECT COUNT(*) INTO v_wife_other_marriages_count
        FROM marriages
        WHERE (husband_id = v_marriage.wife_id OR wife_id = v_marriage.wife_id)
          AND id != p_marriage_id
          AND deleted_at IS NULL;

        -- If no other marriages, soft-delete wife profile
        IF v_wife_other_marriages_count = 0 THEN
            UPDATE profiles
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = v_marriage.wife_id;

            v_deleted_profile_ids := array_append(v_deleted_profile_ids, v_marriage.wife_id);

            -- Clear mother_id from all children
            UPDATE profiles
            SET mother_id = NULL, updated_at = NOW()
            WHERE mother_id = v_marriage.wife_id
              AND deleted_at IS NULL;
        END IF;
    END IF;

    -- STEP 4: Audit log
    INSERT INTO audit_log_enhanced (
        table_name, record_id, action_type, actor_id, old_data, new_data, metadata, created_at
    ) VALUES (
        'marriages', p_marriage_id, 'marriage_soft_delete', v_actor_id,
        to_jsonb(v_marriage),
        jsonb_build_object(
            'deleted_at', NOW(),
            'deleted_profile_ids', v_deleted_profile_ids
        ),
        jsonb_build_object(
            'auto_cleaned_profiles', v_deleted_profile_ids
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'marriage_id', p_marriage_id,
        'husband_id', v_marriage.husband_id,
        'wife_id', v_marriage.wife_id,
        'deleted_profile_ids', v_deleted_profile_ids
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'admin_soft_delete_marriage error: %', SQLERRM;
        RAISE;
END;
$$;

-- Update comment
COMMENT ON FUNCTION admin_soft_delete_marriage IS 'Soft deletes marriage with permission checks. Auto-deletes orphaned munasib profiles (hid=NULL, no other marriages) and clears parent references from children. Never deletes Al-Qefari family members (hid IS NOT NULL).';

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_soft_delete_marriage(UUID) TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'MIGRATION 20251018000006: Add Munasib Profile Cleanup';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New Behavior:';
  RAISE NOTICE '  1. Soft-delete marriage';
  RAISE NOTICE '  2. If spouse is munasib (hid = NULL)';
  RAISE NOTICE '  3. AND spouse has no other active marriages';
  RAISE NOTICE '  4. → Soft-delete spouse profile';
  RAISE NOTICE '  5. → Clear father_id/mother_id from children';
  RAISE NOTICE '';
  RAISE NOTICE 'Safety Rules:';
  RAISE NOTICE '  ✅ Never delete Al-Qefari family members (hid IS NOT NULL)';
  RAISE NOTICE '  ✅ Never delete munasib with other marriages';
  RAISE NOTICE '  ✅ Always clear parent references from children';
  RAISE NOTICE '  ✅ All soft-deletes (reversible via undo)';
  RAISE NOTICE '  ✅ Atomic transaction (all or nothing)';
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
END $$;
