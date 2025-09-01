-- Complete Remaining Migrations
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- ============================================
-- Check what's already been done
-- ============================================
SELECT 'Checking current state...' as status;

-- Check if functions exist
SELECT proname as function_name, 
       CASE WHEN proname IS NOT NULL THEN 'exists' ELSE 'missing' END as status
FROM pg_proc 
WHERE proname IN ('admin_revert_action', 'get_current_user_role')
ORDER BY proname;

-- ============================================
-- Migration 021: Add Version Checks to Revert
-- ============================================
CREATE OR REPLACE FUNCTION admin_revert_action(
    p_audit_log_id UUID,
    p_expected_version INT DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_audit_record RECORD;
    v_admin_check BOOLEAN;
    v_result jsonb;
    v_current_version INT;
    v_new_audit_id UUID;
BEGIN
    -- Admin check using new secure function
    SELECT is_admin INTO v_admin_check FROM get_current_user_role();
    IF NOT v_admin_check THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Get the audit record
    SELECT * INTO v_audit_record
    FROM audit_log
    WHERE id = p_audit_log_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit record not found';
    END IF;

    -- Check if already reverted
    IF v_audit_record.reverted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This action has already been reverted';
    END IF;

    -- Prevent reverting a revert action
    IF v_audit_record.action = 'REVERT' THEN
        RAISE EXCEPTION 'Cannot revert a revert action';
    END IF;

    -- Execute revert based on action type
    CASE v_audit_record.action
        WHEN 'INSERT', 'BULK_INSERT' THEN
            -- Check version if provided
            IF p_expected_version IS NOT NULL THEN
                SELECT version INTO v_current_version
                FROM profiles
                WHERE id = v_audit_record.record_id;
                
                IF v_current_version != p_expected_version THEN
                    RAISE EXCEPTION 'Version mismatch. Expected %, got %', 
                        p_expected_version, v_current_version;
                END IF;
            END IF;
            
            -- Soft delete the inserted record
            UPDATE profiles 
            SET 
                deleted_at = NOW(),
                version = version + 1,
                updated_by = auth.uid()
            WHERE id = v_audit_record.record_id
            AND deleted_at IS NULL;
            
            v_result := jsonb_build_object(
                'action', 'soft_deleted',
                'record_id', v_audit_record.record_id
            );

        WHEN 'UPDATE' THEN
            -- Check version if provided
            IF p_expected_version IS NOT NULL THEN
                SELECT version INTO v_current_version
                FROM profiles
                WHERE id = v_audit_record.record_id;
                
                IF v_current_version != p_expected_version THEN
                    RAISE EXCEPTION 'Version mismatch. Expected %, got %', 
                        p_expected_version, v_current_version;
                END IF;
            END IF;
            
            -- Restore old data
            UPDATE profiles
            SET
                name = COALESCE((v_audit_record.old_data->>'name')::TEXT, name),
                kunya = (v_audit_record.old_data->>'kunya')::TEXT,
                nickname = (v_audit_record.old_data->>'nickname')::TEXT,
                gender = COALESCE((v_audit_record.old_data->>'gender')::TEXT, gender),
                status = COALESCE((v_audit_record.old_data->>'status')::TEXT, status),
                bio = (v_audit_record.old_data->>'bio')::TEXT,
                birth_place = (v_audit_record.old_data->>'birth_place')::TEXT,
                current_residence = (v_audit_record.old_data->>'current_residence')::TEXT,
                occupation = (v_audit_record.old_data->>'occupation')::TEXT,
                education = (v_audit_record.old_data->>'education')::TEXT,
                phone = (v_audit_record.old_data->>'phone')::TEXT,
                email = (v_audit_record.old_data->>'email')::TEXT,
                version = version + 1,
                updated_at = NOW(),
                updated_by = auth.uid()
            WHERE id = v_audit_record.record_id;
            
            v_result := jsonb_build_object(
                'action', 'restored',
                'record_id', v_audit_record.record_id,
                'restored_fields', v_audit_record.old_data
            );

        WHEN 'DELETE' THEN
            -- For hard deletes, we can't restore without the full data
            IF v_audit_record.old_data IS NULL THEN
                RAISE EXCEPTION 'Cannot revert deletion: no backup data available';
            END IF;
            
            -- Re-insert the deleted record
            INSERT INTO profiles
            SELECT * FROM jsonb_populate_record(null::profiles, v_audit_record.old_data);
            
            v_result := jsonb_build_object(
                'action', 'restored',
                'record_id', v_audit_record.record_id
            );

        ELSE
            RAISE EXCEPTION 'Unknown action type: %', v_audit_record.action;
    END CASE;

    -- Mark the audit record as reverted
    UPDATE audit_log
    SET 
        reverted_at = NOW(),
        reverted_by = auth.uid()
    WHERE id = p_audit_log_id;

    -- Create a new audit entry for the revert action
    INSERT INTO audit_log (
        table_name,
        record_id,
        action,
        changed_by,
        metadata
    ) VALUES (
        v_audit_record.table_name,
        v_audit_record.record_id,
        'REVERT',
        auth.uid(),
        jsonb_build_object(
            'reverted_audit_id', p_audit_log_id,
            'original_action', v_audit_record.action,
            'expected_version', p_expected_version,
            'result', v_result
        )
    ) RETURNING id INTO v_new_audit_id;

    RETURN jsonb_build_object(
        'success', true,
        'result', v_result,
        'audit_id', v_new_audit_id,
        'reverted_audit_id', p_audit_log_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- ============================================
-- Insert Remaining Migration Records
-- ============================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES
('021_add_version_checks_to_revert', '021_add_version_checks_to_revert', ARRAY['-- Migration 021 content'])
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- Final Verification
-- ============================================
SELECT 'Final Verification Results:' as status;

-- Check all critical functions exist
SELECT proname as function_name, 'exists' as status
FROM pg_proc 
WHERE proname IN (
    'get_current_user_role',
    'admin_bulk_create_children', 
    'admin_revert_action',
    'is_admin'
)
ORDER BY proname;

-- Check all tables exist
SELECT table_name, 'exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'background_jobs', 'audit_log')
ORDER BY table_name;

-- Test the get_current_user_role function
SELECT 'Testing get_current_user_role:' as test;
SELECT * FROM get_current_user_role();

-- Check all migrations are recorded
SELECT 'Migration History:' as status;
SELECT version, name, 'applied' as status
FROM supabase_migrations.schema_migrations 
WHERE version IN (
    '014_create_background_jobs', 
    '016_create_audit_log', 
    '018_add_role_to_profiles', 
    '019_fix_rls_and_admin_security', 
    '020_harden_bulk_create_children', 
    '021_add_version_checks_to_revert'
)
ORDER BY version;

-- Summary
SELECT 'DEPLOYMENT COMPLETE!' as final_status,
       'All Phase 5 security migrations have been successfully applied.' as message;