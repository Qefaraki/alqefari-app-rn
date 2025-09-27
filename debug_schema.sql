-- Check profiles table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Test the specific query that's failing
SELECT plr.*, p.name, p.id as profile_id
FROM profile_link_requests plr
LEFT JOIN profiles p ON p.id = plr.profile_id
WHERE plr.user_id = 'f387f27e-0fdb-4379-b474-668c0edfc3d1'
LIMIT 1;