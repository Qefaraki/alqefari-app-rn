-- Migration: Update delete_user_account_complete and add rate limiting for account deletion
-- Date: 2025-10-26
-- Purpose:
--   1. Update delete_user_account_complete to use audit_log_enhanced instead of audit_log
--   2. Add concurrent deletion protection
--   3. Create log_account_deletion_attempt RPC for tracking deletion attempts
--   4. Create rate limiting table and check_deletion_rate_limit RPC

-- ============================================================================
-- PART 1: Update delete_user_account_complete RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_account_complete()
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  error TEXT,
  user_id UUID,
  profile_unlinked BOOLEAN,
  admin_deleted BOOLEAN,
  profile_deleted BOOLEAN,
  notifications_deleted INTEGER,
  auth_marked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_phone TEXT;
  v_profile_unlinked BOOLEAN := FALSE;
  v_admin_deleted BOOLEAN := FALSE;
  v_profile_deleted BOOLEAN := FALSE;
  v_notifications_deleted INTEGER := 0;
  v_auth_marked BOOLEAN := FALSE;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      FALSE, 'User not authenticated', 'AUTH_ERROR', NULL::UUID, FALSE, FALSE, FALSE, 0, FALSE;
    RETURN;
  END IF;

  -- Check for concurrent deletion (prevent double-delete)
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"deletion_in_progress": true}'
  WHERE id = v_user_id
    AND (raw_app_meta_data->>'deletion_in_progress' IS NULL
         OR raw_app_meta_data->>'deletion_in_progress' = 'false');

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE, 'Deletion already in progress', 'CONCURRENT_DELETION', v_user_id, FALSE, FALSE, FALSE, 0, FALSE;
    RETURN;
  END IF;

  -- Get user's phone for audit trail
  SELECT phone INTO v_phone FROM auth.users WHERE id = v_user_id;

  -- Get user's profile ID
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_user_id LIMIT 1;

  -- Unlink profile from user (soft delete user association)
  UPDATE profiles
  SET user_id = NULL, can_edit = FALSE
  WHERE user_id = v_user_id;

  IF FOUND THEN
    v_profile_unlinked := TRUE;
  END IF;

  -- Remove admin privileges
  DELETE FROM admin_users
  WHERE user_id = v_user_id;

  IF FOUND THEN
    v_admin_deleted := TRUE;
  END IF;

  -- Delete notifications
  DELETE FROM notifications
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  -- Delete link requests
  DELETE FROM link_requests
  WHERE user_id = v_user_id OR target_user_id = v_user_id;

  -- Delete edit suggestions
  DELETE FROM profile_edit_suggestions
  WHERE submitter_id = v_user_id;

  -- Mark auth user as deleted (for audit trail)
  UPDATE auth.users
  SET
    raw_app_meta_data = raw_app_meta_data || '{"account_deleted": true, "deletion_timestamp": "' || now()::text || '"}',
    deleted_at = now()
  WHERE id = v_user_id;

  v_auth_marked := TRUE;

  -- Log deletion to audit_log_enhanced (NEW: using audit_log_enhanced instead of audit_log)
  INSERT INTO audit_log_enhanced (
    actor_id,
    action_type,
    action_category,
    description,
    old_data,
    new_data,
    metadata,
    is_undoable
  ) VALUES (
    v_user_id,
    'account_deletion',
    'account',
    'حذف الحساب بواسطة المستخدم',
    jsonb_build_object(
      'user_id', v_user_id,
      'profile_id', v_profile_id,
      'phone', v_phone
    ),
    NULL,
    jsonb_build_object(
      'profile_unlinked', v_profile_unlinked,
      'admin_deleted', v_admin_deleted,
      'notifications_deleted', v_notifications_deleted,
      'deletion_method', 'otp_verified',
      'deletion_timestamp', now()
    ),
    FALSE
  );

  -- Return success
  RETURN QUERY SELECT
    TRUE, 'Account deleted successfully', NULL, v_user_id,
    v_profile_unlinked, v_admin_deleted, v_profile_deleted,
    v_notifications_deleted, v_auth_marked;

