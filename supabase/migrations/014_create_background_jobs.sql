-- Create background_jobs table for tracking asynchronous operations
-- This enables visibility into long-running processes like layout recalculation

-- Create enum for job types
CREATE TYPE job_type AS ENUM ('layout_recalculation');

-- Create enum for job status
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'complete', 'failed');

-- Create background_jobs table
CREATE TABLE IF NOT EXISTS background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'queued',
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Constraints
    CONSTRAINT started_requires_processing CHECK (
        (started_at IS NULL) OR (status IN ('processing', 'complete', 'failed'))
    ),
    CONSTRAINT completed_requires_finished CHECK (
        (completed_at IS NULL) OR (status IN ('complete', 'failed'))
    ),
    CONSTRAINT failed_requires_error CHECK (
        (status != 'failed') OR (error_message IS NOT NULL)
    )
);

-- Create indexes for efficient querying
CREATE INDEX idx_background_jobs_recent ON background_jobs (job_type, status, created_at DESC);
CREATE INDEX idx_background_jobs_active ON background_jobs (status) WHERE status IN ('queued', 'processing');

-- Enable RLS
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all background jobs
CREATE POLICY "Admins can view background jobs"
    ON background_jobs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
        )
    );

-- Policy: Service role can manage background jobs
CREATE POLICY "Service role can manage background jobs"
    ON background_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to clean up old completed jobs (retention: 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_background_jobs()
RETURNS void AS $$
BEGIN
    DELETE FROM background_jobs
    WHERE status IN ('complete', 'failed')
    AND completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to create a background job
CREATE OR REPLACE FUNCTION create_background_job(
    p_job_type job_type,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    job_id UUID;
BEGIN
    INSERT INTO background_jobs (job_type, details)
    VALUES (p_job_type, p_details)
    RETURNING id INTO job_id;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to update job status
CREATE OR REPLACE FUNCTION update_background_job_status(
    p_job_id UUID,
    p_status job_status,
    p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    UPDATE background_jobs
    SET 
        status = p_status,
        started_at = CASE 
            WHEN p_status = 'processing' AND started_at IS NULL 
            THEN NOW() 
            ELSE started_at 
        END,
        completed_at = CASE 
            WHEN p_status IN ('complete', 'failed') 
            THEN NOW() 
            ELSE completed_at 
        END,
        error_message = COALESCE(p_error_message, error_message)
    WHERE id = p_job_id
    RETURNING jsonb_build_object(
        'id', id,
        'status', status,
        'started_at', started_at,
        'completed_at', completed_at,
        'error_message', error_message
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger_layout_recalc_async to use background_jobs
CREATE OR REPLACE FUNCTION trigger_layout_recalc_async(affected_node_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    job_id UUID;
    node_info JSONB;
BEGIN
    -- Get node information for job details
    SELECT jsonb_build_object(
        'node_id', id,
        'node_name', name,
        'hid', hid
    ) INTO node_info
    FROM profiles
    WHERE id = affected_node_id;
    
    -- Create a background job
    job_id := create_background_job(
        'layout_recalculation'::job_type,
        jsonb_build_object(
            'affected_node_id', affected_node_id,
            'node_info', node_info,
            'triggered_at', NOW()
        )
    );
    
    -- Queue the recalculation job (existing table for compatibility)
    INSERT INTO layout_recalc_queue (node_id, queued_at, status)
    VALUES (affected_node_id, NOW(), 'pending')
    ON CONFLICT (node_id) 
    DO UPDATE SET queued_at = NOW(), status = 'pending';
    
    result := jsonb_build_object(
        'status', 'queued',
        'node_id', affected_node_id,
        'job_id', job_id,
        'timestamp', NOW()
    );
    
    -- In production, this would invoke Edge Function:
    -- PERFORM net.http_post(
    --     url := current_setting('app.edge_function_url') || '/recalculate-layout',
    --     body := jsonb_build_object('affected_node_id', affected_node_id, 'job_id', job_id)
    -- );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON TYPE job_type TO authenticated, service_role;
GRANT USAGE ON TYPE job_status TO authenticated, service_role;
GRANT SELECT ON background_jobs TO authenticated;
GRANT ALL ON background_jobs TO service_role;
GRANT EXECUTE ON FUNCTION create_background_job TO service_role;
GRANT EXECUTE ON FUNCTION update_background_job_status TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_background_jobs TO service_role;