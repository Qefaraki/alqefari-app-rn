-- Diagnostic queries to check existing photo system
-- Run these queries to understand current state

-- 1. Check if profile_photos table exists and its structure
SELECT 
    'Table exists' as check_type,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profile_photos'
    ) as result;

-- 2. Check columns in profile_photos table (if exists)
SELECT 
    'Columns' as check_type,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profile_photos'
ORDER BY ordinal_position;

-- 3. Check existing indexes
SELECT 
    'Indexes' as check_type,
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'profile_photos';

-- 4. Check existing functions related to photos
SELECT 
    'Functions' as check_type,
    proname as function_name,
    pg_get_function_result(oid) as return_type,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
    'get_profile_photos',
    'admin_add_profile_photo', 
    'admin_set_primary_photo',
    'admin_delete_profile_photo',
    'admin_reorder_photos'
);

-- 5. Check if profiles table has is_admin column
SELECT 
    'is_admin column exists' as check_type,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_admin'
    ) as result;

-- 6. Check existing RLS policies on profile_photos
SELECT 
    'Policies' as check_type,
    polname as policy_name,
    polcmd as command,
    polpermissive as permissive
FROM pg_policy
WHERE polrelid = 'profile_photos'::regclass::oid;

-- 7. Check if there's any data in profile_photos
SELECT 
    'Data exists' as check_type,
    COUNT(*) as record_count
FROM profile_photos;

-- 8. Check for any profiles with photo_url that aren't in profile_photos
SELECT 
    'Profiles with photos not migrated' as check_type,
    COUNT(*) as count
FROM profiles p
WHERE p.photo_url IS NOT NULL 
    AND p.photo_url != ''
    AND NOT EXISTS (
        SELECT 1 FROM profile_photos pp 
        WHERE pp.profile_id = p.id
    );