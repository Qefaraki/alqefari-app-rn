-- Make علي super admin (simplified without audit log)

-- Step 1: Drop the old constraint that's blocking super_admin
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_profile_role;

-- Step 2: Upgrade علي to super_admin role
UPDATE profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Step 3: Verify the change
SELECT
  p.id,
  p.name,
  p.phone as profile_phone,
  au.phone as auth_phone,
  p.role,
  p.hid,
  CASE
    WHEN p.role = 'super_admin' THEN '👑 ✅ You are now Super Admin!'
    ELSE '❌ Role not updated'
  END as status,
  'You now have access to all admin features!' as message
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Show all current constraints to confirm fix
SELECT
    'Constraints after fix:' as info,
    con.conname,
    pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles'
  AND con.contype = 'c'
  AND con.conname LIKE '%role%';