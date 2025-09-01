-- Fix Migration Drift and Deploy New Migrations
-- Execute these commands in Supabase SQL Editor
-- https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- ============================================
-- STEP 1: Check Current Migration Status
-- ============================================
-- First, let's see what migrations Supabase thinks are applied
SELECT version, name, statements 
FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- ============================================
-- STEP 2: Verify Tables Exist
-- ============================================
-- Confirm our tables are already in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'marriages', 'background_jobs', 'audit_log')
ORDER BY table_name;

-- ============================================
-- STEP 3: Clear Migration History (CRITICAL)
-- ============================================
-- This allows us to re-baseline with all migrations
-- WARNING: Only run this if you're sure the schema is correct!
TRUNCATE supabase_migrations.schema_migrations;

-- Verify it's empty
SELECT COUNT(*) as migration_count FROM supabase_migrations.schema_migrations;

-- ============================================
-- STEP 4: After Running CLI Push Command
-- ============================================
-- After you run: supabase db push --include-all
-- Come back and run these verification queries:

-- Check that all migrations are recorded
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- Verify our new functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN (
    'get_current_user_role',
    'admin_bulk_create_children', 
    'admin_revert_action'
);

-- Test the get_current_user_role function
SELECT * FROM get_current_user_role();

-- ============================================
-- ALTERNATIVE: If TRUNCATE Fails
-- ============================================
-- If you get permission errors on TRUNCATE, try:
DELETE FROM supabase_migrations.schema_migrations;

-- If that also fails, we'll need to use the repair command approach