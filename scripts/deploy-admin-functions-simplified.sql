-- Simplified admin functions without role checking for mock data generation

-- Create sequence for efficient HID generation
CREATE SEQUENCE IF NOT EXISTS hid_counter START WITH 1;

-- Function to generate next HID efficiently
CREATE OR REPLACE FUNCTION generate_next_hid(parent_hid TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    next_sibling_num INT;
BEGIN
    IF parent_hid IS NULL THEN
        -- Root level node
        RETURN 'R' || nextval('hid_counter');
    ELSE
        -- Get next sibling number efficiently
        SELECT COALESCE(MAX(
            CAST(
                SUBSTRING(hid FROM LENGTH(parent_hid) + 2) 
                AS INTEGER
            )
        ), 0) + 1
        INTO next_sibling_num
        FROM profiles
        WHERE hid LIKE parent_hid || '.%'
        AND hid NOT LIKE parent_hid || '.%.%'
        AND deleted_at IS NULL;
        
        RETURN parent_hid || '.' || next_sibling_num;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create layout recalculation queue table
CREATE TABLE IF NOT EXISTS layout_recalc_queue (
    node_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    queued_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT
);

-- Simplified admin create profile function (no role checking)
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_generation INT DEFAULT 1,
    p_sibling_order INT DEFAULT 0,
    p_status TEXT DEFAULT 'alive',
    p_dob_data JSONB DEFAULT NULL,
    p_dod_data JSONB DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_birth_place TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_education TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_social_media_links JSONB DEFAULT '{}'::JSONB,
    p_achievements TEXT[] DEFAULT NULL,
    p_timeline JSONB DEFAULT NULL,
    p_dob_is_public BOOLEAN DEFAULT true,
    p_profile_visibility TEXT DEFAULT 'public'
)
RETURNS JSONB AS $$
DECLARE
    new_profile profiles;
    new_hid TEXT;
    parent_hid TEXT;
    max_sibling_order INT;
    validation_error TEXT;
    new_id UUID;
