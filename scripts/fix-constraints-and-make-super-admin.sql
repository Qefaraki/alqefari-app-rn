-- Fix the constraint conflict and make علي super admin

-- Step 1: Drop the old constraint that's blocking super_admin
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_profile_role;

-- The new constraint check_valid_role already exists and allows super_admin

-- Step 2: Now upgrade علي to super_admin role
UPDATE profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Step 3: Log this change in audit trail
INSERT INTO audit_log (
  action,
  table_name,
  target_profile_id,
  actor_id,
  old_data,
  new_data,
  details,
  created_at
) VALUES (
  'ROLE_CHANGE',
  'profiles',
  'ff239ed7-24d5-4298-a135-79dc0f70e5b8',
  'ff239ed7-24d5-4298-a135-79dc0f70e5b8', -- Self upgrade
  jsonb_build_object('role', null),
  jsonb_build_object('role', 'super_admin'),
  jsonb_build_object(
    'action_type', 'initial_super_admin_setup',
    'old_role', 'user',
    'new_role', 'super_admin',
    'target_name', 'علي',
    'phone', '966501669043',
    'note', 'Initial super admin setup - app owner'
  ),
  NOW()
);

-- Step 4: Verify the change
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

-- Show all constraints to confirm fix
SELECT
    'Constraints after fix:' as info,
    con.conname,
    pg_get_constraintdef(con.oid) as definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'profiles'
  AND con.contype = 'c'
  AND con.conname LIKE '%role%';

-- Show all admins
SELECT
  '👥 All Admins:' as section,
  name,
  role,
  CASE
    WHEN role = 'super_admin' THEN '👑 Super Admin'
    WHEN role = 'admin' THEN '🛡️ Admin'
    ELSE '👤 User'
  END as status
FROM profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY
  CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    ELSE 3
  END,
  name;