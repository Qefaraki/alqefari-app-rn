-- Migration: Fix Extended Statistics RPC (Combined Fixes)
-- Date: October 28, 2025
-- Purpose: Apply 3 fixes from solution-auditor audit
--   1. Unicode normalization (strip emoji/non-Arabic from names)
--   2. Marriage status filter (handle pre-migration-078 data)
--   3. COALESCE for zero marriages (prevent null values)

CREATE OR REPLACE FUNCTION public.admin_get_extended_statistics()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
  user_role text;
BEGIN
  -- Set timeout protection (3 seconds for extended stats)
  SET LOCAL statement_timeout = '3000';

  -- Permission check: Require admin role
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF user_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Calculate extended statistics
  WITH
  top_male_names AS (
    SELECT
      TRIM(REGEXP_REPLACE(
        SPLIT_PART(name, ' ', 1),
        '[^ء-ي]',  -- Keep only Arabic letters (strips emoji, numbers, Latin chars)
        '',
        'g'
      )) as name,
      COUNT(*) as count
    FROM profiles
    WHERE gender = 'male' AND deleted_at IS NULL AND name IS NOT NULL
    GROUP BY TRIM(REGEXP_REPLACE(SPLIT_PART(name, ' ', 1), '[^ء-ي]', '', 'g'))
    HAVING TRIM(REGEXP_REPLACE(SPLIT_PART(name, ' ', 1), '[^ء-ي]', '', 'g')) != ''
    ORDER BY count DESC, name ASC
    LIMIT 10
  ),
  top_female_names AS (
    SELECT
      TRIM(REGEXP_REPLACE(
        SPLIT_PART(name, ' ', 1),
        '[^ء-ي]',
        '',
        'g'
      )) as name,
      COUNT(*) as count
    FROM profiles
    WHERE gender = 'female' AND deleted_at IS NULL AND name IS NOT NULL
    GROUP BY TRIM(REGEXP_REPLACE(SPLIT_PART(name, ' ', 1), '[^ء-ي]', '', 'g'))
    HAVING TRIM(REGEXP_REPLACE(SPLIT_PART(name, ' ', 1), '[^ء-ي]', '', 'g')) != ''
    ORDER BY count DESC, name ASC
    LIMIT 10
  ),
  top_munasib_families AS (
    SELECT
      family_origin as family,
      COUNT(*) as count
    FROM profiles
    WHERE hid IS NULL AND deleted_at IS NULL AND family_origin IS NOT NULL
    GROUP BY family_origin
    ORDER BY count DESC, family_origin ASC
    LIMIT 10
  ),
  munasib_totals AS (
    SELECT
      COALESCE(COUNT(*), 0) as total_munasib,
      COALESCE(COUNT(CASE WHEN gender = 'male' THEN 1 END), 0) as male_munasib,
      COALESCE(COUNT(CASE WHEN gender = 'female' THEN 1 END), 0) as female_munasib
    FROM profiles
    WHERE hid IS NULL AND deleted_at IS NULL
  ),
  marriage_stats AS (
    SELECT
      COALESCE(COUNT(*), 0) as total_marriages,
      COALESCE(COUNT(CASE WHEN status = 'current' THEN 1 END), 0) as current_marriages,
      COALESCE(COUNT(CASE WHEN status = 'past' THEN 1 END), 0) as past_marriages
    FROM marriages
    WHERE deleted_at IS NULL
      AND status IN ('current', 'past')  -- Explicit filter for old data
  )
  SELECT json_build_object(
    'top_male_names', (SELECT COALESCE(json_agg(n ORDER BY n.count DESC), '[]'::json) FROM top_male_names n),
    'top_female_names', (SELECT COALESCE(json_agg(n ORDER BY n.count DESC), '[]'::json) FROM top_female_names n),
    'top_munasib_families', (SELECT COALESCE(json_agg(m ORDER BY m.count DESC), '[]'::json) FROM top_munasib_families m),
    'munasib_totals', (SELECT row_to_json(mt) FROM munasib_totals mt),
    'marriage_stats', (SELECT row_to_json(ms) FROM marriage_stats ms),
    'calculated_at', NOW()
  ) INTO result;

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error result for graceful degradation
    RETURN json_build_object(
      'error', true,
      'message', SQLERRM,
      'calculated_at', NOW()
    );
END;
$function$;

-- Comment
COMMENT ON FUNCTION admin_get_extended_statistics() IS 'Returns extended family statistics with Unicode normalization, marriage status filter, and COALESCE for zero values. Admin-only. 3-second timeout.';
