-- Apply New Migrations (019, 020, 021) Directly
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- ============================================
-- Migration 019: Fix RLS and Admin Security
-- ============================================

-- Step 1: Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can view non-deleted profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can soft delete profiles" ON profiles;

-- Step 2: Create secure get_current_user_role RPC
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE (
    user_id UUID,
    user_role TEXT,
    is_admin BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    SELECT 
        auth.uid() as user_id,
        COALESCE(p.role, 'user') as user_role,
        COALESCE(p.role = 'admin', FALSE) as is_admin
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = auth.uid();
$$;

-- Step 3: Create secure RLS policies for profiles
CREATE POLICY "Anyone can view non-deleted profiles" 
ON profiles FOR SELECT 
USING (deleted_at IS NULL);

CREATE POLICY "Admin users can insert profiles" 
ON profiles FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can update profiles" 
ON profiles FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can soft delete profiles" 
ON profiles FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- Step 4: Update background_jobs policies
DROP POLICY IF EXISTS "Admin users can view background jobs" ON background_jobs;
DROP POLICY IF EXISTS "Admin users can insert background jobs" ON background_jobs;
DROP POLICY IF EXISTS "Admin users can update background jobs" ON background_jobs;

CREATE POLICY "Admin users can view background jobs" 
ON background_jobs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can insert background jobs" 
ON background_jobs FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can update background jobs" 
ON background_jobs FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- Step 5: Update audit_log policies
DROP POLICY IF EXISTS "Admin users can view audit log" ON audit_log;

CREATE POLICY "Admin users can view audit log" 
ON audit_log FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- ============================================
-- Migration 020: Harden Bulk Create Children
-- ============================================

CREATE OR REPLACE FUNCTION admin_bulk_create_children(
    p_parent_id UUID,
    p_parent_gender TEXT,
    p_children JSONB
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    sibling_order INT,
    success BOOLEAN,
    error TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_child JSONB;
    v_child_id UUID;
    v_parent_hid TEXT;
    v_next_sibling_order INT;
    v_admin_check BOOLEAN;
    v_job_id UUID;
    v_lock_key BIGINT;
BEGIN
    -- Admin check using new secure function
    SELECT is_admin INTO v_admin_check FROM get_current_user_role();
    IF NOT v_admin_check THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Calculate lock key from parent_id for advisory lock
    v_lock_key := ('x' || substring(p_parent_id::text, 1, 8))::bit(32)::int;
    
    -- Acquire advisory lock for this parent to prevent concurrent modifications
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Create background job
    INSERT INTO background_jobs (
        type,
        status,
        total_items,
        processed_items,
        metadata
    ) VALUES (
        'bulk_create_children',
        'in_progress',
        jsonb_array_length(p_children),
        0,
        jsonb_build_object(
            'parent_id', p_parent_id,
            'parent_gender', p_parent_gender,
            'started_by', auth.uid()
        )
    ) RETURNING id INTO v_job_id;

    -- Get parent HID with lock
    SELECT hid INTO v_parent_hid 
    FROM profiles 
    WHERE id = p_parent_id 
    FOR UPDATE;

    IF v_parent_hid IS NULL THEN
        RAISE EXCEPTION 'Parent profile not found or has no HID';
    END IF;

    -- Get the next sibling order with stronger locking
    SELECT COALESCE(MAX(sibling_order), -1) + 1 INTO v_next_sibling_order
    FROM profiles 
    WHERE 
        CASE 
            WHEN p_parent_gender = 'male' THEN father_id = p_parent_id
            ELSE mother_id = p_parent_id
        END
    FOR UPDATE;

    -- Process each child
    FOR v_child IN SELECT * FROM jsonb_array_elements(p_children)
    LOOP
        BEGIN
            v_child_id := gen_random_uuid();
            
            -- Insert child with correct parent assignment
            IF p_parent_gender = 'male' THEN
                INSERT INTO profiles (
                    id, hid, name, gender, father_id, 
                    generation, sibling_order, kunya, nickname,
                    bio, birth_place, current_residence, occupation,
                    education, phone, email, status, created_by
                ) VALUES (
                    v_child_id,
                    v_parent_hid || '.' || v_next_sibling_order,
                    v_child->>'name',
                    v_child->>'gender',
                    p_parent_id,
                    (SELECT generation + 1 FROM profiles WHERE id = p_parent_id),
                    v_next_sibling_order,
                    v_child->>'kunya',
                    v_child->>'nickname',
                    v_child->>'bio',
                    v_child->>'birth_place',
                    v_child->>'current_residence',
                    v_child->>'occupation',
                    v_child->>'education',
                    v_child->>'phone',
                    v_child->>'email',
                    COALESCE(v_child->>'status', 'alive'),
                    auth.uid()
                );
            ELSE
                INSERT INTO profiles (
                    id, hid, name, gender, mother_id, 
                    generation, sibling_order, kunya, nickname,
                    bio, birth_place, current_residence, occupation,
                    education, phone, email, status, created_by
                ) VALUES (
                    v_child_id,
                    v_parent_hid || '.' || v_next_sibling_order,
                    v_child->>'name',
                    v_child->>'gender',
                    p_parent_id,
                    (SELECT generation + 1 FROM profiles WHERE id = p_parent_id),
                    v_next_sibling_order,
                    v_child->>'kunya',
                    v_child->>'nickname',
                    v_child->>'bio',
                    v_child->>'birth_place',
                    v_child->>'current_residence',
                    v_child->>'occupation',
                    v_child->>'education',
                    v_child->>'phone',
                    v_child->>'email',
                    COALESCE(v_child->>'status', 'alive'),
                    auth.uid()
                );
            END IF;

            -- Log to audit
            INSERT INTO audit_log (
                table_name,
                record_id,
                action,
                changed_by,
                old_data,
                new_data,
                metadata
            ) VALUES (
                'profiles',
                v_child_id,
                'BULK_INSERT',
                auth.uid(),
                NULL,
                row_to_json((SELECT p FROM profiles p WHERE p.id = v_child_id))::jsonb,
                jsonb_build_object(
                    'bulk_job_id', v_job_id,
                    'parent_id', p_parent_id,
                    'sibling_order', v_next_sibling_order
                )
            );

            -- Update job progress
            UPDATE background_jobs 
            SET 
                processed_items = processed_items + 1,
                updated_at = NOW()
            WHERE id = v_job_id;

            -- Return success for this child
            RETURN QUERY SELECT 
                v_child_id,
                v_child->>'name',
                v_next_sibling_order,
                TRUE,
                NULL::TEXT;

            -- Increment sibling order for next child
            v_next_sibling_order := v_next_sibling_order + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Return error for this child
            RETURN QUERY SELECT 
                NULL::UUID,
                v_child->>'name',
                v_next_sibling_order,
                FALSE,
                SQLERRM;
                
            -- Continue with next child
            v_next_sibling_order := v_next_sibling_order + 1;
        END;
    END LOOP;

    -- Update job status
    UPDATE background_jobs 
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_job_id;

END;
$$;

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
-- Insert Migration Records
-- ============================================
-- Record these migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES
('019_fix_rls_and_admin_security', '019_fix_rls_and_admin_security', ARRAY['-- Migration 019 content']),
('020_harden_bulk_create_children', '020_harden_bulk_create_children', ARRAY['-- Migration 020 content']),
('021_add_version_checks_to_revert', '021_add_version_checks_to_revert', ARRAY['-- Migration 021 content'])
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- Verification
-- ============================================
-- Check that all functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN (
    'get_current_user_role',
    'admin_bulk_create_children', 
    'admin_revert_action'
);

-- Test the get_current_user_role function
SELECT * FROM get_current_user_role();

-- Check migration history
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version LIKE '019%' OR version LIKE '020%' OR version LIKE '021%'
ORDER BY version;