-- Fix Admin Linking and Upgrade to Super Admin
-- This script links the auth user to the profile and upgrades to super_admin

-- Step 1: Link the auth user (admin@test.com) to the Test Admin profile
UPDATE profiles
SET user_id = 'd29ae263-b1bd-454a-96f1-91470ca6c503'
WHERE id = 'd29ae263-b1bd-454a-96f1-91470ca6c503'
  AND user_id IS NULL;

-- Step 2: Upgrade the Test Admin to super_admin role
UPDATE profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE id = 'd29ae263-b1bd-454a-96f1-91470ca6c503';

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
  'd29ae263-b1bd-454a-96f1-91470ca6c503',
  'd29ae263-b1bd-454a-96f1-91470ca6c503', -- Self upgrade
  jsonb_build_object('role', 'admin'),
  jsonb_build_object('role', 'super_admin'),
  jsonb_build_object(
    'action_type', 'initial_super_admin_setup',
    'old_role', 'admin',
    'new_role', 'super_admin',
    'target_name', 'Test Admin',
    'note', 'Initial super admin setup via script'
  ),
  NOW()
);

-- Verify the changes
SELECT
  p.id,
  p.name,
  p.role,
  p.user_id,
  au.email,
  CASE
    WHEN p.role = 'super_admin' THEN '✅ Super Admin Successfully Set!'
    ELSE '❌ Role not updated'
  END as status
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.id = 'd29ae263-b1bd-454a-96f1-91470ca6c503';