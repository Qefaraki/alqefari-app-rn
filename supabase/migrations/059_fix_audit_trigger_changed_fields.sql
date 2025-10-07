-- Migration 059: Fix Audit Trigger to Populate changed_fields Array
-- Created: 2025-01-10
-- Purpose: Update log_profile_changes() trigger to calculate which fields changed
-- This enables field-by-field diff display in Activity Log Dashboard

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
    action,
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

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 059: Audit trigger updated to populate changed_fields array';
  RAISE NOTICE 'Future UPDATE operations will now track which specific fields changed';
END $$;
