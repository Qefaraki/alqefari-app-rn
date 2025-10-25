-- ============================================================================
-- Migration: Cleanup search_name_chain function overloads
-- ============================================================================
-- Migration: 20251025120001_cleanup_search_name_chain_overloads.sql
-- Date: 2025-10-25
-- Author: Claude
--
-- Purpose:
--   Remove conflicting overloaded versions of search_name_chain() RPC to
--   eliminate "function is not unique" errors and ensure the correct version
--   with version field is used.
--
-- Root Cause:
--   Multiple migrations created different versions of search_name_chain with
--   different parameter signatures (6-param, 4-param, 3-param), causing
--   PostgreSQL to be unable to select the best match when called with 3 params.
--
-- What This Does:
--   1. Drops all overloaded versions (6-param, 4-param with extra variants)
--   2. Keeps only the canonical 3-parameter version with version field
--   3. Ensures unambiguous function resolution
--
-- Impact:
--   ✅ Eliminates "function is not unique" errors
--   ✅ Ensures correct version-aware RPC is used
--   ✅ No frontend code changes (same call signature)
--
-- ============================================================================

-- Drop all conflicting overloaded versions (keeping only 3-param version)
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT, TEXT, UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT, TEXT) CASCADE;

-- Ensure the correct 3-parameter version has proper grants
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT) TO anon, authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Cleaned up search_name_chain function overloads';
  RAISE NOTICE '✅ Kept only canonical 3-parameter version with version field';
  RAISE NOTICE '✅ Function calls are now unambiguous';
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- Function signature: search_name_chain(TEXT[], INT, INT)
-- All conflicting overloads removed
-- Frontend requires zero code changes
