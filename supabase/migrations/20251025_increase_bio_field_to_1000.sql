-- Migration: Increase bio field from 500 to 1000 characters
-- Purpose: Support Wikipedia-style biographical storytelling in profile redesign
-- Date: 2025-10-25

-- Increase bio column constraint
ALTER TABLE profiles
ALTER COLUMN bio TYPE VARCHAR(1000);

-- Add check constraint to enforce limit (optional, for consistency)
-- Note: VARCHAR already enforces the limit in Postgres
