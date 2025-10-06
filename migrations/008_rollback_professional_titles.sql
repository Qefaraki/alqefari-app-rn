-- Rollback Migration for Professional Title System
-- This script removes the professional title columns if needed
-- Created: 2025-01-10

ALTER TABLE profiles
  DROP COLUMN IF EXISTS professional_title,
  DROP COLUMN IF EXISTS title_abbreviation;

-- Note: This is a safety rollback script
-- Only use if migration 009 needs to be reverted
