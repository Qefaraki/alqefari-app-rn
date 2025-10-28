-- Migration: Add reviewer index for photo change requests
-- Purpose: Optimize "who reviewed what" queries for admin analytics
-- Dependencies: Requires 20251029000000_create_photo_request_tables.sql

-- ============================================================================
-- INDEX: idx_photo_requests_reviewer
-- ============================================================================
-- Enables efficient queries for:
-- - Which admin reviewed the most requests
-- - Recent review activity by admin
-- - Performance reports by reviewer

CREATE INDEX idx_photo_requests_reviewer
  ON photo_change_requests(reviewer_user_id, reviewed_at DESC)
  WHERE reviewer_user_id IS NOT NULL;

-- Partial index: Only includes reviewed requests (approved/rejected)
-- Excludes pending/cancelled/expired requests (reviewer_user_id is NULL)

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON INDEX idx_photo_requests_reviewer IS
  'Optimizes admin analytics queries for photo review activity. Partial index excludes unreviewed requests.';

-- Example usage:
-- SELECT reviewer_user_id, COUNT(*) as reviewed_count
-- FROM photo_change_requests
-- WHERE reviewer_user_id = 'admin-uuid-here'
--   AND reviewed_at > NOW() - INTERVAL '30 days'
-- GROUP BY reviewer_user_id;
