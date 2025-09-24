-- Add family origin tracking for Munasib system
-- This allows tracking which families are connected through marriage

-- Add family_origin column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS family_origin TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN profiles.family_origin IS 'For Munasib profiles (null HID): the family name they belong to (e.g., الفريدريكسون)';

-- Create index for efficient family queries
CREATE INDEX IF NOT EXISTS idx_profiles_family_origin
ON profiles(family_origin)
WHERE hid IS NULL;

-- Create index for searching by family origin
CREATE INDEX IF NOT EXISTS idx_profiles_family_origin_search
ON profiles(lower(family_origin))
WHERE family_origin IS NOT NULL;

-- Function to get all marriages to a specific family
CREATE OR REPLACE FUNCTION get_marriages_by_family(p_family_name TEXT)
RETURNS TABLE(
    marriage_id UUID,
    alqefari_member_id UUID,
    alqefari_member_name TEXT,
    alqefari_member_hid TEXT,
    spouse_id UUID,
    spouse_name TEXT,
    spouse_family TEXT,
    marriage_status TEXT,
    marriage_date DATE,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as marriage_id,
        CASE
            WHEN hp.hid IS NOT NULL THEN hp.id
            ELSE wp.id
        END as alqefari_member_id,
        CASE
            WHEN hp.hid IS NOT NULL THEN hp.name
            ELSE wp.name
        END as alqefari_member_name,
        CASE
            WHEN hp.hid IS NOT NULL THEN hp.hid
            ELSE wp.hid
        END as alqefari_member_hid,
        CASE
            WHEN hp.hid IS NULL THEN hp.id
            ELSE wp.id
        END as spouse_id,
        CASE
            WHEN hp.hid IS NULL THEN hp.name
            ELSE wp.name
        END as spouse_name,
        CASE
            WHEN hp.hid IS NULL THEN hp.family_origin
            ELSE wp.family_origin
        END as spouse_family,
        m.status as marriage_status,
        m.start_date as marriage_date,
        m.status = 'married' as is_active
    FROM marriages m
    JOIN profiles hp ON m.husband_id = hp.id
    JOIN profiles wp ON m.wife_id = wp.id
    WHERE
        (hp.family_origin ILIKE '%' || p_family_name || '%' AND hp.hid IS NULL)
        OR
        (wp.family_origin ILIKE '%' || p_family_name || '%' AND wp.hid IS NULL)
    ORDER BY
        m.status = 'married' DESC,
        m.created_at DESC;
END;
$$;

-- Function to get family statistics
CREATE OR REPLACE FUNCTION get_family_connection_stats()
RETURNS TABLE(
    family_name TEXT,
    total_marriages BIGINT,
    active_marriages BIGINT,
    male_spouses BIGINT,
    female_spouses BIGINT,
    generations JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH family_stats AS (
        SELECT
            p.family_origin,
            COUNT(DISTINCT m.id) as total_count,
            COUNT(DISTINCT CASE WHEN m.status = 'married' THEN m.id END) as active_count,
            COUNT(DISTINCT CASE WHEN p.gender = 'male' THEN p.id END) as males,
            COUNT(DISTINCT CASE WHEN p.gender = 'female' THEN p.id END) as females,
            JSON_AGG(DISTINCT
                CASE
                    WHEN hp.hid IS NOT NULL THEN hp.generation
                    ELSE wp.generation
                END
            ) as gens
        FROM profiles p
        LEFT JOIN marriages m ON (m.husband_id = p.id OR m.wife_id = p.id)
        LEFT JOIN profiles hp ON m.husband_id = hp.id
        LEFT JOIN profiles wp ON m.wife_id = wp.id
        WHERE p.family_origin IS NOT NULL
            AND p.hid IS NULL
        GROUP BY p.family_origin
    )
    SELECT
        family_origin as family_name,
        total_count as total_marriages,
        active_count as active_marriages,
        males as male_spouses,
        females as female_spouses,
        gens as generations
    FROM family_stats
    WHERE family_origin IS NOT NULL
    ORDER BY total_count DESC, family_origin;
END;
$$;

-- Function to intelligently extract family name from full name
CREATE OR REPLACE FUNCTION extract_family_name(p_full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_words TEXT[];
    v_family_name TEXT;
    v_last_word TEXT;
BEGIN
    -- Handle null or empty names
    IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
        RETURN NULL;
    END IF;

    -- Split name into words
    v_words := string_to_array(trim(p_full_name), ' ');

    -- Get the last word as family name
    IF array_length(v_words, 1) > 0 THEN
        v_last_word := v_words[array_length(v_words, 1)];

        -- Clean up common prefixes if they're part of the last word
        v_family_name := v_last_word;

        -- If it's a known Al-Qefari variant, return NULL (cousin marriage case)
        IF v_family_name ILIKE '%قفار%' OR
           v_family_name ILIKE '%غفار%' OR
           v_family_name = 'القفاري' OR
           v_family_name = 'الغفاري' THEN
            RETURN NULL;
        END IF;

        RETURN v_family_name;
    END IF;

    RETURN NULL;
END;
$$;

-- Update existing Munasib profiles to extract family names
-- This is a one-time migration to populate family_origin for existing profiles
UPDATE profiles
SET family_origin = extract_family_name(name)
WHERE hid IS NULL
  AND family_origin IS NULL
  AND name IS NOT NULL;