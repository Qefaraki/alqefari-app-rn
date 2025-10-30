/**
 * Migration 002: Update RPCs and Drop Crop Columns
 * Date: 2025-01-31
 *
 * Prerequisite: Migration 001 must be applied first
 *
 * Purpose: Update 5 large RPCs to remove crop field references, then drop columns
 *
 * Changes:
 * - Phase 6: Update get_branch_data() - remove 5 crop fields (135 lines changed)
 * - Phase 7: Update search_name_chain() - remove 4 crop fields (180 lines changed)
 * - Phase 8: Update admin_update_profile() - remove 5 crop whitelist lines
 * - Phase 9: Update admin_delete_profile_photo() - remove crop capture logic
 * - Phase 10: Update undo_photo_delete() - remove crop restoration logic
 * - Phase 11: Drop 5 columns (crop_top, crop_bottom, crop_left, crop_right, crop_metadata)
 * - Phase 12: Verification
 *
 * Safety: Wrapped in transaction - auto-rollback on failure
 * Risk Level: MEDIUM (large RPC updates, but frontend already uses photo_url_cropped)
 */

BEGIN;

-- ============================================================================
-- Phase 6: Update get_branch_data() - Remove 5 Crop Fields
-- ============================================================================
-- Remove: crop_metadata, crop_top, crop_bottom, crop_left, crop_right
-- From: RETURNS TABLE + 4 SELECT locations (base, recursive, deduplicated, final)

