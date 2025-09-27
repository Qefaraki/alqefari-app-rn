-- Create media_uploads table (The Media Approval Workflow)
CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_user_id UUID NOT NULL REFERENCES auth.users(id),
    target_profile_id UUID NOT NULL REFERENCES profiles(id),
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'profile_photo',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_admin_id UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX idx_media_uploads_status ON media_uploads(status);
CREATE INDEX idx_media_uploads_target_profile ON media_uploads(target_profile_id);
CREATE INDEX idx_media_uploads_uploader ON media_uploads(uploader_user_id);
CREATE INDEX idx_media_uploads_created_at ON media_uploads(created_at DESC);