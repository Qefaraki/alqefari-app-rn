-- Migration: Add non-destructive crop fields to profiles
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Store normalized crop coordinates (0.0-1.0) for photo cropping
-- Impact: +4 columns, ~40 KB structure size increase (2,527 profiles × 16 bytes)

-- ============================================================================
-- PART 1: Add Input Columns (NO COMPUTED COLUMNS - they were dead code)
-- ============================================================================

-- Add 4 crop coordinate columns
-- Normalized range: 0.0 (no crop) to 1.0 (full crop)
-- Postgres 17: Instant operation (DEFAULT doesn't rewrite table)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS crop_top NUMERIC(4,3) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS crop_bottom NUMERIC(4,3) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS crop_left NUMERIC(4,3) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS crop_right NUMERIC(4,3) DEFAULT 0.0;

-- ============================================================================
-- PART 2: Add Validation Constraints
-- ============================================================================

-- Range constraints: Each field must be 0.0-1.0
ALTER TABLE profiles
  ADD CONSTRAINT check_crop_top_range
    CHECK (crop_top >= 0.0 AND crop_top <= 1.0),
  ADD CONSTRAINT check_crop_bottom_range
    CHECK (crop_bottom >= 0.0 AND crop_bottom <= 1.0),
  ADD CONSTRAINT check_crop_left_range
    CHECK (crop_left >= 0.0 AND crop_left <= 1.0),
  ADD CONSTRAINT check_crop_right_range
    CHECK (crop_right >= 0.0 AND crop_right <= 1.0);

-- Bounds constraints: Total crop must not exceed image dimensions
ALTER TABLE profiles
  ADD CONSTRAINT check_crop_horizontal_valid
    CHECK (crop_left + crop_right < 1.0),
  ADD CONSTRAINT check_crop_vertical_valid
    CHECK (crop_top + crop_bottom < 1.0);

-- Minimum crop area: Must keep at least 10% of image visible
-- Prevents extreme crops (e.g., 1% visible area)
ALTER TABLE profiles
  ADD CONSTRAINT check_crop_minimum_area
    CHECK ((1.0 - crop_left - crop_right) >= 0.1 AND
           (1.0 - crop_top - crop_bottom) >= 0.1);

-- ============================================================================
-- PART 3: Add NOT NULL Constraints
-- ============================================================================

-- Postgres 17: Fast operation (validates existing DEFAULT values)
ALTER TABLE profiles
  ALTER COLUMN crop_top SET NOT NULL,
  ALTER COLUMN crop_bottom SET NOT NULL,
  ALTER COLUMN crop_left SET NOT NULL,
  ALTER COLUMN crop_right SET NOT NULL;

-- ============================================================================
-- PART 4: Add Index for Analytics (Optional)
-- ============================================================================

-- Index for querying "profiles with crop" (for analytics/debugging)
-- Partial index: Only indexes rows where crop exists (saves space)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_has_crop
  ON profiles ((crop_top + crop_bottom + crop_left + crop_right))
  WHERE (crop_top + crop_bottom + crop_left + crop_right) > 0;

-- ============================================================================
-- PART 5: Add Column Comments
-- ============================================================================

COMMENT ON COLUMN profiles.crop_top IS
  'Normalized crop distance from top edge (0.0-1.0). 0.0 = no crop, 0.5 = crop 50% from top.';
COMMENT ON COLUMN profiles.crop_bottom IS
  'Normalized crop distance from bottom edge (0.0-1.0). 0.0 = no crop, 0.5 = crop 50% from bottom.';
COMMENT ON COLUMN profiles.crop_left IS
  'Normalized crop distance from left edge (0.0-1.0). 0.0 = no crop, 0.5 = crop 50% from left.';
COMMENT ON COLUMN profiles.crop_right IS
  'Normalized crop distance from right edge (0.0-1.0). 0.0 = no crop, 0.5 = crop 50% from right.';

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Verify columns exist
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name LIKE 'crop_%';

-- Verify constraints
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name LIKE 'check_crop_%';

-- Verify all profiles have default crop (0.0)
-- SELECT COUNT(*) FROM profiles WHERE crop_top <> 0 OR crop_bottom <> 0 OR crop_left <> 0 OR crop_right <> 0;
-- Expected: 0 (no profiles cropped yet)
