-- Migration 084a: Batch Permission Check Helper
-- Purpose: Optimize cascade delete permission validation

CREATE OR REPLACE FUNCTION check_cascade_delete_permissions(
    p_actor_profile_id UUID,
    p_profile_ids UUID[]
)
RETURNS TABLE(profile_id UUID, permission_level TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_role TEXT;
BEGIN
    -- Early exit for admins (skip expensive checks)
    SELECT role INTO v_actor_role
    FROM profiles
    WHERE id = p_actor_profile_id;

    IF v_actor_role IN ('admin', 'super_admin') THEN
        RETURN QUERY
        SELECT id, 'admin'::TEXT
        FROM UNNEST(p_profile_ids) AS id;
        RETURN;
    END IF;

    -- Batch permission check using lateral join
    RETURN QUERY
    SELECT
        p.id,
        check_family_permission_v4(p_actor_profile_id, p.id)
    FROM UNNEST(p_profile_ids) AS p(id);
END;
$$;

COMMENT ON FUNCTION check_cascade_delete_permissions IS
'Batch permission validation for cascade deletes. Returns permission level for each profile ID.';
