-- Migration: Create auto-expiration trigger for photo change requests
-- Purpose: Silently expire pending requests after 7 days without admin intervention
-- Dependencies: Requires migrations 20251029000000 through 20251029000003

-- ============================================================================
-- METADATA TABLE: trigger_metadata
-- ============================================================================
-- Tracks last execution time for triggers to implement debouncing
-- Prevents excessive trigger executions

CREATE TABLE IF NOT EXISTS trigger_metadata (
  trigger_name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize metadata for photo expiration trigger
INSERT INTO trigger_metadata (trigger_name, last_run_at)
VALUES ('photo_request_expiration', NOW() - INTERVAL '2 minutes')
ON CONFLICT (trigger_name) DO NOTHING;

-- ============================================================================
-- FUNCTION: expire_old_photo_requests
-- ============================================================================
-- Silently expires pending photo requests older than 7 days
-- Features: 1-minute debounce, no user notifications, batch update

CREATE OR REPLACE FUNCTION expire_old_photo_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_run TIMESTAMPTZ;
  v_expired_count INTEGER := 0;
BEGIN
  -- Get last run time
  SELECT last_run_at INTO v_last_run
  FROM trigger_metadata
  WHERE trigger_name = 'photo_request_expiration'
  FOR UPDATE;

  -- Debounce: Only run if last execution was more than 1 minute ago
  IF v_last_run IS NOT NULL AND (NOW() - v_last_run) < INTERVAL '1 minute' THEN
    RETURN NEW;
  END IF;

  -- Update expired requests (silent, no notifications)
  UPDATE photo_change_requests
  SET status = 'expired',
      updated_at = NOW(),
      version = version + 1
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Update trigger metadata
  UPDATE trigger_metadata
  SET last_run_at = NOW(),
      run_count = run_count + 1,
      updated_at = NOW()
  WHERE trigger_name = 'photo_request_expiration';

  -- Log expiration count if any requests were expired
  IF v_expired_count > 0 THEN
    RAISE NOTICE 'Photo request expiration: Expired % pending request(s)', v_expired_count;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER: photo_request_expiration_trigger
-- ============================================================================
-- Runs expiration check ONLY on INSERT (new request created)
-- WHEN clause prevents infinite loop from UPDATE operations
-- Debounced to 1 minute minimum interval between executions

CREATE TRIGGER photo_request_expiration_trigger
  AFTER INSERT ON photo_change_requests
  FOR EACH STATEMENT
  EXECUTE FUNCTION expire_old_photo_requests();

-- ============================================================================
-- MANUAL CLEANUP FUNCTION (Optional)
-- ============================================================================
-- Admin can manually trigger expiration cleanup without waiting for next INSERT/UPDATE
-- Bypasses 1-minute debounce for manual execution

CREATE OR REPLACE FUNCTION manually_expire_photo_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_expired_count INTEGER := 0;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لتشغيل التنظيف اليدوي'
    );
  END IF;

  -- Check admin permission
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'يجب أن تكون مشرفاً لتشغيل التنظيف اليدوي'
    );
  END IF;

  -- Expire old requests (bypass debounce)
  UPDATE photo_change_requests
  SET status = 'expired',
      updated_at = NOW(),
      version = version + 1
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Update trigger metadata
  UPDATE trigger_metadata
  SET last_run_at = NOW(),
      run_count = run_count + 1,
      updated_at = NOW()
  WHERE trigger_name = 'photo_request_expiration';

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'message', format('تم إنهاء %s طلب منتهي الصلاحية', v_expired_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء التنظيف اليدوي'
    );
END;
$$;

-- ============================================================================
-- DIAGNOSTIC VIEW (Optional)
-- ============================================================================
-- Shows current pending requests and their expiration status
-- Useful for monitoring and debugging

CREATE OR REPLACE VIEW photo_request_expiration_status AS
SELECT
  pcr.id,
  pcr.profile_id,
  p.hid AS profile_hid,
  p.name AS profile_name,
  pcr.status,
  pcr.created_at,
  pcr.expires_at,
  CASE
    WHEN pcr.expires_at < NOW() THEN 'EXPIRED (pending cleanup)'
    WHEN pcr.expires_at < NOW() + INTERVAL '1 day' THEN 'EXPIRES SOON (< 1 day)'
    WHEN pcr.expires_at < NOW() + INTERVAL '3 days' THEN 'EXPIRES SOON (< 3 days)'
    ELSE 'ACTIVE'
  END AS expiration_status,
  EXTRACT(EPOCH FROM (pcr.expires_at - NOW())) / 3600 AS hours_until_expiration
FROM photo_change_requests pcr
JOIN profiles p ON p.id = pcr.profile_id
WHERE pcr.status = 'pending'
ORDER BY pcr.expires_at ASC;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE trigger_metadata IS
  'Tracks last execution time for database triggers to implement debouncing and rate limiting. Prevents excessive trigger executions.';

COMMENT ON FUNCTION expire_old_photo_requests() IS
  'Trigger function that silently expires pending photo requests older than 7 days. Features 1-minute debounce to prevent excessive executions. No user notifications sent.';

COMMENT ON FUNCTION manually_expire_photo_requests() IS
  'Admin-only RPC to manually trigger expiration cleanup. Bypasses 1-minute debounce for immediate execution. Returns count of expired requests.';

COMMENT ON VIEW photo_request_expiration_status IS
  'Diagnostic view showing pending requests with expiration status and time until expiration. Useful for monitoring.';

-- ============================================================================
-- INITIAL CLEANUP (Run once at migration time)
-- ============================================================================
-- Expire any existing pending requests that are already past their expiration date

DO $$
DECLARE
  v_initial_expired_count INTEGER := 0;
BEGIN
  -- Expire old requests
  UPDATE photo_change_requests
  SET status = 'expired',
      updated_at = NOW(),
      version = version + 1
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_initial_expired_count = ROW_COUNT;

  IF v_initial_expired_count > 0 THEN
    RAISE NOTICE 'Initial cleanup: Expired % pending request(s) that were past expiration', v_initial_expired_count;
  END IF;
END $$;
