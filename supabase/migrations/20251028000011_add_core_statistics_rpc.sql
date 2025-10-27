-- Migration: Add Core Statistics RPC
-- Purpose: Fast, reliable statistics (gender + generations)
-- Timeout: 2 seconds (strict)
-- Guarantees: Always returns data (critical for modal load)

CREATE OR REPLACE FUNCTION admin_get_core_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_role text;
BEGIN
  -- Set timeout protection (2 seconds for core stats)
  SET LOCAL statement_timeout = '2000';

  -- Permission check: Require admin role
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF user_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Calculate core statistics
  WITH
  gender_stats AS (
    SELECT
      COUNT(CASE WHEN gender = 'male' THEN 1 END) as male,
      COUNT(CASE WHEN gender = 'female' THEN 1 END) as female,
      COUNT(*) as total
    FROM profiles
    WHERE deleted_at IS NULL
  ),
  generation_stats AS (
    SELECT
      generation,
      COUNT(*) as count,
      COUNT(CASE WHEN gender = 'male' THEN 1 END) as male,
      COUNT(CASE WHEN gender = 'female' THEN 1 END) as female
    FROM profiles
    WHERE hid IS NOT NULL AND deleted_at IS NULL
    GROUP BY generation
    ORDER BY generation
  ),
  vital_stats AS (
    SELECT
      COUNT(CASE WHEN status = 'alive' THEN 1 END) as living,
      COUNT(CASE WHEN status = 'deceased' THEN 1 END) as deceased
    FROM profiles
    WHERE deleted_at IS NULL
  ),
  data_quality_stats AS (
    SELECT
      COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) as with_photos,
      COUNT(CASE WHEN dob_data IS NOT NULL THEN 1 END) as with_birthdates,
      COUNT(*) as total_profiles
    FROM profiles
    WHERE deleted_at IS NULL
  )
  SELECT json_build_object(
    'gender', (SELECT row_to_json(g) FROM gender_stats g),
    'generations', (SELECT json_agg(gen ORDER BY gen.generation) FROM generation_stats gen),
    'vital_status', (SELECT row_to_json(v) FROM vital_stats v),
    'data_quality', (SELECT row_to_json(dq) FROM data_quality_stats dq),
    'calculated_at', NOW()
  ) INTO result;

  RETURN result;

EXCEPTION
  WHEN statement_timeout THEN
    RAISE EXCEPTION 'Core statistics calculation timeout (>2 seconds)';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to calculate core statistics: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (permission check inside function)
GRANT EXECUTE ON FUNCTION admin_get_core_statistics() TO authenticated;

-- Comment on function
COMMENT ON FUNCTION admin_get_core_statistics() IS 'Returns core family statistics (gender, generations, vital status) with 2-second timeout. Admin-only.';
