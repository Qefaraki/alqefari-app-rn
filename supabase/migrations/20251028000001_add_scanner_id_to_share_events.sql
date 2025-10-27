-- Migration: Add scanner_id Column to profile_share_events
-- Date: October 28, 2025
-- Purpose: Track who performed the QR scan (separate from sharer/inviter)
-- Fixes: Plan-validator issue #1 (RLS policy can't tie to auth user)

-- ========================================
-- Step 1: Add scanner_id Column
-- ========================================

-- Add column to track who scanned the QR code
ALTER TABLE profile_share_events
  ADD COLUMN IF NOT EXISTS scanner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN profile_share_events.scanner_id IS
  'Profile ID of the user who scanned the QR code (authenticated user). NULL if scan was anonymous.';

-- ========================================
-- Step 2: Create Index for Performance
-- ========================================

-- Index for queries filtering by scanner
CREATE INDEX IF NOT EXISTS idx_share_events_scanner_id
  ON profile_share_events(scanner_id);

-- Index for queries joining scanner with profiles
CREATE INDEX IF NOT EXISTS idx_share_events_scanner_shared_at
  ON profile_share_events(scanner_id, shared_at DESC);

-- ========================================
-- Step 3: Backfill Existing Data
-- ========================================

-- For existing rows, set scanner_id = sharer_id (best guess)
-- This assumes the sharer IS the scanner (reasonable for legacy data)
UPDATE profile_share_events
SET scanner_id = sharer_id
WHERE scanner_id IS NULL
  AND sharer_id IS NOT NULL;

-- Log backfill results
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled scanner_id for % existing rows', v_updated_count;
END $$;

-- ========================================
-- Step 4: Create Analytics Views
-- ========================================

-- View: Top scanners (most active QR users)
CREATE OR REPLACE VIEW top_qr_scanners AS
SELECT
  p.id as scanner_id,
  p.name as scanner_name,
  p.hid,
  COUNT(*) as total_scans,
  COUNT(DISTINCT ps.profile_id) as unique_profiles_scanned,
  MAX(ps.shared_at) as last_scan_at
FROM profile_share_events ps
JOIN profiles p ON ps.scanner_id = p.id
WHERE ps.share_method = 'qr_scan'
  AND ps.shared_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, p.hid
ORDER BY total_scans DESC
LIMIT 50;

COMMENT ON VIEW top_qr_scanners IS
  'Shows most active QR code scanners (last 30 days)';

-- View: Most scanned profiles
CREATE OR REPLACE VIEW most_scanned_profiles AS
SELECT
  p.id as profile_id,
  p.name,
  p.hid,
  COUNT(*) as scan_count,
  COUNT(DISTINCT ps.scanner_id) as unique_scanners,
  MAX(ps.shared_at) as last_scanned_at
FROM profile_share_events ps
JOIN profiles p ON ps.profile_id = p.id
WHERE ps.share_method = 'qr_scan'
  AND ps.shared_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, p.hid
ORDER BY scan_count DESC
LIMIT 50;

COMMENT ON VIEW most_scanned_profiles IS
  'Shows most popular profiles being shared via QR code (last 30 days)';

-- ========================================
-- Step 5: Verification
-- ========================================

-- Verify column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profile_share_events'
      AND column_name = 'scanner_id'
  ) THEN
    RAISE EXCEPTION 'scanner_id column not found - migration failed';
  END IF;
END $$;

-- Verify index exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'profile_share_events'
      AND indexname = 'idx_share_events_scanner_id'
  ) THEN
    RAISE EXCEPTION 'scanner_id index not found - migration failed';
  END IF;
END $$;

-- Success message
DO $$
DECLARE
  v_total_rows INTEGER;
  v_rows_with_scanner INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_rows FROM profile_share_events;
  SELECT COUNT(*) INTO v_rows_with_scanner
  FROM profile_share_events
  WHERE scanner_id IS NOT NULL;

  RAISE NOTICE '✅ scanner_id migration complete';
  RAISE NOTICE '   - Total rows: %', v_total_rows;
  RAISE NOTICE '   - Rows with scanner_id: % of %', v_rows_with_scanner, v_total_rows;
END $$;
