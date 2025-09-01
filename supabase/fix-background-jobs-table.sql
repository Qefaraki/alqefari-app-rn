-- Fix background_jobs table structure
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- First, check if background_jobs table exists and its structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'background_jobs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop the existing background_jobs table if it exists with wrong structure
DROP TABLE IF EXISTS background_jobs CASCADE;

-- Create background_jobs table with correct structure (matching what migration 020 expects)
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,  -- Changed from job_type to type
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
    total_items INT,
    processed_items INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_background_jobs_recent ON background_jobs (type, status, created_at DESC);

-- Enable Row Level Security
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON background_jobs TO authenticated;
GRANT INSERT, UPDATE ON background_jobs TO authenticated;

-- Create RLS policies for background_jobs
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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE background_jobs;

-- Now re-run the admin_bulk_create_children function
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

-- Update migration records
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES
('014_create_background_jobs', '014_create_background_jobs', ARRAY['-- Migration 014 content']),
('020_harden_bulk_create_children', '020_harden_bulk_create_children', ARRAY['-- Migration 020 content'])
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

-- Verify the fix
SELECT 'Verification:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'background_jobs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test the function exists
SELECT proname FROM pg_proc WHERE proname = 'admin_bulk_create_children';