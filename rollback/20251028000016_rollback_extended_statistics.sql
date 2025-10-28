-- Rollback Migration: Restore Extended Statistics RPC to Pre-Fix State
-- Created: October 28, 2025
-- Purpose: Emergency rollback if migration 000013 causes issues

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
      SPLIT_PART(name, ' ', 1) as name,
      COUNT(*) as count
    FROM profiles
    WHERE gender = 'male' AND deleted_at IS NULL AND name IS NOT NULL
    GROUP BY SPLIT_PART(name, ' ', 1)
    ORDER BY count DESC, name ASC
    LIMIT 10
  ),
  top_female_names AS (
    SELECT
      SPLIT_PART(name, ' ', 1) as name,
      COUNT(*) as count
    FROM profiles
    WHERE gender = 'female' AND deleted_at IS NULL AND name IS NOT NULL
    GROUP BY SPLIT_PART(name, ' ', 1)
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
      COUNT(*) as total_munasib,
      COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_munasib,
      COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_munasib
    FROM profiles
    WHERE hid IS NULL AND deleted_at IS NULL
  ),
  marriage_stats AS (
    SELECT
      COUNT(*) as total_marriages,
      COUNT(CASE WHEN status = 'current' THEN 1 END) as current_marriages,
      COUNT(CASE WHEN status = 'past' THEN 1 END) as past_marriages
    FROM marriages
    WHERE deleted_at IS NULL
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
COMMENT ON FUNCTION admin_get_extended_statistics() IS 'ROLLBACK VERSION: Returns extended family statistics without Unicode normalization or marriage status filter';