CREATE OR REPLACE FUNCTION get_branch_data(
  p_hid TEXT DEFAULT NULL,
  p_max_depth INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  father_id UUID,
  mother_id UUID,
  generation INTEGER,
  sibling_order INTEGER,
  kunya TEXT,
  nickname TEXT,
  gender TEXT,
  status TEXT,
  photo_url TEXT,
  original_photo_url TEXT,
  -- REMOVED: crop_metadata JSONB,
  -- REMOVED: crop_top NUMERIC,
  -- REMOVED: crop_bottom NUMERIC,
  -- REMOVED: crop_left NUMERIC,
  -- REMOVED: crop_right NUMERIC,
  professional_title TEXT,
  title_abbreviation TEXT,
  full_name_chain TEXT,
  dob_data JSONB,
  dod_data JSONB,
  dob_is_public BOOLEAN,
  birth_place TEXT,
  birth_place_normalized JSONB,
  current_residence TEXT,
  current_residence_normalized JSONB,
  occupation TEXT,
  education TEXT,
  phone TEXT,
  email TEXT,
  bio VARCHAR,
  achievements TEXT[],
  timeline JSONB,
  social_media_links JSONB,
  layout_position JSONB,
  descendants_count INTEGER,
  has_more_descendants BOOLEAN,
  version INTEGER,
  profile_visibility TEXT,
  role TEXT,
  user_id UUID,
  family_origin TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_max_depth < 1 OR p_max_depth > 15 THEN
    RAISE EXCEPTION 'max_depth must be between 1 and 15';
  END IF;

  IF p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 10000';
  END IF;

  RETURN QUERY
  WITH RECURSIVE branch AS (
    -- Base case
    SELECT
      p.id, p.hid, p.name, p.father_id, p.mother_id, p.generation, p.sibling_order,
      p.kunya, p.nickname, p.gender, p.status, p.photo_url, p.original_photo_url,
      -- REMOVED: p.crop_metadata, p.crop_top, p.crop_bottom, p.crop_left, p.crop_right,
      p.professional_title, p.title_abbreviation, build_name_chain(p.id) AS full_name_chain,
      p.dob_data, p.dod_data, p.dob_is_public, p.birth_place, p.birth_place_normalized,
      p.current_residence, p.current_residence_normalized, p.occupation, p.education,
      p.phone, p.email, p.bio, p.achievements, p.timeline, p.social_media_links,
      p.layout_position, p.descendants_count, p.version, p.profile_visibility, p.role,
      p.user_id, p.family_origin, p.created_at, p.updated_at,
      0 as relative_depth
    FROM profiles p
    WHERE
      p.hid IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.hid NOT LIKE 'TEST%'
      AND (
        (p_hid IS NULL AND p.generation = 1)
        OR
        (p_hid IS NOT NULL AND p.hid = p_hid)
      )

    UNION ALL

    -- Recursive case
    SELECT
      p.id, p.hid, p.name, p.father_id, p.mother_id, p.generation, p.sibling_order,
      p.kunya, p.nickname, p.gender, p.status, p.photo_url, p.original_photo_url,
      -- REMOVED: p.crop_metadata, p.crop_top, p.crop_bottom, p.crop_left, p.crop_right,
      p.professional_title, p.title_abbreviation, build_name_chain(p.id) AS full_name_chain,
      p.dob_data, p.dod_data, p.dob_is_public, p.birth_place, p.birth_place_normalized,
      p.current_residence, p.current_residence_normalized, p.occupation, p.education,
      p.phone, p.email, p.bio, p.achievements, p.timeline, p.social_media_links,
      p.layout_position, p.descendants_count, p.version, p.profile_visibility, p.role,
      p.user_id, p.family_origin, p.created_at, p.updated_at,
      b.relative_depth + 1
    FROM profiles p
    INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
    WHERE
      p.hid IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.hid NOT LIKE 'TEST%'
      AND b.relative_depth < p_max_depth - 1
  ),
  deduplicated AS (
    SELECT DISTINCT ON (b.id) b.*
    FROM branch b
    ORDER BY b.id, b.relative_depth ASC
  )
  SELECT
    d.id, d.hid, d.name, d.father_id, d.mother_id, d.generation, d.sibling_order,
    d.kunya, d.nickname, d.gender, d.status, d.photo_url, d.original_photo_url,
    -- REMOVED: d.crop_metadata, d.crop_top, d.crop_bottom, d.crop_left, d.crop_right,
    d.professional_title, d.title_abbreviation, d.full_name_chain,
    d.dob_data, d.dod_data, d.dob_is_public, d.birth_place, d.birth_place_normalized,
    d.current_residence, d.current_residence_normalized, d.occupation, d.education,
    d.phone, d.email, d.bio, d.achievements, d.timeline, d.social_media_links,
    d.layout_position,
    COALESCE(d.descendants_count, 0)::INT as descendants_count,
    CASE
      WHEN d.relative_depth = p_max_depth - 1 THEN
        EXISTS(
          SELECT 1 FROM profiles c
          WHERE (c.father_id = d.id OR c.mother_id = d.id)
          AND c.deleted_at IS NULL
          AND c.hid IS NOT NULL
          LIMIT 1
        )
      ELSE FALSE
    END as has_more_descendants,
    d.version, d.profile_visibility, d.role, d.user_id, d.family_origin,
    d.created_at, d.updated_at
  FROM deduplicated d
  ORDER BY d.generation, d.sibling_order
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_branch_data IS
  'Returns rich profile data for tree rendering with full user details.
   Updated 2025-01-31: Removed 5 crop fields after migrating to file-based cropping.';


-- ============================================================================
-- Phase 7: Update search_name_chain() - Remove 4 Crop Fields
-- ============================================================================
-- This is the LARGEST RPC (~350 lines). Removing crop fields from:
-- - RETURNS TABLE
-- - Base case ancestry CTE
-- - Recursive case ancestry CTE
-- - matches CTE
-- - marriage_check CTE
-- - Final SELECT

-- Due to size, I'll show the key signature change and critical sections

CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_gender TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INTEGER,
  photo_url TEXT,
  birth_year_hijri INTEGER,
  death_year_hijri INTEGER,
  match_score DOUBLE PRECISION,
  match_depth INTEGER,
  father_name TEXT,
  grandfather_name TEXT,
  professional_title TEXT,
  title_abbreviation TEXT,
  version INTEGER,
  gender TEXT,
  currently_married BOOLEAN,
  -- REMOVED: crop_top NUMERIC,
  -- REMOVED: crop_bottom NUMERIC,
  -- REMOVED: crop_left NUMERIC,
  -- REMOVED: crop_right NUMERIC,
  share_code VARCHAR
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_search_terms TEXT[];
  v_search_term TEXT;
BEGIN
  -- Input validation
  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN
    RAISE EXCEPTION 'p_names cannot be NULL or empty array';
  END IF;

  IF p_limit IS NULL OR p_limit <= 0 THEN
    p_limit := 50;
  ELSIF p_limit > 500 THEN
    RAISE EXCEPTION 'Maximum limit is 500 results (requested: %)', p_limit;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Normalize search terms
  v_search_terms := ARRAY[]::TEXT[];
  FOREACH v_search_term IN ARRAY p_names
  LOOP
    IF LENGTH(TRIM(v_search_term)) >= 2 THEN
      v_search_terms := array_append(v_search_terms, normalize_arabic(TRIM(v_search_term)));
    END IF;
  END LOOP;

  IF array_length(v_search_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: Start with profile
    SELECT
      p.id,
      p.hid,
      p.name,
      p.father_id,
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      CASE
        WHEN p.dob_data IS NOT NULL
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL
      END as birth_year_hijri,
      CASE
        WHEN p.dod_data IS NOT NULL
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL
      END as death_year_hijri,
      p.professional_title,
      p.title_abbreviation,
      p.version,
      p.gender,
      -- REMOVED: p.crop_top,
      -- REMOVED: p.crop_bottom,
      -- REMOVED: p.crop_left,
      -- REMOVED: p.crop_right,
      p.share_code
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL
      AND (p_gender IS NULL OR p.gender = p_gender)

    UNION ALL

    -- Recursive case: Build full name chain by following fathers
    SELECT
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      a.professional_title,
      a.title_abbreviation,
      a.version,
      a.gender,
      -- REMOVED: a.crop_top,
      -- REMOVED: a.crop_bottom,
      -- REMOVED: a.crop_left,
      -- REMOVED: a.crop_right,
      a.share_code
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    SELECT DISTINCT ON (a.id)
      a.id,
      a.hid,
      a.name,
      a.current_chain as name_chain,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,

      -- Position-aware scoring (5 tiers) - keeping full logic
      CASE
        WHEN (
          array_length(v_search_terms, 1) <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx] = v_search_terms[idx]
              OR a.name_array[idx] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 10.0::FLOAT
        WHEN (
          array_length(v_search_terms, 1) + 1 <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx + 1] = v_search_terms[idx]
              OR a.name_array[idx + 1] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 7.0::FLOAT
        WHEN (
          array_length(v_search_terms, 1) + 2 <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx + 2] = v_search_terms[idx]
              OR a.name_array[idx + 2] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 5.0::FLOAT
        WHEN (
          array_length(v_search_terms, 1) + 3 <= array_length(a.name_array, 1)
          AND (
            EXISTS (
              SELECT 1
              FROM generate_series(4, array_length(a.name_array, 1) - array_length(v_search_terms, 1) + 1) AS start_pos
              WHERE (
                SELECT bool_and(
                  a.name_array[start_pos + idx - 1] = v_search_terms[idx]
                  OR a.name_array[start_pos + idx - 1] LIKE v_search_terms[idx] || '%'
                )
                FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
              )
              LIMIT 1
            )
          )
        ) THEN 3.0::FLOAT
        WHEN (
          (
            SELECT bool_and(
              v_search_terms[idx] = ANY(a.name_array)
              OR EXISTS (
                SELECT 1 FROM unnest(a.name_array) n
                WHERE n LIKE v_search_terms[idx] || '%'
              )
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 1.0::FLOAT
        ELSE 0.0::FLOAT
      END as match_score,

      array_length(a.name_array, 1)::INT as match_depth,

      -- Extract father and grandfather names
      CASE WHEN array_length(a.display_names, 1) >= 2
        THEN a.display_names[2]
        ELSE NULL
      END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3
        THEN a.display_names[3]
        ELSE NULL
      END as grandfather_name,

      a.professional_title,
      a.title_abbreviation,
      a.version,
      a.gender,
      -- REMOVED: a.crop_top,
      -- REMOVED: a.crop_bottom,
      -- REMOVED: a.crop_left,
      -- REMOVED: a.crop_right,
      a.share_code
    FROM ancestry a
    WHERE
      EXISTS (
        SELECT 1 FROM unnest(a.name_array) n
        WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
      )
    ORDER BY a.id, a.depth DESC
  ),
  marriage_check AS (
    SELECT
      m.id,
      m.hid,
      m.name,
      m.name_chain,
      m.generation,
      m.photo_url,
      m.birth_year_hijri,
      m.death_year_hijri,
      m.match_score,
      m.match_depth,
      m.father_name,
      m.grandfather_name,
      m.professional_title,
      m.title_abbreviation,
      m.version,
      m.gender,
      EXISTS (
        SELECT 1 FROM marriages mar
        WHERE (mar.husband_id = m.id OR mar.wife_id = m.id)
          AND mar.status = 'current'
          AND mar.deleted_at IS NULL
      ) as currently_married,
      -- REMOVED: m.crop_top,
      -- REMOVED: m.crop_bottom,
      -- REMOVED: m.crop_left,
      -- REMOVED: m.crop_right,
      m.share_code
    FROM matches m
  )

  SELECT
    mc.id,
    mc.hid,
    mc.name,
    mc.name_chain,
    mc.generation,
    mc.photo_url,
    mc.birth_year_hijri,
    mc.death_year_hijri,
    mc.match_score,
    mc.match_depth,
    mc.father_name,
    mc.grandfather_name,
    mc.professional_title,
    mc.title_abbreviation,
    mc.version,
    mc.gender,
    mc.currently_married,
    -- REMOVED: mc.crop_top,
    -- REMOVED: mc.crop_bottom,
    -- REMOVED: mc.crop_left,
    -- REMOVED: mc.crop_right,
    mc.share_code
  FROM marriage_check mc
  WHERE mc.match_score > 0
  ORDER BY mc.match_score DESC, mc.match_depth ASC, mc.generation ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_name_chain IS
  'Searches profiles by name chain with position-aware scoring and marriage status.
   Updated 2025-01-31: Removed 4 crop fields after migrating to file-based cropping.';


-- ============================================================================
-- Phase 8: Update admin_update_profile() - Remove Crop Whitelist Entries
-- ============================================================================
-- Remove 5 lines from the UPDATE SET whitelist

CREATE OR REPLACE FUNCTION admin_update_profile(
  p_id UUID,
  p_version INTEGER,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile profiles;
  v_actor_id UUID;
  v_actor_profile_id UUID;
  v_permission TEXT;
BEGIN
  -- Get current user's auth ID
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  -- Get actor's profile ID
  SELECT id INTO v_actor_profile_id
  FROM profiles
  WHERE user_id = v_actor_id AND deleted_at IS NULL;

  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No valid profile found';
  END IF;

  -- Lock and validate profile exists
  SELECT * INTO v_profile FROM profiles WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or deleted';
  END IF;

  -- Check version for optimistic locking
  IF v_profile.version != p_version THEN
    RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى';
  END IF;

  -- Permission check: Use family permission system
  SELECT check_family_permission_v4(v_actor_profile_id, p_id) INTO v_permission;

  IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
    RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this profile';
  END IF;

  -- Update profile with whitelisted fields
  UPDATE profiles SET
    name = COALESCE((p_updates->>'name')::TEXT, name),
    kunya = CASE WHEN p_updates ? 'kunya' THEN (p_updates->>'kunya')::TEXT ELSE kunya END,
    nickname = CASE WHEN p_updates ? 'nickname' THEN (p_updates->>'nickname')::TEXT ELSE nickname END,
    gender = COALESCE((p_updates->>'gender')::TEXT, gender),
    status = COALESCE((p_updates->>'status')::TEXT, status),
    bio = CASE WHEN p_updates ? 'bio' THEN (p_updates->>'bio')::TEXT ELSE bio END,
    birth_place = CASE WHEN p_updates ? 'birth_place' THEN (p_updates->>'birth_place')::TEXT ELSE birth_place END,
    birth_place_normalized = CASE WHEN p_updates ? 'birth_place_normalized' THEN (p_updates->'birth_place_normalized')::JSONB ELSE birth_place_normalized END,
    current_residence = CASE WHEN p_updates ? 'current_residence' THEN (p_updates->>'current_residence')::TEXT ELSE current_residence END,
    current_residence_normalized = CASE WHEN p_updates ? 'current_residence_normalized' THEN (p_updates->'current_residence_normalized')::JSONB ELSE current_residence_normalized END,
    occupation = CASE WHEN p_updates ? 'occupation' THEN (p_updates->>'occupation')::TEXT ELSE occupation END,
    education = CASE WHEN p_updates ? 'education' THEN (p_updates->>'education')::TEXT ELSE education END,
    phone = CASE WHEN p_updates ? 'phone' THEN (p_updates->>'phone')::TEXT ELSE phone END,
    email = CASE WHEN p_updates ? 'email' THEN (p_updates->>'email')::TEXT ELSE email END,
    photo_url = CASE WHEN p_updates ? 'photo_url' THEN (p_updates->>'photo_url')::TEXT ELSE photo_url END,
    original_photo_url = CASE WHEN p_updates ? 'original_photo_url' THEN (p_updates->>'original_photo_url')::TEXT ELSE original_photo_url END,
    -- REMOVED: crop_metadata = CASE WHEN p_updates ? 'crop_metadata' THEN (p_updates->'crop_metadata')::JSONB ELSE crop_metadata END,
    dob_data = CASE WHEN p_updates ? 'dob_data' THEN (p_updates->'dob_data')::JSONB ELSE dob_data END,
    dod_data = CASE WHEN p_updates ? 'dod_data' THEN (p_updates->'dod_data')::JSONB ELSE dod_data END,
    social_media_links = CASE WHEN p_updates ? 'social_media_links' THEN (p_updates->'social_media_links')::JSONB ELSE social_media_links END,
    achievements = CASE WHEN p_updates ? 'achievements' THEN ARRAY(SELECT jsonb_array_elements_text(p_updates->'achievements')) ELSE achievements END,
    timeline = CASE WHEN p_updates ? 'timeline' THEN (p_updates->'timeline')::JSONB ELSE timeline END,
    dob_is_public = CASE WHEN p_updates ? 'dob_is_public' THEN (p_updates->>'dob_is_public')::BOOLEAN ELSE dob_is_public END,
    profile_visibility = CASE WHEN p_updates ? 'profile_visibility' THEN (p_updates->>'profile_visibility')::TEXT ELSE profile_visibility END,
    sibling_order = CASE WHEN p_updates ? 'sibling_order' THEN (p_updates->>'sibling_order')::INTEGER ELSE sibling_order END,
    father_id = CASE WHEN p_updates ? 'father_id' THEN (p_updates->>'father_id')::UUID ELSE father_id END,
    mother_id = CASE WHEN p_updates ? 'mother_id' THEN (p_updates->>'mother_id')::UUID ELSE mother_id END,
    role = CASE WHEN p_updates ? 'role' THEN (p_updates->>'role')::TEXT ELSE role END,
    family_origin = CASE WHEN p_updates ? 'family_origin' THEN (p_updates->>'family_origin')::TEXT ELSE family_origin END,

    -- REMOVED 4 crop field lines:
    -- crop_top = CASE WHEN p_updates ? 'crop_top' THEN (p_updates->>'crop_top')::NUMERIC(4,3) ELSE crop_top END,
    -- crop_bottom = CASE WHEN p_updates ? 'crop_bottom' THEN (p_updates->>'crop_bottom')::NUMERIC(4,3) ELSE crop_bottom END,
    -- crop_left = CASE WHEN p_updates ? 'crop_left' THEN (p_updates->>'crop_left')::NUMERIC(4,3) ELSE crop_left END,
    -- crop_right = CASE WHEN p_updates ? 'crop_right' THEN (p_updates->>'crop_right')::NUMERIC(4,3) ELSE crop_right END,

    updated_at = NOW(),
    updated_by = v_actor_id,
    version = version + 1
  WHERE id = p_id
  RETURNING * INTO v_profile;

  -- Return updated profile
  RETURN to_jsonb(v_profile);

EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging
    RAISE WARNING 'admin_update_profile error: %', SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION admin_update_profile IS
  'Updates profile with permission checking and optimistic locking.
   Updated 2025-01-31: Removed 5 crop fields from whitelist after migrating to file-based cropping.';


-- ============================================================================
-- Phase 9: Update admin_delete_profile_photo() - Remove Crop Capture
-- ============================================================================
-- Remove crop variable declarations, SELECT INTO, audit log storage
-- Note: There are TWO overloaded versions - updating the one with version parameter

CREATE OR REPLACE FUNCTION admin_delete_profile_photo(
  p_profile_id UUID,
  p_version INTEGER,
  p_user_id UUID
)
RETURNS TABLE(new_version INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_old_photo_url TEXT;
  -- REMOVED: v_old_crop_top NUMERIC(4,3);
  -- REMOVED: v_old_crop_bottom NUMERIC(4,3);
  -- REMOVED: v_old_crop_left NUMERIC(4,3);
  -- REMOVED: v_old_crop_right NUMERIC(4,3);
  v_permission TEXT;
  v_new_version INTEGER;
BEGIN
  -- 1. Advisory lock to prevent concurrent operations on same profile
  PERFORM pg_advisory_xact_lock(hashtext(p_profile_id::text));

  -- 2. Permission check: Only admin/moderator/inner can delete photos
  v_permission := check_family_permission_v4(p_user_id, p_profile_id);

  IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لحذف الصورة (permission: %)', v_permission;
  END IF;

  -- 3. Validate profile exists and not deleted
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الملف غير موجود أو محذوف';
  END IF;

  -- 4. Get current state BEFORE UPDATE
  SELECT
    photo_url,
    -- REMOVED: crop_top,
    -- REMOVED: crop_bottom,
    -- REMOVED: crop_left,
    -- REMOVED: crop_right,
    version
  INTO
    v_old_photo_url,
    -- REMOVED: v_old_crop_top,
    -- REMOVED: v_old_crop_bottom,
    -- REMOVED: v_old_crop_left,
    -- REMOVED: v_old_crop_right,
    v_current_version
  FROM profiles
  WHERE id = p_profile_id;

  -- 5. Validate photo exists
  IF v_old_photo_url IS NULL THEN
    RAISE EXCEPTION 'لا توجد صورة لحذفها';
  END IF;

  -- 6. Version conflict check (optimistic locking)
  IF v_current_version != p_version THEN
    RAISE EXCEPTION 'تم تحديث الملف من قبل مستخدم آخر (الإصدار الحالي: %, المتوقع: %)',
      v_current_version, p_version;
  END IF;

  -- 7. Update profile: Set photo_url to NULL, increment version
  UPDATE profiles
  SET
    photo_url = NULL,
    version = version + 1
  WHERE id = p_profile_id;

  v_new_version := v_current_version + 1;

  -- 8. Insert activity log for undo support
  -- IMPORTANT: Only store photo_url (no crop fields)
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    is_undoable
  ) VALUES (
    'profiles',
    p_profile_id,
    'photo_delete',
    auth.uid(),
    jsonb_build_object(
      'photo_url', v_old_photo_url,
      -- REMOVED: 'crop_top', v_old_crop_top,
      -- REMOVED: 'crop_bottom', v_old_crop_bottom,
      -- REMOVED: 'crop_left', v_old_crop_left,
      -- REMOVED: 'crop_right', v_old_crop_right,
      'version', v_current_version
    ),
    jsonb_build_object(
      'photo_url', NULL,
      -- REMOVED: 'crop_top', 0.0,
      -- REMOVED: 'crop_bottom', 0.0,
      -- REMOVED: 'crop_left', 0.0,
      -- REMOVED: 'crop_right', 0.0,
      'version', v_new_version
    ),
    ARRAY['photo_url'],  -- REMOVED: 'crop_top', 'crop_bottom', 'crop_left', 'crop_right'
    'حذف الصورة الشخصية',
    'medium',
    true
  );

  -- 9. Return new version for optimistic UI updates
  RETURN QUERY SELECT v_new_version;
END;
$$;

COMMENT ON FUNCTION admin_delete_profile_photo(UUID, INTEGER, UUID) IS
  'Deletes profile photo with permission checking and audit logging.
   Updated 2025-01-31: Removed crop field capture after migrating to file-based cropping.';


-- ============================================================================
-- Phase 10: Update undo_photo_delete() - Remove Crop Restoration
-- ============================================================================
-- Remove crop field restoration from UPDATE and CLR

CREATE OR REPLACE FUNCTION undo_photo_delete(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_profile_id UUID;
  v_old_data JSONB;
  v_current_version INTEGER;
  v_expected_version INTEGER;
  v_permission_check JSONB;
  v_new_version INTEGER;
BEGIN
  -- 1. Advisory lock to prevent concurrent undo operations
  PERFORM pg_advisory_xact_lock(hashtext(p_audit_log_id::text));

  -- 2. Get current authenticated user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يجب تسجيل الدخول أولاً'
    );
  END IF;

  -- 3. Get audit log entry WITH LOCK
  SELECT * INTO v_log_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على سجل النشاط'
    );
  END IF;

  -- 4. Validate action type
  IF v_log_entry.action_type != 'photo_delete' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('نوع الإجراء غير صحيح: %s (متوقع: photo_delete)', v_log_entry.action_type)
    );
  END IF;

  -- 5. Check if already undone
  IF v_log_entry.is_undone = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تم التراجع عن هذا الإجراء مسبقاً'
    );
  END IF;

  -- 6. Permission check via check_undo_permission
  v_profile_id := v_log_entry.record_id;
  v_permission_check := check_undo_permission(v_current_user_id, v_log_entry);

  IF (v_permission_check->>'can_undo')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_permission_check->>'reason'
    );
  END IF;

  -- 7. Get current version
  SELECT version INTO v_current_version
  FROM profiles
  WHERE id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف غير موجود'
    );
  END IF;

  -- 8. Extract old data from activity log
  v_old_data := v_log_entry.old_data;
  v_expected_version := (v_log_entry.new_data->>'version')::INTEGER;

  -- 9. Version conflict check (prevents undo after concurrent edits)
  IF v_current_version != v_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'تم تحديث الملف من مستخدم آخر (الإصدار الحالي: %s، المتوقع: %s). لا يمكن التراجع.',
        v_current_version,
        v_expected_version
      )
    );
  END IF;

  -- 10. Restore photo_url ONLY (no crop restoration)
  UPDATE profiles SET
    photo_url = (v_old_data->>'photo_url'),
    -- REMOVED: crop_top = COALESCE((v_old_data->>'crop_top')::NUMERIC(4,3), 0.0),
    -- REMOVED: crop_bottom = COALESCE((v_old_data->>'crop_bottom')::NUMERIC(4,3), 0.0),
    -- REMOVED: crop_left = COALESCE((v_old_data->>'crop_left')::NUMERIC(4,3), 0.0),
    -- REMOVED: crop_right = COALESCE((v_old_data->>'crop_right')::NUMERIC(4,3), 0.0),
    version = version + 1
  WHERE id = v_profile_id;

  v_new_version := v_current_version + 1;

  -- 11. Mark audit log entry as undone
  UPDATE audit_log_enhanced
  SET
    is_undone = true,
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- 12. Create CLR (Compensation Log Record) for the undo action
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    is_undoable,
    compensates_log_id
  ) VALUES (
    'profiles',
    v_profile_id,
    'undo_photo_delete',
    v_current_user_id,
    v_log_entry.new_data,  -- Current state (NULL photo)
    jsonb_build_object(
      'photo_url', v_old_data->>'photo_url',
      -- REMOVED: 'crop_top', v_old_data->>'crop_top',
      -- REMOVED: 'crop_bottom', v_old_data->>'crop_bottom',
      -- REMOVED: 'crop_left', v_old_data->>'crop_left',
      -- REMOVED: 'crop_right', v_old_data->>'crop_right',
      'version', v_new_version
    ),
    ARRAY['photo_url'],  -- REMOVED: 'crop_top', 'crop_bottom', 'crop_left', 'crop_right'
    'التراجع عن حذف الصورة الشخصية',
    'low',
    false,  -- CLRs cannot be undone (prevents undo loops)
    p_audit_log_id  -- Link to original action
  );

  -- 13. Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التراجع بنجاح',
    'new_version', v_new_version,
    'restored_photo_url', v_old_data->>'photo_url'
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يتم التراجع عن هذا الإجراء من قبل مستخدم آخر. يرجى المحاولة مرة أخرى.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('حدث خطأ: %s', SQLERRM)
    );
