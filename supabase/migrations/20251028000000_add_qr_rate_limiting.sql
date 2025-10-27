-- Migration: Add QR Scan Rate Limiting (Server-Side)
-- Date: October 28, 2025
-- Purpose: Prevent QR scan spam via database-enforced rate limiting
-- Fixes: Plan-validator issue #2 (memory leak, multi-device bypass)

-- ========================================
-- Step 1: Extend user_rate_limits Table
-- ========================================

-- Add QR scan rate limit columns
ALTER TABLE user_rate_limits
  ADD COLUMN IF NOT EXISTS qr_scans_in_window INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_qr_scan_window_start TIMESTAMPTZ;

COMMENT ON COLUMN user_rate_limits.qr_scans_in_window IS
  'Number of QR scans in current 5-minute window';
COMMENT ON COLUMN user_rate_limits.last_qr_scan_window_start IS
  'Timestamp when current rate limit window started';

-- ========================================
-- Step 2: Create Rate Limit Function
-- ========================================

CREATE OR REPLACE FUNCTION enforce_qr_scan_rate_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_scanner_id UUID;
  v_scan_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_rate_limit_max INTEGER := 20; -- Max scans per window
  v_rate_limit_window INTERVAL := '5 minutes';
BEGIN
  -- Get scanner's profile ID from authenticated user
  SELECT id INTO v_scanner_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- If user has no profile, reject
  IF v_scanner_id IS NULL THEN
    RAISE EXCEPTION 'User has no associated profile';
  END IF;

  -- Get current rate limit state for this user
  SELECT
    qr_scans_in_window,
    last_qr_scan_window_start
  INTO
    v_scan_count,
    v_window_start
  FROM user_rate_limits
  WHERE user_id = v_scanner_id;

  -- Initialize if no rate limit entry exists
  IF v_scan_count IS NULL THEN
    v_scan_count := 0;
    v_window_start := NOW();
  END IF;

  -- Reset window if expired (5 minutes elapsed)
  IF v_window_start IS NULL OR
     v_window_start < (NOW() - v_rate_limit_window) THEN
    v_scan_count := 0;
    v_window_start := NOW();
  END IF;

  -- Check if rate limit exceeded
  IF v_scan_count >= v_rate_limit_max THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % QR scans per % minutes. Window resets at %',
      v_rate_limit_max,
      EXTRACT(EPOCH FROM v_rate_limit_window) / 60,
      v_window_start + v_rate_limit_window;
  END IF;

  -- Increment scan counter (upsert pattern)
  INSERT INTO user_rate_limits (
    user_id,
    qr_scans_in_window,
    last_qr_scan_window_start
  )
  VALUES (
    v_scanner_id,
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET
      qr_scans_in_window = v_scan_count + 1,
      last_qr_scan_window_start = v_window_start;

  -- Log rate limit activity for monitoring
  RAISE NOTICE 'QR scan rate limit: user=%, count=%/%, window=%',
    v_scanner_id,
    v_scan_count + 1,
    v_rate_limit_max,
    v_window_start;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_qr_scan_rate_limit() IS
  'Enforces 20 QR scans per 5 minutes rate limit. Called before INSERT on profile_share_events.';

-- ========================================
-- Step 3: Attach Trigger
-- ========================================

-- Drop existing trigger if exists (idempotent)
DROP TRIGGER IF EXISTS check_qr_scan_rate_limit ON profile_share_events;

-- Create trigger (runs BEFORE INSERT)
CREATE TRIGGER check_qr_scan_rate_limit
  BEFORE INSERT ON profile_share_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_qr_scan_rate_limit();

COMMENT ON TRIGGER check_qr_scan_rate_limit ON profile_share_events IS
  'Enforces QR scan rate limiting before analytics insert';

-- ========================================
-- Step 4: Create Monitoring View
-- ========================================

-- View for easy rate limit monitoring
CREATE OR REPLACE VIEW qr_scan_rate_limits AS
SELECT
  p.id as profile_id,
  p.name,
  p.hid,
  u.qr_scans_in_window,
  u.last_qr_scan_window_start,
  u.last_qr_scan_window_start + INTERVAL '5 minutes' as window_expires_at,
  CASE
    WHEN u.qr_scans_in_window >= 20 THEN 'RATE_LIMITED'
    WHEN u.qr_scans_in_window >= 15 THEN 'WARNING'
    ELSE 'OK'
  END as status
FROM profiles p
JOIN user_rate_limits u ON p.id = u.user_id
WHERE u.qr_scans_in_window > 0
  AND u.last_qr_scan_window_start > NOW() - INTERVAL '1 hour'
ORDER BY u.qr_scans_in_window DESC;

COMMENT ON VIEW qr_scan_rate_limits IS
  'Shows users currently in rate limit window (for monitoring dashboard)';

-- ========================================
-- Step 5: Verification
-- ========================================

-- Verify function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_qr_scan_rate_limit'
  ) THEN
    RAISE EXCEPTION 'Rate limit function not found - migration failed';
  END IF;
END $$;

-- Verify trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'check_qr_scan_rate_limit'
  ) THEN
    RAISE EXCEPTION 'Rate limit trigger not found - migration failed';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ QR scan rate limiting migration complete';
  RAISE NOTICE '   - Rate limit: 20 scans per 5 minutes';
  RAISE NOTICE '   - Enforced server-side (cannot be bypassed)';
  RAISE NOTICE '   - Persists across devices and app restarts';
END $$;
