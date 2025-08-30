-- Fix admin_create_marriage to properly cast text dates to DATE type

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
    
    -- Insert marriage with proper date casting
    INSERT INTO marriages (
        id, husband_id, wife_id, status, start_date, end_date, munasib
    )
    VALUES (
        marriage_id, 
        p_husband_id, 
        p_wife_id, 
        p_status, 
        CASE WHEN p_start_date IS NOT NULL THEN p_start_date::DATE ELSE NULL END,
        CASE WHEN p_end_date IS NOT NULL THEN p_end_date::DATE ELSE NULL END,
        p_munasib
    )
    RETURNING * INTO new_marriage;
    
    -- Return the new marriage
    RETURN jsonb_build_object(
        'id', new_marriage.id,
        'husband_id', new_marriage.husband_id,
        'wife_id', new_marriage.wife_id,
        'status', new_marriage.status,
        'start_date', new_marriage.start_date,
        'end_date', new_marriage.end_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;