BEGIN
    -- Validate input parameters
    IF LENGTH(TRIM(p_name)) = 0 THEN
        RAISE EXCEPTION 'Name cannot be empty';
    END IF;
    
    IF p_gender NOT IN ('male', 'female') THEN
        RAISE EXCEPTION 'Gender must be either male or female';
    END IF;
    
    IF p_generation < 1 THEN
        RAISE EXCEPTION 'Generation must be positive';
    END IF;
    
    -- Validate parent exists and get parent's HID
    IF p_father_id IS NOT NULL THEN
        SELECT hid, generation INTO parent_hid
        FROM profiles
        WHERE id = p_father_id AND deleted_at IS NULL;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Father not found';
        END IF;
    END IF;
    
    -- Generate HID efficiently
    new_hid := generate_next_hid(parent_hid);
    new_id := gen_random_uuid();
    
    -- Get sibling order if not provided
    IF p_sibling_order = 0 AND p_father_id IS NOT NULL THEN
        SELECT COALESCE(MAX(sibling_order), 0) + 1
        INTO p_sibling_order
        FROM profiles
        WHERE father_id = p_father_id AND deleted_at IS NULL;
    END IF;
    
    -- Insert the new profile
    INSERT INTO profiles (
        id, name, gender, father_id, generation, hid, sibling_order,
        status, dob_data, dod_data, photo_url, bio, birth_place,
        current_residence, occupation, education, phone, email,
        social_media_links, achievements, timeline,
        dob_is_public, profile_visibility
    )
    VALUES (
        new_id, TRIM(p_name), p_gender, p_father_id, p_generation, new_hid, p_sibling_order,
        p_status, p_dob_data, p_dod_data, p_photo_url, p_bio, p_birth_place,
        p_current_residence, p_occupation, p_education, p_phone, p_email,
        p_social_media_links, p_achievements, p_timeline,
        p_dob_is_public, p_profile_visibility
    )
    RETURNING * INTO new_profile;
    
    -- Update parent's descendants count
    IF p_father_id IS NOT NULL THEN
        UPDATE profiles 
        SET descendants_count = descendants_count + 1
        WHERE id = p_father_id;
    END IF;
    
    -- Return the new profile ID and HID
    RETURN jsonb_build_object(
        'id', new_profile.id,
        'hid', new_profile.hid,
        'name', new_profile.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplified admin create marriage function
CREATE OR REPLACE FUNCTION admin_create_marriage(
    p_husband_id UUID,
    p_wife_id UUID,
    p_status TEXT DEFAULT 'married',
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_munasib TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_marriage marriages;
    marriage_id UUID;
BEGIN
    -- Validate inputs
    IF p_husband_id IS NULL OR p_wife_id IS NULL THEN
        RAISE EXCEPTION 'Both husband and wife IDs are required';
    END IF;
    
    -- Check if husband exists and is male
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_husband_id 
        AND gender = 'male'
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Husband not found or not male';
    END IF;
    
    -- Check if wife exists and is female
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_wife_id 
        AND gender = 'female'
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Wife not found or not female';
    END IF;
    
    -- Check for duplicate marriage
    IF EXISTS (
        SELECT 1 FROM marriages
        WHERE husband_id = p_husband_id
        AND wife_id = p_wife_id
    ) THEN
        RAISE EXCEPTION 'Marriage already exists between these persons';
    END IF;
    
    marriage_id := gen_random_uuid();
    
    -- Insert marriage
    INSERT INTO marriages (
        id, husband_id, wife_id, status, start_date, end_date, munasib
    )
    VALUES (
        marriage_id, p_husband_id, p_wife_id, 
        p_status, p_start_date, p_end_date, p_munasib
    )
    RETURNING * INTO new_marriage;
    
    -- Return the new marriage
    RETURN jsonb_build_object(
        'id', new_marriage.id,
        'husband_id', new_marriage.husband_id,
        'wife_id', new_marriage.wife_id,
        'status', new_marriage.status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin validation dashboard function
CREATE OR REPLACE FUNCTION admin_validation_dashboard()
RETURNS TABLE(check_name TEXT, status TEXT, count INT, details TEXT) AS $$
BEGIN
    -- Check 1: Profiles with invalid dates
    RETURN QUERY
    SELECT 
        'Invalid date formats'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found profiles with invalid date data' END
    FROM profiles
    WHERE deleted_at IS NULL
    AND (
        (dob_data IS NOT NULL AND NOT validate_date_data(dob_data)) OR
        (dod_data IS NOT NULL AND NOT validate_date_data(dod_data))
    );
    
    -- Check 2: Missing required fields
    RETURN QUERY
    SELECT 
        'Missing required fields'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found profiles with missing required fields' END
    FROM profiles
    WHERE deleted_at IS NULL
    AND (
        name IS NULL OR 
        gender IS NULL OR 
        generation IS NULL OR
        hid IS NULL
    );
    
    -- Check 3: HID duplicates
    RETURN QUERY
    SELECT 
        'Duplicate HIDs'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found duplicate HIDs' END
    FROM (
        SELECT hid, COUNT(*) as cnt
        FROM profiles
        WHERE deleted_at IS NULL
        GROUP BY hid
        HAVING COUNT(*) > 1
    ) dupes;
    
    -- Check 4: Generation hierarchy violations
    RETURN QUERY
    WITH parent_child AS (
        SELECT 
            c.id,
            c.generation as child_gen,
            p.generation as parent_gen
        FROM profiles c
        JOIN profiles p ON c.father_id = p.id
        WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL
    )
    SELECT 
        'Generation hierarchy violations'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found children with generation <= parent' END
    FROM parent_child
    WHERE child_gen <= parent_gen;
    
    -- Check 5: Orphaned nodes
    RETURN QUERY
    SELECT 
        'Orphaned nodes'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found nodes with invalid parent references' END
    FROM profiles c
    WHERE c.deleted_at IS NULL
    AND c.father_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = c.father_id 
        AND p.deleted_at IS NULL
    );
    
    -- Check 6: Invalid marriages
    RETURN QUERY
    SELECT 
        'Invalid marriages'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::INT,
        CASE WHEN COUNT(*) = 0 THEN NULL ELSE 'Found marriages with missing or invalid spouses' END
    FROM marriages m
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles h 
        WHERE h.id = m.husband_id 
        AND h.gender = 'male'
        AND h.deleted_at IS NULL
    ) OR NOT EXISTS (
        SELECT 1 FROM profiles w 
        WHERE w.id = m.wife_id 
        AND w.gender = 'female'
        AND w.deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;