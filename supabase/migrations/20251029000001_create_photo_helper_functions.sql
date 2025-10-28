-- Migration: Create photo change approval helper functions
-- Purpose: URL validation, rate limiting, and optional accessibility verification
-- Dependencies: Requires 20251029000000_create_photo_request_tables.sql

-- ============================================================================
-- FUNCTION: is_valid_supabase_storage_url
-- ============================================================================
-- Enhanced URL validation with comprehensive security checks
-- Blocks: Path traversal, mixed encoding, newline encoding, malicious redirects
-- Whitelist: Only profile-photos and avatars buckets allowed

CREATE OR REPLACE FUNCTION is_valid_supabase_storage_url(url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
  -- NULL check
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- FIX #5: Bucket whitelist validation with comprehensive pattern matching
  -- Must be HTTPS + Supabase storage domain + whitelisted bucket (profile-photos or avatars)
  IF url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/(public|authenticated)/(profile-photos|avatars)/[^?/]+' THEN
    RETURN false;
  END IF;

  -- FIX #5: Block path traversal attempts (all encoding variations)
  -- Blocks: .., .%2e, %2e., %2E%2E (case-insensitive mixed encoding)
  IF url ~ '(\.\.|%2[eE]\.?|\.%2[eE])' THEN
    RETURN false;
  END IF;

  -- FIX #5: Block newline encoding and control characters
  -- Blocks: %0a, %0d, %00 (null byte), and literal control characters
  IF url ~ '([\x00-\x1f]|%0[0-9a-fA-F])' THEN
    RETURN false;
  END IF;

  -- FIX #5: Block redirect parameters (open redirect protection)
  -- Blocks: ?redirect=, &url=, ?return=, ?next=, ?goto=
  IF url ~ '[?&](redirect|url|return|next|goto)=' THEN
    RETURN false;
  END IF;

  -- All checks passed
  RETURN true;
END;
$$;

-- ============================================================================
-- FUNCTION: check_photo_request_rate_limit
-- ============================================================================
-- Rate limiting: 5 requests per 24 hours per user
-- FIX #3: Added NULL guard to prevent anonymous bypass

CREATE OR REPLACE FUNCTION check_photo_request_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_count INTEGER;
BEGIN
  -- FIX #3: Block anonymous users (NULL user_id)
  -- Prevents bypass via scanner_id = NULL since NULL != NULL in SQL
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING HINT = 'User must be authenticated to submit photo change requests';
  END IF;

  -- Count requests from this user in last 24 hours
  SELECT COUNT(*)
  INTO v_request_count
  FROM photo_change_requests
  WHERE submitter_user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Return true if under limit (5 requests), false if at/over limit
  RETURN v_request_count < 5;
END;
$$;

-- ============================================================================
-- FUNCTION: verify_image_url_accessible (OPTIONAL)
-- ============================================================================
-- Verifies that image URL is actually accessible via HTTP request
-- Requires: pg_net extension (not installed by default)
-- Usage: Uncomment if you have pg_net enabled for additional validation

/*
CREATE OR REPLACE FUNCTION verify_image_url_accessible(url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response JSONB;
  v_status_code INTEGER;
BEGIN
  -- Make HTTP HEAD request to check if URL is accessible
  SELECT INTO v_response
    net.http_get(
      url => url,
      headers => '{"User-Agent": "Alqefari-Family-Tree/1.0"}'::JSONB
    );

  -- Extract status code
  v_status_code := (v_response->>'status')::INTEGER;

  -- Return true if 200 OK, false otherwise
  RETURN v_status_code = 200;
EXCEPTION
  WHEN OTHERS THEN
    -- Network error or timeout - fail closed
    RETURN false;
END;
$$;
*/

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON FUNCTION is_valid_supabase_storage_url(TEXT) IS
  'Enhanced URL validation with bucket whitelist (profile-photos, avatars only). Blocks path traversal, mixed encoding, newline injection, and redirect parameters. IMMUTABLE for index usage.';

COMMENT ON FUNCTION check_photo_request_rate_limit(UUID) IS
  'Rate limiting: 5 photo change requests per 24 hours per user. Returns true if under limit, false if at/over limit. Blocks NULL user_id to prevent anonymous bypass.';

-- COMMENT ON FUNCTION verify_image_url_accessible(TEXT) IS
--   'Optional: Verifies image URL is accessible via HTTP HEAD request. Requires pg_net extension. Uncomment function above to enable.';
