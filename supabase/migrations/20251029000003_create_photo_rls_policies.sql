-- Migration: Create RLS policies for photo change approval tables
-- Purpose: Row-level security for photo_change_requests and photo_rejection_templates
-- Dependencies: Requires migrations 20251029000000, 20251029000001, 20251029000002

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE photo_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_rejection_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: photo_change_requests
-- ============================================================================

-- Policy 1: Users can view their own requests
CREATE POLICY "Users can view their own photo change requests"
  ON photo_change_requests
  FOR SELECT
  USING (
    submitter_user_id = auth.uid()
  );

-- Policy 2: Admins/moderators can view all pending requests
CREATE POLICY "Admins can view all pending photo change requests"
  ON photo_change_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Policy 3: Users can insert their own requests (submission)
-- Note: Business logic validation happens in submit_photo_change_request() RPC
CREATE POLICY "Users can submit photo change requests"
  ON photo_change_requests
  FOR INSERT
  WITH CHECK (
    submitter_user_id = auth.uid()
  );

-- Policy 4: Users can update their own pending requests (for cancellation)
-- Note: Only status change to 'cancelled' is allowed via RPC
CREATE POLICY "Users can cancel their own pending requests"
  ON photo_change_requests
  FOR UPDATE
  USING (
    submitter_user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    submitter_user_id = auth.uid()
    AND status IN ('pending', 'cancelled')
  );

-- Policy 5: Admins can update any request (for approval/rejection)
-- Note: Business logic validation happens in approve/reject RPCs
CREATE POLICY "Admins can update photo change requests"
  ON photo_change_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- ============================================================================
-- POLICIES: photo_rejection_templates
-- ============================================================================

-- Policy 6: Anyone (authenticated) can read active templates
-- Used for template picker in rejection UI
CREATE POLICY "Anyone can read active rejection templates"
  ON photo_rejection_templates
  FOR SELECT
  USING (
    is_active = true
    OR (
      -- Admins can see inactive templates too
      EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.role IN ('super_admin', 'admin')
      )
    )
  );

-- Policy 7: Only super_admin and admin can insert templates
CREATE POLICY "Admins can create rejection templates"
  ON photo_rejection_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Policy 8: Only super_admin and admin can update templates
CREATE POLICY "Admins can update rejection templates"
  ON photo_rejection_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Policy 9: Only super_admin and admin can delete templates (soft delete)
-- Note: Actual deletion is handled by RPC which sets is_active = false
CREATE POLICY "Admins can delete rejection templates"
  ON photo_rejection_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON POLICY "Users can view their own photo change requests" ON photo_change_requests IS
  'Users can view only their own submitted photo change requests via submitter_user_id match.';

COMMENT ON POLICY "Admins can view all pending photo change requests" ON photo_change_requests IS
  'Super admins, admins, and moderators can view all photo change requests for review queue.';

COMMENT ON POLICY "Users can submit photo change requests" ON photo_change_requests IS
  'Users can insert new requests. Business logic validation (rate limiting, URL validation) happens in submit_photo_change_request() RPC.';

COMMENT ON POLICY "Users can cancel their own pending requests" ON photo_change_requests IS
  'Users can update their own pending requests to cancelled status. Prevents updating already-reviewed requests.';

COMMENT ON POLICY "Admins can update photo change requests" ON photo_change_requests IS
  'Admins can update any request for approval/rejection. Permission checks and business logic in approve/reject RPCs.';

COMMENT ON POLICY "Anyone can read active rejection templates" ON photo_rejection_templates IS
  'Authenticated users can read active templates for template picker UI. Admins can also see inactive templates.';

COMMENT ON POLICY "Admins can create rejection templates" ON photo_rejection_templates IS
  'Only super_admin and admin roles can create new rejection templates.';

COMMENT ON POLICY "Admins can update rejection templates" ON photo_rejection_templates IS
  'Only super_admin and admin roles can update existing rejection templates.';

COMMENT ON POLICY "Admins can delete rejection templates" ON photo_rejection_templates IS
  'Only super_admin and admin roles can delete (soft delete via RPC) rejection templates.';
