-- Create profile_link_requests table for profile claiming system
-- This table tracks user requests to claim/link their account to a family tree profile

CREATE TABLE IF NOT EXISTS profile_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    phone TEXT NOT NULL,
    verification_method TEXT DEFAULT 'phone' CHECK (verification_method IN ('phone', 'admin_approval')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_notes TEXT,
    withdrawn_at TIMESTAMPTZ,
    can_resubmit BOOLEAN DEFAULT TRUE,

    -- Ensure user can only have one active request per profile
    CONSTRAINT unique_active_request UNIQUE (user_id, profile_id, status)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_user_id ON profile_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_profile_id ON profile_link_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_status ON profile_link_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_created_at ON profile_link_requests(created_at DESC);

-- Enable RLS
ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own requests
CREATE POLICY "Users can view their own link requests"
    ON profile_link_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create their own link requests"
    ON profile_link_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update (withdraw) their own pending requests
CREATE POLICY "Users can withdraw their own pending requests"
    ON profile_link_requests
    FOR UPDATE
    USING (
        auth.uid() = user_id
        AND status = 'pending'
    )
    WITH CHECK (
        auth.uid() = user_id
        AND status IN ('withdrawn', 'pending')
    );

-- Admins can view all requests
CREATE POLICY "Admins can view all link requests"
    ON profile_link_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Admins can update (approve/reject) requests
CREATE POLICY "Admins can review link requests"
    ON profile_link_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON profile_link_requests TO authenticated;
GRANT SELECT ON profile_link_requests TO anon;

-- Add helpful comment
COMMENT ON TABLE profile_link_requests IS 'Stores user requests to claim/link their account to a family tree profile. Uses phone verification or admin approval.';
