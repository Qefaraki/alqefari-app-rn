-- Add Munasib tracking fields to profiles table
-- This enables proper distinction between family members and married-in spouses

-- Add family_origin field for tracking which family a Munasib is from
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS family_origin TEXT;

-- Add computed columns for easy querying
-- Note: Using DO block to handle cases where columns might already exist
DO $$ 
BEGIN
    -- Check if is_munasib column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_munasib'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN is_munasib BOOLEAN 
        GENERATED ALWAYS AS (hid IS NULL) STORED;
    END IF;

    -- Check if profile_type column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'profile_type'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN profile_type TEXT 
        GENERATED ALWAYS AS (
            CASE WHEN hid IS NULL THEN 'munasib' ELSE 'family' END
        ) STORED;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_munasib 
ON profiles(id) 
WHERE hid IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_family 
ON profiles(id) 
WHERE hid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_family_origin 
ON profiles(family_origin) 
WHERE family_origin IS NOT NULL;

-- Add comment to clarify the distinction
COMMENT ON COLUMN profiles.hid IS 'Hierarchical ID - NULL for Munasib (married-in spouses), populated for family members';
COMMENT ON COLUMN profiles.family_origin IS 'For Munasib profiles: the family name they come from (e.g., القحطاني)';
COMMENT ON COLUMN profiles.is_munasib IS 'TRUE if person married into family (no HID), FALSE if blood family member';
COMMENT ON COLUMN profiles.profile_type IS 'Either "family" (has HID) or "munasib" (no HID)';

-- Create helper function to extract family name from full name
CREATE OR REPLACE FUNCTION extract_family_name(full_name TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Get the last word as family name
    -- Handle NULL or empty names
    IF full_name IS NULL OR full_name = '' THEN
        RETURN NULL;
    END IF;
    
    -- Split by space and get last part
    RETURN SPLIT_PART(TRIM(full_name), ' ', -1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create validation function for Munasib creation
CREATE OR REPLACE FUNCTION validate_munasib_creation(
    p_name TEXT,
    p_spouse_id UUID,
    p_family_origin TEXT DEFAULT NULL
) RETURNS TABLE(
    is_valid BOOLEAN,
    message TEXT,
    similar_profiles UUID[]
) AS $$
DECLARE
    v_similar_profiles UUID[];
    v_normalized_name TEXT;
BEGIN
    -- Normalize the name for comparison
    v_normalized_name := LOWER(TRIM(p_name));
    
    -- Check for similar existing Munasib profiles married to the same person
    SELECT ARRAY_AGG(p.id)
    INTO v_similar_profiles
    FROM profiles p
    JOIN marriages m ON (m.husband_id = p.id OR m.wife_id = p.id)
    WHERE p.hid IS NULL  -- Only check Munasib profiles
    AND (m.husband_id = p_spouse_id OR m.wife_id = p_spouse_id)
    AND LOWER(p.name) SIMILAR TO '%' || v_normalized_name || '%';
    
    IF v_similar_profiles IS NOT NULL AND array_length(v_similar_profiles, 1) > 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            'يوجد شخص بنفس الاسم تقريباً مرتبط بنفس الشخص',
            v_similar_profiles;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            'يمكن إنشاء الملف الشخصي',
            NULL::UUID[];
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION extract_family_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_munasib_creation(TEXT, UUID, TEXT) TO authenticated;