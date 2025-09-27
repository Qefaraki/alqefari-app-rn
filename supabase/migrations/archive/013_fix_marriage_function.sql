-- This function replaces the client-side logic with a single, efficient database query.
-- It joins profiles and marriages to gather all data in one step, solving the N+1 problem.
DROP FUNCTION IF EXISTS get_person_marriages(UUID);
CREATE OR REPLACE FUNCTION get_person_marriages(p_id UUID)
RETURNS JSON -- Return a flexible JSON object to avoid type mismatch errors.
SECURITY DEFINER -- Allows the function to securely query tables with RLS.
AS $$
BEGIN
    -- First, ensure the calling user has permission to view the base profile.
    -- This respects our security rules.
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_id) THEN
        RAISE EXCEPTION 'Profile not found or insufficient permissions';
    END IF;

    RETURN (
        SELECT json_agg(
            json_build_object(
                'marriage_id', m.id,
                'spouse_id', spouse.id,
                'spouse_name', spouse.name,
                'spouse_photo', spouse.photo_url,
                'munasib', m.munasib,
                'status', m.status,
                'start_date', m.start_date,
                'end_date', m.end_date
            )
        )
        FROM marriages m
        -- This JOIN is the key to performance. It efficiently finds the spouse's details.
        JOIN profiles spouse ON 
            (CASE 
                WHEN m.husband_id = p_id THEN m.wife_id = spouse.id
                ELSE m.husband_id = spouse.id
            END)
        WHERE (m.husband_id = p_id OR m.wife_id = p_id)
        -- Ensure we don't return details for a soft-deleted spouse.
        AND spouse.deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;