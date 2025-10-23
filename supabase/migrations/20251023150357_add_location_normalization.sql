-- Migration: Add location fields with normalization system
-- Purpose: Enable flexible location input with statistical aggregation
-- Features: Arabic-first autocomplete, normalization, hierarchy support

-- 1. Add location columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_place TEXT,
  ADD COLUMN IF NOT EXISTS birth_place_normalized JSONB,
  ADD COLUMN IF NOT EXISTS current_residence TEXT,
  ADD COLUMN IF NOT EXISTS current_residence_normalized JSONB;

-- 2. Create indexes for statistics queries
CREATE INDEX IF NOT EXISTS idx_profiles_birth_normalized
  ON profiles USING GIN (birth_place_normalized);

CREATE INDEX IF NOT EXISTS idx_profiles_residence_normalized
  ON profiles USING GIN (current_residence_normalized);

-- 3. Create place_standards reference table
CREATE TABLE IF NOT EXISTS place_standards (
  id BIGSERIAL PRIMARY KEY,
  place_name TEXT NOT NULL,              -- Arabic: "الرياض"
  place_name_en TEXT NOT NULL,           -- English: "Riyadh"
  place_type VARCHAR(20) NOT NULL,       -- 'city' or 'country'
  parent_id BIGINT REFERENCES place_standards(id),
  country_code CHAR(2),                  -- ISO: 'SA', 'PS', 'AE'
  region VARCHAR(20),                    -- 'saudi', 'gulf', 'arab', 'western', 'other'
  display_order INTEGER,                 -- Custom sort order (saudi cities 500-999, countries 1000+)
  alternate_names TEXT[],                -- Variations: ['Riyad', 'الریاض']
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_place_standards_name
  ON place_standards(place_name);

CREATE INDEX IF NOT EXISTS idx_place_standards_name_en
  ON place_standards(place_name_en);

CREATE INDEX IF NOT EXISTS idx_place_standards_type
  ON place_standards(place_type);

CREATE INDEX IF NOT EXISTS idx_place_standards_region
  ON place_standards(region);

CREATE INDEX IF NOT EXISTS idx_place_standards_order
  ON place_standards(display_order);

-- 5. Arabic text normalization function
-- Handles: Hamza variations, Teh Marbuta, Alif Maqsura, diacritics, Tatweel
CREATE OR REPLACE FUNCTION normalize_arabic_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              input_text,
              '[إأآٱ]', 'ا', 'g'  -- Normalize Hamza forms to Alif
            ),
            'ة', 'ه', 'g'          -- Normalize Teh Marbuta to Ha
          ),
          'ى', 'ي', 'g'            -- Normalize Alif Maqsura to Ya
        ),
        '[َُِّْٰ]', '', 'g'        -- Remove diacritics
      ),
      'ـ', '', 'g'                -- Remove Tatweel
    )
  );
END;
$$;

-- 6. Autocomplete search RPC (ARABIC-FIRST)
CREATE OR REPLACE FUNCTION search_place_autocomplete(
  p_query TEXT,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  display_name TEXT,
  display_name_en TEXT,
  place_type TEXT,
  country_name TEXT,
  region TEXT,
  normalized_data JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := normalize_arabic_text(p_query);

  RETURN QUERY
  SELECT
    ps.id,
    ps.place_name AS display_name,
    ps.place_name_en AS display_name_en,
    ps.place_type,
    parent.place_name AS country_name,
    ps.region,
    CASE
      WHEN ps.place_type = 'city' THEN
        jsonb_build_object(
          'original', ps.place_name,
          'city', jsonb_build_object('ar', ps.place_name, 'en', ps.place_name_en, 'id', ps.id),
          'country', jsonb_build_object('ar', parent.place_name, 'en', parent.place_name_en, 'code', parent.country_code, 'id', parent.id),
          'confidence', 1.0
        )
      ELSE
        jsonb_build_object(
          'original', ps.place_name,
          'country', jsonb_build_object('ar', ps.place_name, 'en', ps.place_name_en, 'code', ps.country_code, 'id', ps.id),
          'confidence', 1.0
        )
    END AS normalized_data
  FROM place_standards ps
  LEFT JOIN place_standards parent ON ps.parent_id = parent.id
  WHERE
    -- PRIORITY: ARABIC FIRST
    -- Check normalized Arabic name
    normalize_arabic_text(ps.place_name) LIKE v_normalized || '%'
    -- Check alternate Arabic spellings
    OR v_normalized = ANY(SELECT normalize_arabic_text(unnest(ps.alternate_names)))
  ORDER BY
    -- PRIORITY 1: Display order (saudi cities 500-999, then countries 1000+)
    ps.display_order,

    -- PRIORITY 2: Exact Arabic match beats partial match
    CASE
      WHEN normalize_arabic_text(ps.place_name) = v_normalized THEN 1
      WHEN ps.place_name LIKE p_query || '%' THEN 2
      ELSE 3
    END,

    -- PRIORITY 3: Shorter names (more commonly used abbreviations)
    LENGTH(ps.place_name)

  LIMIT p_limit;
END;
$$;

-- 7. Location statistics RPC
CREATE OR REPLACE FUNCTION get_location_statistics()
RETURNS TABLE (
  location_ar TEXT,
  location_en TEXT,
  location_type TEXT,
  birth_count BIGINT,
  residence_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH birth_stats AS (
    SELECT
      COALESCE(
        birth_place_normalized->'city'->>'ar',
        birth_place_normalized->'country'->>'ar'
      ) AS location_ar,
      COALESCE(
        birth_place_normalized->'city'->>'en',
        birth_place_normalized->'country'->>'en'
      ) AS location_en,
      CASE
        WHEN birth_place_normalized->'city' IS NOT NULL THEN 'city'
        ELSE 'country'
      END AS location_type,
      COUNT(*) AS birth_count
    FROM profiles
    WHERE birth_place_normalized IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY location_ar, location_en, location_type
  ),
  residence_stats AS (
    SELECT
      COALESCE(
        current_residence_normalized->'city'->>'ar',
        current_residence_normalized->'country'->>'ar'
      ) AS location_ar,
      COALESCE(
        current_residence_normalized->'city'->>'en',
        current_residence_normalized->'country'->>'en'
      ) AS location_en,
      CASE
        WHEN current_residence_normalized->'city' IS NOT NULL THEN 'city'
        ELSE 'country'
      END AS location_type,
      COUNT(*) AS residence_count
    FROM profiles
    WHERE current_residence_normalized IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY location_ar, location_en, location_type
  )
  SELECT
    COALESCE(b.location_ar, r.location_ar) AS location_ar,
    COALESCE(b.location_en, r.location_en) AS location_en,
    COALESCE(b.location_type, r.location_type) AS location_type,
    COALESCE(b.birth_count, 0) AS birth_count,
    COALESCE(r.residence_count, 0) AS residence_count,
    COALESCE(b.birth_count, 0) + COALESCE(r.residence_count, 0) AS total_count
  FROM birth_stats b
  FULL OUTER JOIN residence_stats r
    ON b.location_ar = r.location_ar
    AND b.location_type = r.location_type
  ORDER BY total_count DESC;
END;
$$;
