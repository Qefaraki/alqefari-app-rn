-- Migration 061: Activity Log Visual Improvements (Combined)
-- Created: 2025-01-10
-- Purpose: Enable visual inline diffs and actor/target metadata in Activity Log Dashboard
-- Combines migrations 059 + 060 into single deployment

-- ============================================
-- PART 1: Fix Audit Trigger to Populate changed_fields
-- ============================================

-- Drop existing trigger to recreate with changed_fields logic
DROP TRIGGER IF EXISTS audit_profile_changes ON profiles;

-- Recreate the trigger function with changed_fields calculation
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_description TEXT;
BEGIN
  -- Get current user ID from session
  v_actor_id := auth.uid();

  -- Build JSONB representations
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
    v_description := 'Profile deleted: ' || OLD.name;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Calculate which fields changed (CRITICAL FIX)
    v_changed_fields := ARRAY(
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    );

    v_description := 'Profile updated: ' || NEW.name || ' (' || array_length(v_changed_fields, 1) || ' fields changed)';
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_changed_fields := NULL;
    v_description := 'Profile created: ' || NEW.name;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    v_actor_id,
    v_old_data,
    v_new_data,
    v_changed_fields,
    v_description,
    CASE
      WHEN TG_OP = 'DELETE' THEN 'high'
      WHEN TG_OP = 'INSERT' THEN 'medium'
      ELSE 'low'
    END,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_profile_changes();

-- ============================================
-- PART 2: Create Activity Log Detailed View
-- ============================================

-- Create the detailed view with correct JOINs
CREATE OR REPLACE VIEW public.activity_log_detailed AS
SELECT
  -- All original audit log columns
  al.id,
  al.created_at,
  al.actor_id,
  al.actor_type,
  al.action_type,
  al.action_category,
  al.table_name,
  al.record_id,
  al.target_type,
  al.old_data,
  al.new_data,
  al.changed_fields,
  al.description,
  al.ip_address,
  al.user_agent,
  al.severity,
  al.status,
  al.error_message,
  al.session_id,
  al.request_id,
  al.metadata,
  al.can_revert,
  al.reverted_at,
  al.reverted_by,

  -- Actor information (person who performed the action)
  actor_p.name as actor_name,
  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- Target information (profile being edited)
  target_p.name as target_name,
  target_p.phone as target_phone,
  target_p.hid as target_hid

FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.user_id
LEFT JOIN profiles target_p ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

-- Add comment for documentation
COMMENT ON VIEW activity_log_detailed IS 'Enhanced audit log view with actor and target profile information. Replaces direct queries to audit_log_enhanced table. Used by Activity Log Dashboard to display comprehensive activity metadata.';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 061 Complete';
  RAISE NOTICE '   - Audit trigger updated to populate changed_fields array';
  RAISE NOTICE '   - activity_log_detailed view created with actor/target metadata';
  RAISE NOTICE '   - Future UPDATE operations will track which specific fields changed';
  RAISE NOTICE '   - Activity Log Dashboard can now display visual inline diffs';
END $$;
