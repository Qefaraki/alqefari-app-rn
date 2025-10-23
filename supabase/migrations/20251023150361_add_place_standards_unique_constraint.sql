-- Migration: Add unique constraint for place_standards name
-- Purpose: Enable UPSERT operations on place_name_en
-- Issue: Seeding script uses onConflict: 'place_name_en' but constraint didn't exist

-- Create unique index on place_name_en for UPSERT operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_place_standards_name_en_unique
  ON place_standards(place_name_en);

-- Document the constraint
COMMENT ON INDEX idx_place_standards_name_en_unique IS
'Unique constraint enabling UPSERT operations on place_name_en. Used by seeding script for idempotent data loading.';
