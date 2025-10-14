-- Create audit_log table for tracking all database changes
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'REVERT', 'BULK_INSERT')),
    table_name TEXT NOT NULL,
    target_profile_id UUID REFERENCES profiles(id),
    actor_id UUID REFERENCES profiles(id),
    old_data JSONB,
    new_data JSONB,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    reverted_at TIMESTAMPTZ,
    reverted_by UUID REFERENCES profiles(id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_audit_log_actor ON audit_log (actor_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log (target_profile_id, created_at DESC);
CREATE INDEX idx_audit_log_recent ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log (action, table_name, created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs" ON audit_log
    FOR SELECT
    USING (is_admin());

-- System can insert audit logs (via triggers and functions)
CREATE POLICY "System can insert audit logs" ON audit_log
    FOR INSERT
    WITH CHECK (true);

-- Only allow updates to set reverted fields
CREATE POLICY "System can update revert fields" ON audit_log
    FOR UPDATE
    USING (reverted_at IS NULL)
    WITH CHECK (
        -- Only allow updating reverted_at and reverted_by
        (NEW.id = OLD.id) AND
        (NEW.action = OLD.action) AND
        (NEW.table_name = OLD.table_name) AND
        (NEW.target_profile_id IS NOT DISTINCT FROM OLD.target_profile_id) AND
        (NEW.actor_id = OLD.actor_id) AND
        (NEW.old_data IS NOT DISTINCT FROM OLD.old_data) AND
        (NEW.new_data IS NOT DISTINCT FROM OLD.new_data) AND
        (NEW.created_at = OLD.created_at) AND
        (NEW.reverted_at IS NOT NULL) AND
        (NEW.reverted_by IS NOT NULL)
    );

-- Grant necessary permissions
GRANT SELECT ON audit_log TO authenticated;
GRANT INSERT, UPDATE ON audit_log TO authenticated;

-- Enable realtime for audit_log (for activity feeds)
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Create function to automatically log profile changes
CREATE OR REPLACE FUNCTION log_profile_changes() RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    END IF;

    -- Insert audit log entry
    INSERT INTO audit_log (
        action, 
        table_name, 
        target_profile_id,
        actor_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_action,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        auth.uid(),
        v_old_data,
        v_new_data,
        now()
    );

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS trigger_log_profile_changes ON profiles;
CREATE TRIGGER trigger_log_profile_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_profile_changes();