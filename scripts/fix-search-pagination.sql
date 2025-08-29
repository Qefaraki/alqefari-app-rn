-- Fix search pagination by adding stable sort order
CREATE OR REPLACE FUNCTION search_profiles_safe(
    p_query TEXT,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    generation INT,
    gender TEXT,
    photo_url TEXT,
    current_residence TEXT,
    occupation TEXT,
    bio TEXT,
    rank REAL,
    total_count BIGINT
) AS $$
DECLARE
    total BIGINT;
BEGIN
    -- Input validation
    IF LENGTH(TRIM(p_query)) < 2 THEN
        RAISE EXCEPTION 'Search query must be at least 2 characters';
    END IF;
    
    IF p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 100';
    END IF;
    
    -- Get total count for pagination
    SELECT COUNT(*) INTO total
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND (
        p.search_vector @@ plainto_tsquery('arabic', p_query)
        OR p.name ILIKE '%' || p_query || '%'
    );
    
    RETURN QUERY
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.father_id,
        p.generation,
        p.gender,
        p.photo_url,
        p.current_residence,
        p.occupation,
        LEFT(p.bio, 200) as bio,  -- Truncate bio for search results
        ts_rank(p.search_vector, plainto_tsquery('arabic', p_query)) as rank,
        total as total_count
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND (
        p.search_vector @@ plainto_tsquery('arabic', p_query)
        OR p.name ILIKE '%' || p_query || '%'
    )
    ORDER BY rank DESC, p.name, p.id  -- Added p.id for stable sorting
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;