-- Migration: Add unique constraint for UPSERT idempotency
-- Purpose: Enable seedLocationData.js to use onConflict: 'place_name_en'
-- Impact: Allows idempotent seeding (safe re-runs)
-- Created: 2025-10-23
-- Issue: Previous migration created regular index, not unique constraint
-- Fix: Add unique constraint to support UPSERT operations

-- Add unique constraint on place_name_en (English name used as natural key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_place_standards_name_en_unique
  ON place_standards(place_name_en);

-- Document the constraint
COMMENT ON INDEX idx_place_standards_name_en_unique IS
'Unique constraint on English place name for UPSERT operations in seedLocationData.js. Ensures idempotent seeding (safe to re-run script without duplicates).';

-- Rollback instructions
-- DROP INDEX IF EXISTS idx_place_standards_name_en_unique;