EXCEPTION WHEN OTHERS THEN
  -- Log the error and return failure
  RETURN QUERY SELECT
    FALSE, 'Account deletion failed', SQLERRM, v_user_id,
    v_profile_unlinked, v_admin_deleted, v_profile_deleted,
    v_notifications_deleted, v_auth_marked;
END;
$$;

-- ============================================================================
-- PART 2: Create log_account_deletion_attempt RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION log_account_deletion_attempt(
  p_user_id UUID,
  p_step TEXT,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log_enhanced (
    actor_id,
    action_type,
    action_category,
    description,
    metadata,
    is_undoable
  ) VALUES (
    p_user_id,
    'account_deletion_attempt',
    'security',
    'محاولة حذف حساب: ' || p_step,
    jsonb_build_object(
      'step', p_step,
      'success', p_success,
      'error_message', p_error_message,
      'timestamp', now()
    ),
    false
  );
EXCEPTION WHEN OTHERS THEN
  -- Non-blocking logging - don't fail if audit log fails
  RAISE WARNING 'Failed to log deletion attempt: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PART 3: Create rate limiting table
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_deletion_rate_limit (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_deletion_rate_limit_locked_until
ON account_deletion_rate_limit(locked_until);

-- ============================================================================
-- PART 4: Create check_deletion_rate_limit RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION check_deletion_rate_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_max_attempts INTEGER := 3;
  v_window_hours INTEGER := 24;
BEGIN
  -- Get current rate limit record
  SELECT * INTO v_record
  FROM account_deletion_rate_limit
  WHERE user_id = p_user_id;

  -- If no record exists, create one and allow
  IF v_record IS NULL THEN
    INSERT INTO account_deletion_rate_limit (user_id, attempt_count, last_attempt_at)
    VALUES (p_user_id, 1, now());

    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Check if currently locked
  IF v_record.locked_until IS NOT NULL
     AND v_record.locked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'locked',
      'retry_after', EXTRACT(EPOCH FROM (v_record.locked_until - now()))
    );
  END IF;

  -- Reset counter if outside the window
  IF v_record.last_attempt_at < now() - (v_window_hours || ' hours')::INTERVAL THEN
    UPDATE account_deletion_rate_limit
    SET attempt_count = 1, last_attempt_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Check if exceeded max attempts
  IF v_record.attempt_count >= v_max_attempts THEN
    -- Lock the account for 24 hours
    UPDATE account_deletion_rate_limit
    SET
      attempt_count = v_record.attempt_count + 1,
      locked_until = now() + (v_window_hours || ' hours')::INTERVAL,
      last_attempt_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after', EXTRACT(EPOCH FROM ((now() + (v_window_hours || ' hours')::INTERVAL) - now()))
    );
  END IF;

  -- Increment attempt count and allow
  UPDATE account_deletion_rate_limit
  SET
    attempt_count = attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ============================================================================
-- PART 5: RLS Policies for rate limit table
-- ============================================================================

ALTER TABLE account_deletion_rate_limit ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limit record
CREATE POLICY "Users can view own deletion rate limit"
  ON account_deletion_rate_limit
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the system can insert/update (via RPC)
CREATE POLICY "Only system can manage deletion rate limit"
  ON account_deletion_rate_limit
  FOR ALL
  USING (FALSE);  -- Prevent direct client access, use RPC only

-- ============================================================================
-- Commit message for git
-- ============================================================================
--
-- migration: Add delete account OTP support and rate limiting
--
-- - Update delete_user_account_complete to use audit_log_enhanced
-- - Add concurrent deletion protection to prevent double-deletes
-- - Create log_account_deletion_attempt RPC for security tracking
-- - Create rate limiting table and check_deletion_rate_limit RPC
-- - Limit delete account attempts to 3 per 24 hours
-- - Add RLS policies for rate limit table
--
-- 🤖 Generated with Claude Code
-- Co-Authored-By: Claude <noreply@anthropic.com>
