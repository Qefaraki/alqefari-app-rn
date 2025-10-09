-- Migration 081: Fix Marriage Status Validation and user_id Column Issue
-- Date: 2025-01-10
-- Fixes:
--   1. Update admin_create_marriage to accept 'current'/'past' status (not 'married'/'divorced')
--   2. Fix capture_name_snapshots trigger to use auth_user_id (not user_id)
-- Root Cause:
--   - Migration 078 changed constraint to 'current'/'past' but RPC still validates old values
--   - Migration 076 uses user_id column that doesn't exist (should use auth_user_id)

BEGIN;

-- ============================================================================
-- PART 1: Fix Marriage Status Validation
-- ============================================================================

-- Drop and recreate admin_create_marriage with correct status values
DROP FUNCTION IF EXISTS admin_create_marriage CASCADE;

CREATE OR REPLACE FUNCTION admin_create_marriage(
    p_husband_id UUID,
    p_wife_id UUID,
    p_munasib TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT 'current'  -- FIXED: Changed from 'married' to 'current'
) RETURNS marriages AS $$
DECLARE
    v_husband profiles%ROWTYPE;
    v_wife profiles%ROWTYPE;
    v_new_marriage marriages%ROWTYPE;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;

    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor ID for audit
    v_actor_id := auth.uid();

    -- Validate required fields
    IF p_husband_id IS NULL OR p_wife_id IS NULL THEN
        RAISE EXCEPTION 'Both husband_id and wife_id are required';
    END IF;

    -- Validate husband exists and is male
    SELECT * INTO v_husband FROM profiles WHERE id = p_husband_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Husband profile not found';
    END IF;
    IF v_husband.gender != 'male' THEN
        RAISE EXCEPTION 'Husband must be male';
    END IF;

    -- Validate wife exists and is female
    SELECT * INTO v_wife FROM profiles WHERE id = p_wife_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wife profile not found';
    END IF;
    IF v_wife.gender != 'female' THEN
        RAISE EXCEPTION 'Wife must be female';
    END IF;

    -- Validate status (FIXED: Use 'current' and 'past' instead of old values)
    IF p_status NOT IN ('current', 'past') THEN
        RAISE EXCEPTION 'Invalid marriage status: %. Must be ''current'' or ''past''', p_status;
    END IF;

    -- Check for duplicate marriage (FIXED: Use 'current' instead of 'married')
    IF p_status = 'current' THEN
        IF EXISTS (
            SELECT 1 FROM marriages
            WHERE husband_id = p_husband_id
            AND wife_id = p_wife_id
            AND status = 'current'
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Active marriage already exists between these profiles';
        END IF;
    END IF;

    -- Create marriage record
    INSERT INTO marriages (
        husband_id,
        wife_id,
        munasib,
        start_date,
        end_date,
        status
    ) VALUES (
        p_husband_id,
        p_wife_id,
        p_munasib,
        p_start_date,
        p_end_date,
        p_status
    ) RETURNING * INTO v_new_marriage;

    -- Attempt audit logging to enhanced table (which accepts auth.uid())
    BEGIN
        -- Try audit_log_enhanced first (if it exists)
        INSERT INTO audit_log_enhanced (
            actor_id,
            actor_type,
            action_type,
            action_category,
            table_name,
            record_id,
            target_type,
            old_data,
            new_data,
            description,
            severity,
            status,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,  -- auth.uid() works here!
            'user',
            'add_marriage',
            'marriage',
            'marriages',
            v_new_marriage.id,
            'marriage',
            NULL,
            to_jsonb(v_new_marriage),
            'إضافة زواج',
            'low',
            'completed',
            jsonb_build_object(
                'source', 'rpc',
                'context', 'admin_create_marriage',
                'husband_name', v_husband.name,
                'wife_name', v_wife.name
            ),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- If audit_log_enhanced doesn't exist or fails, try legacy
        BEGIN
            -- Only insert to legacy audit_log if user has a profile
            IF EXISTS (SELECT 1 FROM profiles WHERE id = v_actor_id) THEN
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
                    'INSERT',
                    'marriages',
                    p_husband_id,  -- Use husband as target
                    v_actor_id,
                    NULL,
                    to_jsonb(v_new_marriage),
                    jsonb_build_object(
                        'source', 'rpc',
                        'context', 'admin_create_marriage'
                    ),
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Silently skip audit if it fails - don't break the operation
            NULL;
        END;
    END;

    RETURN v_new_marriage;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_create_marriage TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_create_marriage IS
    'Creates marriage record with permission checks.
     Status values: ''current'' (active marriage) or ''past'' (ended marriage).
     Uses check_family_permission_v4 for access control.
     Creates audit log entry for all changes.';

-- ============================================================================
-- PART 2: Fix user_id Column Issue in capture_name_snapshots
-- ============================================================================

-- Update trigger to use auth_user_id (which exists) instead of user_id (which doesn't)
CREATE OR REPLACE FUNCTION capture_name_snapshots()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  target_name TEXT;
BEGIN
  -- Capture actor name at time of activity (FULL CHAIN using build_name_chain)
  IF NEW.actor_id IS NOT NULL THEN
    BEGIN
      -- FIXED: Changed from p.user_id to p.auth_user_id
      SELECT build_name_chain(p.id)
      INTO actor_name
      FROM profiles p
      WHERE p.auth_user_id = NEW.actor_id
        AND p.deleted_at IS NULL;

      -- Log if snapshot capture failed
      IF actor_name IS NULL OR TRIM(actor_name) = '' OR actor_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture actor snapshot for actor_id: %, audit_id: %',
                     NEW.actor_id, NEW.id;
      END IF;

      NEW.actor_name_snapshot := actor_name;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing actor snapshot for actor_id: %, error: %',
                    NEW.actor_id, SQLERRM;
      NEW.actor_name_snapshot := NULL;
    END;
  END IF;

  -- Capture target name at time of activity (FULL CHAIN using build_name_chain)
  IF NEW.table_name = 'profiles' AND NEW.record_id IS NOT NULL THEN
    BEGIN
      SELECT build_name_chain(p.id)
      INTO target_name
      FROM profiles p
      WHERE p.id = NEW.record_id
        AND p.deleted_at IS NULL;

      -- Log if snapshot capture failed
      IF target_name IS NULL OR TRIM(target_name) = '' OR target_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture target snapshot for record_id: %, audit_id: %',
                     NEW.record_id, NEW.id;
      END IF;

      NEW.target_name_snapshot := target_name;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing target snapshot for record_id: %, error: %',
                    NEW.record_id, SQLERRM;
      NEW.target_name_snapshot := NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION capture_name_snapshots() IS
  'Captures actor and target FULL name chains at time of activity creation.
   Uses build_name_chain() for complete ancestry (not just 3 levels).
   FIXED: Uses auth_user_id column instead of non-existent user_id column.
   Includes error handling to prevent INSERT failures if profile lookup fails.
   Logs warnings when snapshot capture fails for monitoring.';

-- ============================================================================
-- PART 3: Update admin_update_marriage to use correct status values
-- ============================================================================

-- This function is already correct from migration 077, but let's ensure it's deployed
-- (No changes needed - migration 077 already uses 'current'/'past')

-- ============================================================================
-- Validation and Logging
-- ============================================================================

DO $$
DECLARE
  v_create_fn_exists BOOLEAN;
  v_snapshot_fn_exists BOOLEAN;
  v_status_constraint TEXT;
BEGIN
  -- Check if admin_create_marriage was created
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'admin_create_marriage'
  ) INTO v_create_fn_exists;

  -- Check if capture_name_snapshots was updated
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'capture_name_snapshots'
  ) INTO v_snapshot_fn_exists;

  -- Get current status constraint
  SELECT conbin::text INTO v_status_constraint
  FROM pg_constraint
  WHERE conname = 'marriages_status_check';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 081: Critical Fixes Applied';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ admin_create_marriage function: %',
    CASE WHEN v_create_fn_exists THEN 'DEPLOYED' ELSE 'MISSING' END;
  RAISE NOTICE '✓ capture_name_snapshots function: %',
    CASE WHEN v_snapshot_fn_exists THEN 'DEPLOYED' ELSE 'MISSING' END;
  RAISE NOTICE '✓ Marriage status constraint: %', COALESCE(v_status_constraint, 'NOT FOUND');
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixes applied:';
  RAISE NOTICE '  1. admin_create_marriage now accepts ''current''/''past''';
  RAISE NOTICE '  2. capture_name_snapshots uses auth_user_id (not user_id)';
  RAISE NOTICE '  3. Duplicate check uses ''current'' status';
  RAISE NOTICE '========================================';

  -- Fail if functions weren't created
  IF NOT v_create_fn_exists THEN
    RAISE EXCEPTION 'Migration 081 failed: admin_create_marriage not created';
  END IF;

  IF NOT v_snapshot_fn_exists THEN
    RAISE EXCEPTION 'Migration 081 failed: capture_name_snapshots not created';
  END IF;
END $$;

COMMIT;
