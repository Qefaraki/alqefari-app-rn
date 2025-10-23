-- Migration: Change place_standards.region from VARCHAR(20) to TEXT
-- Author: Claude Code (Fixed)
-- Date: 2025-10-23
--
-- Problem: PostgREST requires exact type matching between function return type
-- and actual column type. The search_place_autocomplete() function declares
-- region as TEXT, but place_standards.region was VARCHAR(20), causing:
-- "Returned type character varying(20) does not match expected type text in column 6"
--
-- Solution: Change place_standards.region to TEXT to match function declaration.
-- This is safe because TEXT has no practical storage difference from VARCHAR in PostgreSQL.
--
-- IMPORTANT: This migration ONLY changes the column type. Migration 20251023150362
-- already updated the function to add ::TEXT cast as a workaround. After this migration,
-- the cast becomes unnecessary but harmless.

-- Step 1: Change column type from VARCHAR(20) to TEXT
ALTER TABLE place_standards
ALTER COLUMN region TYPE TEXT;

-- Step 2: Verify the column type change
COMMENT ON COLUMN place_standards.region IS 'Region classification (saudi, gulf, arab, western, other) - TEXT type for PostgREST type matching';

-- Step 3: Note - search_place_autocomplete() function already updated in migration 20251023150362
-- No need to recreate the function here. The ::TEXT cast in that migration is now redundant
-- but harmless since the column is already TEXT.
