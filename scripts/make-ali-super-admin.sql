-- Make علي (phone: 966501669043) the Super Admin
-- Profile ID: ff239ed7-24d5-4298-a135-79dc0f70e5b8

-- Step 1: Upgrade علي to super_admin role
UPDATE profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Step 2: Log this change in audit trail
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

-- Step 3: Verify the change
SELECT
  p.id,
  p.name,
  p.phone as profile_phone,
  au.phone as auth_phone,
  p.role,
  p.hid,
  CASE
    WHEN p.role = 'super_admin' THEN '👑 ✅ Super Admin Successfully Set!'
    ELSE '❌ Role not updated'
  END as status,
  'Now you can access all admin features!' as message
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Also show all current admins
SELECT
  name,
  role,
  CASE
    WHEN role = 'super_admin' THEN '👑'
    WHEN role = 'admin' THEN '🛡️'
    ELSE '👤'
  END as icon
FROM profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY role, name;