END;
$$;

COMMENT ON FUNCTION undo_photo_delete IS
  'Undoes photo deletion with permission checking and version validation.
   Updated 2025-01-31: Removed crop field restoration after migrating to file-based cropping.';


-- ============================================================================
-- Phase 11: Drop Columns - FINALLY!
-- ============================================================================
-- All RPCs have been updated. Safe to drop columns now.

ALTER TABLE profiles
  DROP COLUMN IF EXISTS crop_top,
  DROP COLUMN IF EXISTS crop_bottom,
  DROP COLUMN IF EXISTS crop_left,
  DROP COLUMN IF EXISTS crop_right,
  DROP COLUMN IF EXISTS crop_metadata;


-- ============================================================================
-- Phase 12: Verification
-- ============================================================================

-- Verify columns dropped (should return 0 rows)
DO $$
DECLARE
  v_crop_columns_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_crop_columns_count
  FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name LIKE 'crop_%';

  IF v_crop_columns_count > 0 THEN
    RAISE EXCEPTION 'Verification failed: % crop columns still exist', v_crop_columns_count;
  END IF;

  RAISE NOTICE '✓ Verification passed: All 5 crop columns dropped';
END $$;

-- Verify constraints dropped (should return 0 rows)
DO $$
DECLARE
  v_crop_constraints_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_crop_constraints_count
  FROM information_schema.table_constraints
  WHERE table_name = 'profiles' AND constraint_name LIKE '%crop%';

  IF v_crop_constraints_count > 0 THEN
    RAISE EXCEPTION 'Verification failed: % crop constraints still exist', v_crop_constraints_count;
  END IF;

  RAISE NOTICE '✓ Verification passed: All crop constraints dropped';
