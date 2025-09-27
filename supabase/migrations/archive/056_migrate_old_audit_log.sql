-- Migrate existing audit_log data to audit_log_enhanced
-- This preserves historical data while upgrading to the new schema

-- First, ensure the enhanced table exists (from previous migration)
-- Then migrate the old data

INSERT INTO audit_log_enhanced (
  id,
  actor_id,
  actor_name,
  actor_phone,
  actor_role,
  target_profile_id,
  target_name,
  target_hid,
  action_type,
  action_category,
  action_severity,
  action_description_ar,
  changes_json,
  affected_profiles,
  affected_count,
  created_at
)
SELECT 
  al.id,
  al.actor_id,
  COALESCE(actor_profile.name, 'غير معروف'),
  COALESCE(actor_profile.phone, ''),
  CASE 
    WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = al.actor_id) THEN 'admin'::user_role
    ELSE 'user'::user_role
  END,
  al.target_profile_id,
  COALESCE(target_profile.name, ''),
  COALESCE(target_profile.hid, ''),
  COALESCE(al.action, 'UNKNOWN'),
  CASE 
    WHEN al.action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'profile_data'::action_category
    WHEN al.action = 'REVERT' THEN 'admin_operation'::action_category
    ELSE 'profile_data'::action_category
  END,
  CASE 
    WHEN al.action = 'DELETE' THEN 'critical'::action_severity
    WHEN al.action IN ('UPDATE', 'INSERT') THEN 'medium'::action_severity
    ELSE 'low'::action_severity
  END,
  CASE al.action
    WHEN 'INSERT' THEN 'إضافة سجل جديد'
    WHEN 'UPDATE' THEN 'تحديث سجل'
    WHEN 'DELETE' THEN 'حذف سجل'
    WHEN 'REVERT' THEN 'تراجع عن عملية'
    ELSE al.action
  END,
  CASE 
    WHEN al.old_data IS NOT NULL OR al.new_data IS NOT NULL THEN
      jsonb_build_object(
        'before', al.old_data,
        'after', al.new_data
      )
    ELSE NULL
  END,
  CASE 
    WHEN al.target_profile_id IS NOT NULL THEN ARRAY[al.target_profile_id]
    ELSE NULL
  END,
  1,
  al.created_at
FROM audit_log al
LEFT JOIN profiles actor_profile ON al.actor_id = actor_profile.user_id
LEFT JOIN profiles target_profile ON al.target_profile_id = target_profile.id
WHERE NOT EXISTS (
  -- Don't duplicate if already migrated
  SELECT 1 FROM audit_log_enhanced ale WHERE ale.id = al.id
);

-- Add trigger to keep both tables in sync temporarily (for backwards compatibility)
CREATE OR REPLACE FUNCTION sync_to_enhanced_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_profile profiles%ROWTYPE;
  v_target_profile profiles%ROWTYPE;
  v_user_role user_role;
BEGIN
  -- Get actor details
  IF NEW.actor_id IS NOT NULL THEN
    SELECT * INTO v_actor_profile FROM profiles WHERE user_id = NEW.actor_id;
  END IF;
  
  -- Get target details  
  IF NEW.target_profile_id IS NOT NULL THEN
    SELECT * INTO v_target_profile FROM profiles WHERE id = NEW.target_profile_id;
  END IF;
  
  -- Determine role
  IF EXISTS (SELECT 1 FROM admins WHERE user_id = NEW.actor_id) THEN
    v_user_role := 'admin';
  ELSE
    v_user_role := 'user';
  END IF;
  
  -- Insert into enhanced table
  INSERT INTO audit_log_enhanced (
    id,
    actor_id,
    actor_name,
    actor_phone,
    actor_role,
    target_profile_id,
    target_name,
    target_hid,
    action_type,
    action_category,
    action_severity,
    action_description_ar,
    changes_json,
    affected_profiles,
    affected_count,
    created_at
  ) VALUES (
    NEW.id,
    NEW.actor_id,
    COALESCE(v_actor_profile.name, 'غير معروف'),
    COALESCE(v_actor_profile.phone, ''),
    v_user_role,
    NEW.target_profile_id,
    COALESCE(v_target_profile.name, ''),
    COALESCE(v_target_profile.hid, ''),
    COALESCE(NEW.action, 'UNKNOWN'),
    'profile_data'::action_category,
    CASE 
      WHEN NEW.action = 'DELETE' THEN 'critical'::action_severity
      WHEN NEW.action IN ('UPDATE', 'INSERT') THEN 'medium'::action_severity
      ELSE 'low'::action_severity
    END,
    CASE NEW.action
      WHEN 'INSERT' THEN 'إضافة سجل جديد'
      WHEN 'UPDATE' THEN 'تحديث سجل'
      WHEN 'DELETE' THEN 'حذف سجل'
      WHEN 'REVERT' THEN 'تراجع عن عملية'
      ELSE NEW.action
    END,
    CASE 
      WHEN NEW.old_data IS NOT NULL OR NEW.new_data IS NOT NULL THEN
        jsonb_build_object(
          'before', NEW.old_data,
          'after', NEW.new_data
        )
      ELSE NULL
    END,
    CASE 
      WHEN NEW.target_profile_id IS NOT NULL THEN ARRAY[NEW.target_profile_id]
      ELSE NULL
    END,
    1,
    NEW.created_at
  ) ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync new entries
CREATE TRIGGER sync_audit_to_enhanced
  AFTER INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_to_enhanced_audit();

-- Update the view to use the new enhanced table
CREATE OR REPLACE VIEW activity_log_detailed AS
SELECT 
  l.*,
  au.email as actor_email,
  tp.father_id,
  tp.mother_id,
  father.name as father_name,
  mother.name as mother_name,
  to_char(l.created_at, 'DD/MM/YYYY HH24:MI') as formatted_time,
  CASE 
    WHEN l.created_at > NOW() - INTERVAL '1 minute' THEN 'الآن'
    WHEN l.created_at > NOW() - INTERVAL '1 hour' THEN 'منذ ' || EXTRACT(MINUTE FROM NOW() - l.created_at) || ' دقيقة'
    WHEN l.created_at > NOW() - INTERVAL '24 hours' THEN 'منذ ' || EXTRACT(HOUR FROM NOW() - l.created_at) || ' ساعة'
    ELSE to_char(l.created_at, 'DD/MM/YYYY')
  END as relative_time
FROM audit_log_enhanced l
LEFT JOIN auth.users au ON l.actor_id = au.id
LEFT JOIN profiles tp ON l.target_profile_id = tp.id
LEFT JOIN profiles father ON tp.father_id = father.id
LEFT JOIN profiles mother ON tp.mother_id = mother.id
ORDER BY l.created_at DESC;

-- Grant permissions
GRANT SELECT ON activity_log_detailed TO authenticated;