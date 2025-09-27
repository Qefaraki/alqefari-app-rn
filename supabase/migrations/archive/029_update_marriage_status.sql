-- Update marriages table to better track marriage status
-- This allows distinguishing between current and divorced wives

-- First, let's check the current status column constraint
-- The existing constraint already includes 'divorced' status
-- Status options: 'married', 'divorced', 'widowed'

-- Add a new column to track if this is the current/active marriage
ALTER TABLE marriages 
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- Add index for faster queries on current marriages
CREATE INDEX IF NOT EXISTS idx_marriages_is_current 
ON marriages(husband_id, is_current) 
WHERE is_current = true;

-- Add comment explaining the field
COMMENT ON COLUMN marriages.is_current IS 
'Indicates if this is a current active marriage. False for historical/divorced marriages. Used for privacy - only shown to admins.';

-- Update existing marriages to set is_current based on status
UPDATE marriages 
SET is_current = CASE 
    WHEN status = 'married' THEN true
    ELSE false
END
WHERE is_current IS NULL;

-- Create a function to get a person's wives (admin only)
CREATE OR REPLACE FUNCTION admin_get_person_wives(p_person_id UUID)
RETURNS TABLE (
    id UUID,
    wife_id UUID,
    wife_name TEXT,
    status TEXT,
    is_current BOOLEAN,
    start_date DATE,
    end_date DATE,
    children_count BIGINT
) 
SECURITY DEFINER
AS $$
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    RETURN QUERY
    SELECT 
        m.id,
        m.wife_id,
        p.name as wife_name,
        m.status,
        m.is_current,
        m.start_date,
        m.end_date,
        COUNT(DISTINCT c.id) as children_count
    FROM marriages m
    INNER JOIN profiles p ON p.id = m.wife_id
    LEFT JOIN profiles c ON c.mother_id = m.wife_id AND c.father_id = p_person_id
    WHERE m.husband_id = p_person_id
    GROUP BY m.id, m.wife_id, p.name, m.status, m.is_current, m.start_date, m.end_date
    ORDER BY m.is_current DESC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get person's mothers for their children
-- This is for public use - shows mothers of children without revealing marriage status
CREATE OR REPLACE FUNCTION get_children_mothers(p_father_id UUID)
RETURNS TABLE (
    mother_id UUID,
    mother_name TEXT,
    children_count BIGINT,
    children JSONB
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as mother_id,
        m.name as mother_name,
        COUNT(c.id) as children_count,
        jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'gender', c.gender
            ) ORDER BY c.sibling_order
        ) as children
    FROM profiles c
    INNER JOIN profiles m ON m.id = c.mother_id
    WHERE c.father_id = p_father_id
        AND c.deleted_at IS NULL
        AND m.deleted_at IS NULL
    GROUP BY m.id, m.name
    ORDER BY COUNT(c.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_children_mothers TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_person_wives TO authenticated;