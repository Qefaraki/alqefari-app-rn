-- Migration: Add JSON validation constraints for location normalization
-- Purpose: Ensure normalized location data conforms to expected schema
-- Impact: Prevents malformed JSONB data from being saved

-- Add CHECK constraint for birth_place_normalized structure
ALTER TABLE profiles
ADD CONSTRAINT check_birth_place_normalized_schema CHECK (
  birth_place_normalized IS NULL
  OR (
    -- Either city or country must be present
    (birth_place_normalized ? 'city' OR birth_place_normalized ? 'country')
    -- If city is present, it must have ar, en, id
    AND (NOT (birth_place_normalized ? 'city') OR (
      (birth_place_normalized->'city' ? 'ar')
      AND (birth_place_normalized->'city' ? 'en')
      AND (birth_place_normalized->'city' ? 'id')
    ))
    -- If country is present, it must have ar, en, code, id
    AND (NOT (birth_place_normalized ? 'country') OR (
      (birth_place_normalized->'country' ? 'ar')
      AND (birth_place_normalized->'country' ? 'en')
      AND (birth_place_normalized->'country' ? 'code')
      AND (birth_place_normalized->'country' ? 'id')
    ))
    -- confidence must be a number between 0 and 1
    AND (NOT (birth_place_normalized ? 'confidence') OR (
      (birth_place_normalized->>'confidence')::numeric >= 0
      AND (birth_place_normalized->>'confidence')::numeric <= 1
    ))
    -- original text must be present
    AND (birth_place_normalized ? 'original')
  )
);

-- Add CHECK constraint for current_residence_normalized structure (same schema as birth_place_normalized)
ALTER TABLE profiles
ADD CONSTRAINT check_current_residence_normalized_schema CHECK (
  current_residence_normalized IS NULL
  OR (
    -- Either city or country must be present
    (current_residence_normalized ? 'city' OR current_residence_normalized ? 'country')
    -- If city is present, it must have ar, en, id
    AND (NOT (current_residence_normalized ? 'city') OR (
      (current_residence_normalized->'city' ? 'ar')
      AND (current_residence_normalized->'city' ? 'en')
      AND (current_residence_normalized->'city' ? 'id')
    ))
    -- If country is present, it must have ar, en, code, id
    AND (NOT (current_residence_normalized ? 'country') OR (
      (current_residence_normalized->'country' ? 'ar')
      AND (current_residence_normalized->'country' ? 'en')
      AND (current_residence_normalized->'country' ? 'code')
      AND (current_residence_normalized->'country' ? 'id')
    ))
    -- confidence must be a number between 0 and 1
    AND (NOT (current_residence_normalized ? 'confidence') OR (
      (current_residence_normalized->>'confidence')::numeric >= 0
      AND (current_residence_normalized->>'confidence')::numeric <= 1
    ))
    -- original text must be present
    AND (current_residence_normalized ? 'original')
  )
);

-- Create indexes for efficient statistics queries on normalized location data
CREATE INDEX IF NOT EXISTS idx_profiles_birth_place_city_id
  ON profiles USING btree (((birth_place_normalized->'city'->>'id')::UUID))
  WHERE birth_place_normalized ? 'city';

CREATE INDEX IF NOT EXISTS idx_profiles_birth_place_country_id
  ON profiles USING btree (((birth_place_normalized->'country'->>'id')::UUID))
  WHERE birth_place_normalized ? 'country' AND NOT (birth_place_normalized ? 'city');

CREATE INDEX IF NOT EXISTS idx_profiles_residence_city_id
  ON profiles USING btree (((current_residence_normalized->'city'->>'id')::UUID))
  WHERE current_residence_normalized ? 'city';

CREATE INDEX IF NOT EXISTS idx_profiles_residence_country_id
  ON profiles USING btree (((current_residence_normalized->'country'->>'id')::UUID))
  WHERE current_residence_normalized ? 'country' AND NOT (current_residence_normalized ? 'city');

-- Add CHECK constraint to place_standards to ensure valid data
ALTER TABLE place_standards
ADD CONSTRAINT check_place_standards_data CHECK (
  -- place_name and place_name_en must not be empty
  place_name ~ '\S'
  AND place_name_en ~ '\S'
  -- place_type must be 'city' or 'country'
  AND place_type IN ('city', 'country')
  -- region must be one of: saudi, gulf, arab, western, other
  AND region IN ('saudi', 'gulf', 'arab', 'western', 'other')
  -- if place_type is 'city', parent_id must be set
  AND (place_type != 'city' OR parent_id IS NOT NULL)
  -- if place_type is 'country', country_code must be set and 2 chars
  AND (place_type != 'country' OR (country_code IS NOT NULL AND LENGTH(country_code) = 2))
  -- display_order must be positive
  AND display_order > 0
);

-- Document the constraints
COMMENT ON CONSTRAINT check_birth_place_normalized_schema ON profiles IS
'Ensures birth_place_normalized contains valid city or country reference with required fields (ar, en, id, confidence, original)';

COMMENT ON CONSTRAINT check_current_residence_normalized_schema ON profiles IS
'Ensures current_residence_normalized contains valid city or country reference with required fields (ar, en, id/code, confidence, original)';

COMMENT ON CONSTRAINT check_place_standards_data ON place_standards IS
'Ensures place_standards records have valid data: valid place names, type in (city, country), region from enum, display_order > 0, and cities have parent_id';
