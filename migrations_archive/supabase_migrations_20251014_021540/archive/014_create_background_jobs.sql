-- Create background_jobs table for tracking asynchronous tasks
CREATE TABLE IF NOT EXISTS background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('layout_recalculation')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'complete', 'failed')) DEFAULT 'queued',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id)
);

-- Create index for efficient queries on recent jobs
CREATE INDEX idx_background_jobs_recent ON background_jobs (job_type, status, created_at DESC);

-- Enable Row Level Security
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all background jobs
CREATE POLICY "Admins can view background jobs" ON background_jobs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Service role can insert and update (for Edge Functions)
CREATE POLICY "Service role can manage background jobs" ON background_jobs
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON background_jobs TO authenticated;
GRANT ALL ON background_jobs TO service_role;

-- Enable realtime for background_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE background_jobs;