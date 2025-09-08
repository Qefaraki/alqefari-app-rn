-- Fix duplicate functions by dropping old versions
-- Keep only the latest version with mother_id and text[] achievements

-- Drop all old versions of admin_create_profile
DROP FUNCTION IF EXISTS admin_create_profile(text, text, uuid, integer, jsonb, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS admin_create_profile(text, text, uuid, integer, integer, text, jsonb, jsonb, text, text, text, text, text, text, text, text, jsonb, text[], jsonb, boolean, text);
DROP FUNCTION IF EXISTS admin_create_profile(text, text, uuid, integer, integer, text, jsonb, jsonb, text, text, text, text, text, text, text, text, jsonb, text[], jsonb, boolean, text, text);
DROP FUNCTION IF EXISTS admin_create_profile(text, text, uuid, uuid, integer, integer, text, text, text, jsonb, text, text, text, text, text, text, text, text, jsonb, text, jsonb, boolean, text);

-- The correct version with text[] achievements is already deployed from 025_consistency_fixes.sql

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_create_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_profile TO authenticated;