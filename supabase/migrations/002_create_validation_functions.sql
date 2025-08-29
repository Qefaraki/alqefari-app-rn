-- Validation Functions for Data Integrity

-- Validate date JSONB structure
CREATE OR REPLACE FUNCTION validate_date_jsonb(date_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- NULL is valid (optional field)
    IF date_data IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check basic structure
    IF jsonb_typeof(date_data) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- Validate Hijri date if present
    IF date_data ? 'hijri' THEN
        IF NOT (
            jsonb_typeof(date_data->'hijri') = 'object' AND
            (date_data->'hijri'->>'year')::INT BETWEEN 1 AND 2000 AND
            (date_data->'hijri'->>'month')::INT BETWEEN 1 AND 12 AND
            (date_data->'hijri'->>'day')::INT BETWEEN 1 AND 30
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate Gregorian date if present
    IF date_data ? 'gregorian' THEN
        IF NOT (
            jsonb_typeof(date_data->'gregorian') = 'object' AND
            (date_data->'gregorian'->>'year')::INT BETWEEN 1800 AND 2200
        ) THEN
            RETURN FALSE;
        END IF;
        
        -- Check month and day if not approximate
        IF NOT (date_data->'gregorian'->>'approximate')::BOOLEAN THEN
            IF NOT (
                (date_data->'gregorian'->>'month')::INT BETWEEN 1 AND 12 AND
                (date_data->'gregorian'->>'day')::INT BETWEEN 1 AND 31
            ) THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- At least one date system should be present
    IF NOT (date_data ? 'hijri' OR date_data ? 'gregorian') THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate social media links JSONB structure
CREATE OR REPLACE FUNCTION validate_social_media_jsonb(links JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    key TEXT;
    value TEXT;
    valid_platforms TEXT[] := ARRAY['twitter', 'x', 'instagram', 'linkedin', 'facebook', 'youtube', 'tiktok', 'snapchat', 'website', 'blog', 'github'];
BEGIN
    -- NULL or empty object is valid
    IF links IS NULL OR links = '{}' THEN
        RETURN TRUE;
    END IF;
    
    -- Must be an object
    IF jsonb_typeof(links) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each entry
    FOR key, value IN SELECT * FROM jsonb_each_text(links)
    LOOP
        -- Check if platform is recognized (case-insensitive)
        IF NOT (LOWER(key) = ANY(valid_platforms)) THEN
            RETURN FALSE;
        END IF;
        
        -- Basic URL validation
        IF NOT (value ~ '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}') THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate timeline JSONB array structure
CREATE OR REPLACE FUNCTION validate_timeline_jsonb(timeline JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    event JSONB;
BEGIN
    -- NULL is valid
    IF timeline IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Must be an array
    IF jsonb_typeof(timeline) != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each event
    FOR event IN SELECT * FROM jsonb_array_elements(timeline)
    LOOP
        IF NOT (
            jsonb_typeof(event) = 'object' AND
            event ? 'year' AND
            event ? 'event' AND
            LENGTH(event->>'event') > 0
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check for circular parent relationships
CREATE OR REPLACE FUNCTION check_no_circular_parents(
    person_id UUID,
    proposed_parent_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    current_id UUID;
    depth INT := 0;
    max_depth INT := 100; -- Prevent infinite loops
BEGIN
    -- Can't be your own parent
    IF person_id = proposed_parent_id THEN
        RETURN FALSE;
    END IF;
    
    -- NULL parent is always valid
    IF proposed_parent_id IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Traverse up from proposed parent to check if we encounter person_id
    current_id := proposed_parent_id;
    
    WHILE current_id IS NOT NULL AND depth < max_depth LOOP
        -- Check if we've circled back
        IF current_id = person_id THEN
            RETURN FALSE;
        END IF;
        
        -- Move up to parent
        SELECT father_id INTO current_id
        FROM profiles
        WHERE id = current_id AND deleted_at IS NULL;
        
        depth := depth + 1;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Validate generation consistency
CREATE OR REPLACE FUNCTION validate_generation_hierarchy(
    person_id UUID,
    new_generation INT,
    new_father_id UUID,
    new_mother_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    father_generation INT;
    mother_generation INT;
    child_generation INT;
    min_child_generation INT;
BEGIN
    -- Get father's generation
    IF new_father_id IS NOT NULL THEN
        SELECT generation INTO father_generation
        FROM profiles
        WHERE id = new_father_id AND deleted_at IS NULL;
        
        -- Father must be from earlier generation
        IF father_generation >= new_generation THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Get mother's generation
    IF new_mother_id IS NOT NULL THEN
        SELECT generation INTO mother_generation
        FROM profiles
        WHERE id = new_mother_id AND deleted_at IS NULL;
        
        -- Mother must be from earlier generation
        IF mother_generation >= new_generation THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check children's generations (if updating existing person)
    IF person_id IS NOT NULL THEN
        SELECT MIN(generation) INTO min_child_generation
        FROM profiles
        WHERE (father_id = person_id OR mother_id = person_id)
        AND deleted_at IS NULL;
        
        -- All children must be from later generation
        IF min_child_generation IS NOT NULL AND min_child_generation <= new_generation THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraints to profiles table
ALTER TABLE profiles 
  ADD CONSTRAINT check_dob_data CHECK (validate_date_jsonb(dob_data)),
  ADD CONSTRAINT check_dod_data CHECK (validate_date_jsonb(dod_data)),
  ADD CONSTRAINT check_social_media CHECK (validate_social_media_jsonb(social_media_links)),
  ADD CONSTRAINT check_timeline CHECK (validate_timeline_jsonb(timeline));

-- Create function to format date for display
CREATE OR REPLACE FUNCTION format_date_display(date_data JSONB)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    hijri_year INT;
    gregorian_year INT;
    is_approximate BOOLEAN;
BEGIN
    IF date_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get Hijri year
    IF date_data ? 'hijri' THEN
        hijri_year := (date_data->'hijri'->>'year')::INT;
        result := hijri_year || 'هـ';
    END IF;
    
    -- Get Gregorian year
    IF date_data ? 'gregorian' THEN
        gregorian_year := (date_data->'gregorian'->>'year')::INT;
        is_approximate := COALESCE((date_data->'gregorian'->>'approximate')::BOOLEAN, FALSE);
        
        IF result IS NOT NULL THEN
            result := result || ' / ';
        END IF;
        
        IF is_approximate THEN
            result := COALESCE(result, '') || '~' || gregorian_year || 'م';
        ELSE
            result := COALESCE(result, '') || gregorian_year || 'م';
        END IF;
    END IF;
    
    -- Use custom display if provided
    IF date_data ? 'display' THEN
        result := date_data->>'display';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to validate parent relationships
CREATE OR REPLACE FUNCTION validate_parent_relationship_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Check circular relationships for father
    IF NEW.father_id IS NOT NULL THEN
        IF NOT check_no_circular_parents(NEW.id, NEW.father_id) THEN
            RAISE EXCEPTION 'Circular parent relationship detected with father';
        END IF;
    END IF;
    
    -- Check circular relationships for mother
    IF NEW.mother_id IS NOT NULL THEN
        IF NOT check_no_circular_parents(NEW.id, NEW.mother_id) THEN
            RAISE EXCEPTION 'Circular parent relationship detected with mother';
        END IF;
    END IF;
    
    -- Validate generation hierarchy
    IF NOT validate_generation_hierarchy(NEW.id, NEW.generation, NEW.father_id, NEW.mother_id) THEN
        RAISE EXCEPTION 'Generation hierarchy violation: parents must be from earlier generation, children from later';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_profiles_parents
    BEFORE INSERT OR UPDATE OF father_id, mother_id, generation
    ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION validate_parent_relationship_trigger();