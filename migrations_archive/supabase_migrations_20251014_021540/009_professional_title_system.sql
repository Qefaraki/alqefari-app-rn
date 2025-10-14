-- Professional Title System Migration
-- Adds professional title and abbreviation columns
-- Created: 2025-01-10

-- Add new columns for professional titles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS professional_title TEXT,
  ADD COLUMN IF NOT EXISTS title_abbreviation TEXT;

-- Add constraint for abbreviation length
ALTER TABLE profiles
  ADD CONSTRAINT check_title_abbreviation_length
    CHECK (length(title_abbreviation) <= 20);

-- Wipe old nicknames (user confirmed - only 2 exist: "T", "بيس")
UPDATE profiles SET nickname = NULL WHERE nickname IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN profiles.nickname IS 'DEPRECATED: Use professional_title instead. Will be removed in future migration.';
COMMENT ON COLUMN profiles.professional_title IS 'Professional title enum: doctor, prof_doctor, engineer, mister, sheikh, major_general, brigadier, other';
COMMENT ON COLUMN profiles.title_abbreviation IS 'Display abbreviation (auto-filled for standard titles, custom for "other")';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_professional_title
  ON profiles(professional_title)
  WHERE professional_title IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Professional title system migration completed successfully';
  RAISE NOTICE 'New columns: professional_title, title_abbreviation';
  RAISE NOTICE 'Old nicknames wiped: All nickname values set to NULL';
END $$;
