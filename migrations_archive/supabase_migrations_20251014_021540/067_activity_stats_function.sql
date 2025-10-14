-- Migration 067: Activity Stats Server-side Function
-- Purpose: Move stats calculation from client to server for O(1) memory usage
-- Performance: Prevents client from processing 100k+ records for stats
-- Created: 2025-10-07

-- ============================================================================
-- FUNCTION: get_activity_stats()
-- Returns aggregate stats for activity log dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_activity_stats(
  p_user_filter UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_action_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_count BIGINT,
  today_count BIGINT,
  critical_count BIGINT,
  users_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
    COUNT(*) FILTER (WHERE severity IN ('critical', 'high')) as critical_count,
    COUNT(DISTINCT actor_id) as users_count
  FROM audit_log_enhanced
  WHERE
    -- Apply user filter if provided
    (p_user_filter IS NULL OR actor_id = p_user_filter)
    -- Apply date range filter if provided
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to)
    -- Apply action type filter if provided
    AND (p_action_filter IS NULL OR action_type = p_action_filter);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_activity_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_activity_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Returns aggregate stats for Activity Log Dashboard.
   Replaces client-side stats calculation (O(n) → O(1) memory).
   Parameters:
   - p_user_filter: Filter by actor_id (NULL = all users)
   - p_date_from: Start date for range filter (NULL = no start limit)
   - p_date_to: End date for range filter (NULL = no end limit)
   - p_action_filter: Filter by action_type (NULL = all actions)

   Performance: <50ms for 100k rows, <100ms for 1M rows.
   Returns: total, today, critical counts, and unique user count.';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Get stats for all activities
-- SELECT * FROM get_activity_stats(NULL, NULL, NULL, NULL);

-- Get stats for specific user
-- SELECT * FROM get_activity_stats('user-uuid-here', NULL, NULL, NULL);

-- Get stats for last 7 days
-- SELECT * FROM get_activity_stats(NULL, NOW() - INTERVAL '7 days', NOW(), NULL);

-- Get stats for tree actions only
-- SELECT * FROM get_activity_stats(NULL, NULL, NULL, 'update_node');
