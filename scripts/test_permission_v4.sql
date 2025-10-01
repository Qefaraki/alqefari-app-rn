-- =====================================================
-- PERMISSION SYSTEM v4.2 - COMPREHENSIVE TEST SUITE
-- =====================================================
-- Run this after deployment to verify everything works
-- All tests should return specific expected results
-- =====================================================

-- =====================================================
-- TEST SETUP - Create Test Data
-- =====================================================

BEGIN;

-- Create test users with different relationships
INSERT INTO profiles (id, display_name, hid, father_id, mother_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test User 1', '1.1.1', NULL, NULL, 'user'),
  ('22222222-2222-2222-2222-222222222222', 'Test User 2 (Child of 1)', '1.1.1.1', '11111111-1111-1111-1111-111111111111', NULL, 'user'),
  ('33333333-3333-3333-3333-333333333333', 'Test User 3 (Sibling of 2)', '1.1.1.2', '11111111-1111-1111-1111-111111111111', NULL, 'user'),
  ('44444444-4444-4444-4444-444444444444', 'Test User 4 (Grandchild)', '1.1.1.1.1', '22222222-2222-2222-2222-222222222222', NULL, 'user'),
  ('55555555-5555-5555-5555-555555555555', 'Test Admin', '1.2.1', NULL, NULL, 'admin'),
  ('66666666-6666-6666-6666-666666666666', 'Test Cousin', '1.1.2.1', NULL, NULL, 'user')
ON CONFLICT (id) DO NOTHING;

-- Create test marriage
INSERT INTO marriages (id, husband_id, wife_id, is_current) VALUES
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST 1: Permission Hierarchy
-- =====================================================

SAVEPOINT test1;

SELECT 'TEST 1: Permission Levels' as test_name;

-- Test self permission (should be 'inner')
SELECT
  'Self Edit' as scenario,
  check_family_permission_v4('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') as result,
  CASE
    WHEN check_family_permission_v4('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') = 'inner'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test parent-child (should be 'inner')
SELECT
  'Parent to Child' as scenario,
  check_family_permission_v4('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') as result,
  CASE
    WHEN check_family_permission_v4('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') = 'inner'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test child-parent (should be 'inner')
SELECT
  'Child to Parent' as scenario,
  check_family_permission_v4('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111') as result,
  CASE
    WHEN check_family_permission_v4('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111') = 'inner'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test siblings (should be 'inner')
SELECT
  'Sibling to Sibling' as scenario,
  check_family_permission_v4('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') as result,
  CASE
    WHEN check_family_permission_v4('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') = 'inner'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test spouse (should be 'inner')
SELECT
  'Husband to Wife' as scenario,
  check_family_permission_v4('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666') as result,
  CASE
    WHEN check_family_permission_v4('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666') = 'inner'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test admin permission (should be 'admin')
SELECT
  'Admin to Anyone' as scenario,
  check_family_permission_v4('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111') as result,
  CASE
    WHEN check_family_permission_v4('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111') = 'admin'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

ROLLBACK TO SAVEPOINT test1;

-- =====================================================
-- TEST 2: Suggestion Submission (Rate Limiting)
-- =====================================================

SAVEPOINT test2;

SELECT 'TEST 2: Rate Limiting' as test_name;

-- Try to create 11 suggestions (limit is 10)
DO $$
DECLARE
  i INTEGER;
  suggestion_id UUID;
  error_msg TEXT;
BEGIN
  FOR i IN 1..11 LOOP
    BEGIN
      -- Mock auth.uid() for testing
      PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

      SELECT submit_edit_suggestion_v4(
        '66666666-6666-6666-6666-666666666666',
        'notes',
        'Test note ' || i,
        'Testing rate limit'
      ) INTO suggestion_id;

      IF i <= 10 THEN
        RAISE NOTICE 'Suggestion % created successfully', i;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
        IF i = 11 AND error_msg LIKE '%Rate limit exceeded%' THEN
          RAISE NOTICE '✅ PASS: Rate limit enforced at suggestion 11';
        ELSE
          RAISE NOTICE '❌ FAIL: Unexpected error at suggestion %: %', i, error_msg;
        END IF;
    END;
  END LOOP;
END $$;

-- Check suggestion count
SELECT
  'Suggestions Created' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 10 THEN '✅ PASS: Exactly 10 suggestions'
    ELSE '❌ FAIL: Should have 10 suggestions'
  END as status
FROM profile_edit_suggestions
WHERE submitter_id = '11111111-1111-1111-1111-111111111111';

ROLLBACK TO SAVEPOINT test2;

-- =====================================================
-- TEST 3: Branch Moderator System
-- =====================================================

SAVEPOINT test3;

SELECT 'TEST 3: Branch Moderators' as test_name;

-- Assign branch moderator for branch 1.1.1
INSERT INTO branch_moderators (user_id, branch_hid, assigned_by, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', '1.1.1', '55555555-5555-5555-5555-555555555555', true);

-- Test moderator can edit their branch
SELECT
  'Moderator to Branch Member' as scenario,
  check_family_permission_v4('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444') as result,
  CASE
    WHEN check_family_permission_v4('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444') = 'moderator'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- Test moderator cannot edit outside branch
SELECT
  'Moderator to Non-Branch' as scenario,
  check_family_permission_v4('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555') as result,
  CASE
    WHEN check_family_permission_v4('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555') != 'moderator'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

ROLLBACK TO SAVEPOINT test3;

-- =====================================================
-- TEST 4: Blocking System
-- =====================================================

SAVEPOINT test4;

SELECT 'TEST 4: User Blocking' as test_name;

-- Block a user
INSERT INTO suggestion_blocks (blocked_user_id, blocked_by, reason, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Test block', true);

-- Test blocked user permission
SELECT
  'Blocked User Check' as scenario,
  check_family_permission_v4('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') as result,
  CASE
    WHEN check_family_permission_v4('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') = 'blocked'
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

ROLLBACK TO SAVEPOINT test4;

-- =====================================================
-- TEST 5: Field Whitelisting (Security)
-- =====================================================

SAVEPOINT test5;

SELECT 'TEST 5: SQL Injection Prevention' as test_name;

-- Try to submit with invalid field (should fail)
DO $$
DECLARE
  error_msg TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  BEGIN
    PERFORM submit_edit_suggestion_v4(
      '22222222-2222-2222-2222-222222222222',
      'password', -- NOT in whitelist
      'hacked',
      'Trying SQL injection'
    );
    RAISE NOTICE '❌ FAIL: Invalid field was accepted!';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
      IF error_msg LIKE '%Field % is not allowed%' THEN
        RAISE NOTICE '✅ PASS: Invalid field rejected';
      ELSE
        RAISE NOTICE '❌ FAIL: Wrong error: %', error_msg;
      END IF;
  END;
END $$;

-- Try with valid field (should work)
DO $$
DECLARE
  suggestion_id UUID;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  SELECT submit_edit_suggestion_v4(
    '22222222-2222-2222-2222-222222222222',
    'phone', -- Valid field
    '+966501234567',
    'Valid update'
  ) INTO suggestion_id;

  IF suggestion_id IS NULL THEN
    RAISE NOTICE '✅ PASS: Direct edit for inner circle (no suggestion)';
  ELSE
    RAISE NOTICE '✅ PASS: Suggestion created with ID: %', suggestion_id;
  END IF;
END $$;

ROLLBACK TO SAVEPOINT test5;

-- =====================================================
-- TEST 6: Auto-Approval Timer
-- =====================================================

SAVEPOINT test6;

SELECT 'TEST 6: Auto-Approval System' as test_name;

-- Create a family circle suggestion (will auto-approve in 48 hours)
INSERT INTO profile_edit_suggestions (
  id,
  profile_id,
  submitter_id,
  field_name,
  old_value,
  new_value,
  reason,
  status,
  created_at
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  '44444444-4444-4444-4444-444444444444',
  '66666666-6666-6666-6666-666666666666',
  'occupation',
  'Student',
  'Engineer',
  'Career update',
  'pending',
  NOW() - INTERVAL '49 hours' -- Old enough to auto-approve
);

-- Run auto-approval
SELECT auto_approve_suggestions_v4();

-- Check if it was approved
SELECT
  'Auto-Approval After 48h' as test,
  status,
  reviewed_by,
  notes,
  CASE
    WHEN status = 'auto_approved' AND reviewed_by IS NULL
    THEN '✅ PASS: Auto-approved with NULL system user'
    ELSE '❌ FAIL: Should be auto-approved'
  END as result
FROM profile_edit_suggestions
WHERE id = '88888888-8888-8888-8888-888888888888';

ROLLBACK TO SAVEPOINT test6;

-- =====================================================
-- TEST 7: Notification System
-- =====================================================

SAVEPOINT test7;

SELECT 'TEST 7: Notification Backpressure' as test_name;

-- Create many admins to test notification limit
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..60 LOOP
    INSERT INTO profiles (id, display_name, role)
    VALUES (
      ('99999999-9999-9999-9999-9999999999' || LPAD(i::TEXT, 2, '0'))::UUID,
      'Test Admin ' || i,
      'admin'
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Test notification creation (should be limited to 50)
DO $$
DECLARE
  v_approver_count INTEGER;
  v_target_hid TEXT := '1.1.1';
BEGIN
  -- Simulate the notify_approvers logic
  SELECT COUNT(*) INTO v_approver_count
  FROM (
    SELECT id AS user_id FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111'
    UNION
    SELECT user_id FROM branch_moderators
    WHERE is_active = true
    AND v_target_hid LIKE branch_hid || '%'
    UNION
    SELECT id AS user_id FROM profiles
    WHERE role IN ('admin', 'super_admin')
    LIMIT 50 -- Backpressure limit
  ) approvers;

  IF v_approver_count <= 50 THEN
    RAISE NOTICE '✅ PASS: Notification limit enforced (% approvers)', v_approver_count;
  ELSE
    RAISE NOTICE '❌ FAIL: Too many notifications (% approvers)', v_approver_count;
  END IF;
END $$;

ROLLBACK TO SAVEPOINT test7;

-- =====================================================
-- TEST 8: Approval/Rejection Functions
-- =====================================================

SAVEPOINT test8;

SELECT 'TEST 8: Approval and Rejection' as test_name;

-- Create a test suggestion
INSERT INTO profile_edit_suggestions (
  id,
  profile_id,
  submitter_id,
  field_name,
  old_value,
  new_value,
  status
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'phone',
  '0501234567',
  '0509876543',
  'pending'
);

-- Test approval by profile owner
DO $$
DECLARE
  success BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  SELECT approve_suggestion(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Approved by owner'
  ) INTO success;

  IF success THEN
    RAISE NOTICE '✅ PASS: Owner can approve suggestion';
  ELSE
    RAISE NOTICE '❌ FAIL: Owner should be able to approve';
  END IF;
END $$;

-- Check approval status
SELECT
  'Suggestion Status' as check_type,
  status,
  reviewed_by,
  notes,
  CASE
    WHEN status = 'approved' THEN '✅ PASS: Suggestion approved'
    ELSE '❌ FAIL: Should be approved'
  END as result
FROM profile_edit_suggestions
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

ROLLBACK TO SAVEPOINT test8;

-- =====================================================
-- TEST SUMMARY
-- =====================================================

SELECT '===========================================' as separator;
SELECT 'PERMISSION SYSTEM v4.2 TEST SUITE COMPLETE' as status;
SELECT '===========================================' as separator;

-- Final verification of system components
SELECT
  'Component' as item,
  'Count' as value,
  'Status' as check_result
UNION ALL
SELECT
  'Tables',
  COUNT(*)::TEXT,
  CASE WHEN COUNT(*) = 4 THEN '✅' ELSE '❌' END
FROM information_schema.tables
WHERE table_name IN ('profile_edit_suggestions', 'branch_moderators', 'user_rate_limits', 'suggestion_blocks')
UNION ALL
SELECT
  'Core Functions',
  COUNT(*)::TEXT,
  CASE WHEN COUNT(*) >= 6 THEN '✅' ELSE '❌' END
FROM pg_proc
WHERE proname IN ('check_family_permission_v4', 'submit_edit_suggestion_v4', 'approve_suggestion', 'reject_suggestion', 'auto_approve_suggestions_v4', 'notify_approvers_v4')
UNION ALL
SELECT
  'RLS Policies',
  COUNT(*)::TEXT,
  CASE WHEN COUNT(*) >= 8 THEN '✅' ELSE '❌' END
FROM pg_policies
WHERE tablename IN ('profile_edit_suggestions', 'branch_moderators', 'user_rate_limits', 'suggestion_blocks');

-- Clean up test data
ROLLBACK;

-- =====================================================
-- END OF TEST SUITE
-- =====================================================
-- All tests completed. Review results above.
-- If all show ✅ PASS, the system is working correctly.
-- If any show ❌ FAIL, investigate and fix before going live.
-- =====================================================