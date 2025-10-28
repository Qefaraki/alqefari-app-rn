-- Migration: Add version field to profile_edit_suggestions for optimistic locking
-- Date: 2025-10-29
-- Purpose: Store profile version at suggestion creation time for validation at approval time
--
-- Problem: Suggestions created without version field break optimistic locking.
-- When admin approves a suggestion, the profile might have been edited by another user,
-- causing the approved change to overwrite newer data.
--
-- Solution: Store profile version in suggestion record, validate at approval time.

-- Add version column to track profile version at suggestion creation time
ALTER TABLE profile_edit_suggestions
ADD COLUMN profile_version INTEGER;

COMMENT ON COLUMN profile_edit_suggestions.profile_version IS
'Profile version number at time of suggestion creation. Used for optimistic locking validation during approval.';

-- Update existing suggestions to have NULL version (cannot retroactively determine)
-- These will skip version validation during approval
UPDATE profile_edit_suggestions
SET profile_version = NULL
WHERE profile_version IS NULL;

-- Add index for performance (approval queries filter by status + profile_id)
CREATE INDEX IF NOT EXISTS idx_suggestions_status_profile
ON profile_edit_suggestions(status, profile_id)
WHERE status = 'pending';

COMMENT ON INDEX idx_suggestions_status_profile IS
'Partial index for pending suggestions lookup during approval flow. Includes profile_id for version validation queries.';