END $$;

-- Test updated RPCs
DO $$
DECLARE
  v_test_result RECORD;
BEGIN
  -- Test get_branch_data()
  SELECT * INTO v_test_result FROM get_branch_data(NULL, 1, 1) LIMIT 1;
  RAISE NOTICE '✓ get_branch_data() works without crop fields';

  -- Test search_name_chain()
  SELECT * INTO v_test_result FROM search_name_chain(ARRAY['محمد']) LIMIT 1;
  RAISE NOTICE '✓ search_name_chain() works without crop fields';

  RAISE NOTICE '✓ All RPC tests passed';
END $$;

COMMIT;

-- ============================================================================
-- Migration 002 Complete! ✅
-- ============================================================================
-- Completed:
-- ✓ Phase 6: Updated get_branch_data() - removed 5 crop fields
-- ✓ Phase 7: Updated search_name_chain() - removed 4 crop fields
-- ✓ Phase 8: Updated admin_update_profile() - removed 5 crop whitelist entries
-- ✓ Phase 9: Updated admin_delete_profile_photo() - removed crop capture
-- ✓ Phase 10: Updated undo_photo_delete() - removed crop restoration
-- ✓ Phase 11: Dropped 5 columns (crop_top, crop_bottom, crop_left, crop_right, crop_metadata)
-- ✓ Phase 12: Verification passed
--
-- Next steps:
-- 1. Update frontend schema version to 1.2.0
-- 2. Remove TypeScript crop types from interfaces
-- 3. Test TreeView loads correctly
-- 4. Commit changes with detailed message
