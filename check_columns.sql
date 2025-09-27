-- Check what columns exist in profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if profile_link_requests table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profile_link_requests'
AND table_schema = 'public'
ORDER BY ordinal_position;