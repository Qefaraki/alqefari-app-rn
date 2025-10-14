-- Create the activity_log_detailed view for the dashboard
CREATE OR REPLACE VIEW public.activity_log_detailed AS
SELECT 
  al.id,
  al.created_at,
  al.actor_id,
  al.action_type,
  al.table_name,
  al.record_id as target_id,
  al.old_data,
  al.new_data,
  al.description,
  al.ip_address,
  al.user_agent,
  al.severity,
  al.status,
  al.session_id,
  al.request_id,
  al.metadata,
  
  -- Actor details
  actor_p.display_name as actor_name,
  actor_p.phone as actor_phone,
  CASE 
    WHEN actor_p.is_super_admin THEN 'super_admin'
    WHEN actor_p.is_admin THEN 'admin'
    ELSE 'user'
  END as actor_role,
  
  -- Target details (if it's a profile)
  target_p.display_name as target_name,
  target_p.phone as target_phone,
  
  -- Computed fields
  CASE 
    WHEN al.old_data IS NOT NULL AND al.action_type IN ('delete_node', 'delete_marriage', 'delete_photo')
    THEN true
    ELSE false
  END as can_revert
  
FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.id
LEFT JOIN profiles target_p ON al.record_id = target_p.id AND al.table_name = 'profiles';

-- Grant access to the view
GRANT SELECT ON public.activity_log_detailed TO authenticated;
GRANT SELECT ON public.activity_log_detailed TO anon;

-- Create indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_audit_log_enhanced_created_at 
ON audit_log_enhanced(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_enhanced_actor_id 
ON audit_log_enhanced(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_enhanced_action_type 
ON audit_log_enhanced(action_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_enhanced_severity 
ON audit_log_enhanced(severity);