-- Enhanced Audit Log System for Complete Activity Tracking
-- Includes tree operations, role tracking, and full actor details

-- First, add role system to track permission levels
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'moderator', 'user', 'system');

-- Add role column to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'admin';

-- Create comprehensive action categories
CREATE TYPE action_category AS ENUM (
  'tree_structure',    -- Parent/child changes
  'profile_data',      -- Name, dates, bio edits
  'relationships',     -- Marriages, divorces
  'admin_operation',   -- Bulk changes, validations
  'authentication',    -- Login, logout, permissions
  'system_automated'   -- Auto-fixes, calculations
);

-- Create severity levels for filtering
CREATE TYPE action_severity AS ENUM (
  'critical',  -- Deletions, mass changes
  'high',      -- Profile modifications
  'medium',    -- Normal edits
  'low',       -- Views, searches
  'info'       -- Login/logout
);

-- Enhanced audit log table
CREATE TABLE IF NOT EXISTS audit_log_enhanced (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Actor Information (who did it)
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  actor_phone TEXT, -- Full phone number as requested
  actor_role user_role DEFAULT 'user',
  actor_ip_address INET,
  actor_device TEXT, -- iOS/Android/Web
  actor_user_agent TEXT,
  
  -- Target Information (what was affected)
  target_profile_id UUID REFERENCES profiles(id),
  target_name TEXT,
  target_hid TEXT,
  
  -- Action Details
  action_type TEXT NOT NULL, -- Specific operation
  action_category action_category,
  action_severity action_severity,
  action_description_ar TEXT, -- Arabic description for UI
  action_description_en TEXT, -- English for debugging
  
  -- Change Tracking
  changes_json JSONB, -- Before/after values
  affected_profiles UUID[], -- Array of affected profile IDs
  affected_count INTEGER DEFAULT 1,
  
  -- Performance & Debugging
  execution_time_ms INTEGER,
  session_id UUID,
  request_id UUID,
  parent_action_id UUID REFERENCES audit_log_enhanced(id),
  
  -- Reversion Tracking
  is_revertable BOOLEAN DEFAULT false,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES auth.users(id),
  revert_action_id UUID REFERENCES audit_log_enhanced(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  app_version TEXT,
  
  -- Search optimization
  search_vector tsvector
);

-- Indexes for performance
CREATE INDEX idx_audit_enhanced_actor_id ON audit_log_enhanced(actor_id);
CREATE INDEX idx_audit_enhanced_target_profile ON audit_log_enhanced(target_profile_id);
CREATE INDEX idx_audit_enhanced_created_at ON audit_log_enhanced(created_at DESC);
CREATE INDEX idx_audit_enhanced_action_type ON audit_log_enhanced(action_type);
CREATE INDEX idx_audit_enhanced_action_category ON audit_log_enhanced(action_category);
CREATE INDEX idx_audit_enhanced_action_severity ON audit_log_enhanced(action_severity);
CREATE INDEX idx_audit_enhanced_actor_role ON audit_log_enhanced(actor_role);
CREATE INDEX idx_audit_enhanced_session ON audit_log_enhanced(session_id);
CREATE INDEX idx_audit_enhanced_search ON audit_log_enhanced USING GIN(search_vector);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_audit_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('arabic', coalesce(NEW.actor_name, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(NEW.target_name, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(NEW.action_description_ar, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.actor_phone, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.action_type, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_audit_search
  BEFORE INSERT OR UPDATE ON audit_log_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_search_vector();

-- Function to log tree operations with full context
CREATE OR REPLACE FUNCTION log_tree_operation(
  p_action_type TEXT,
  p_target_profile_id UUID,
  p_changes JSONB DEFAULT NULL,
  p_affected_profiles UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_actor_id UUID;
  v_actor_profile profiles%ROWTYPE;
  v_target_profile profiles%ROWTYPE;
  v_action_category action_category;
  v_action_severity action_severity;
  v_description_ar TEXT;
  v_user_role user_role;
  v_log_id UUID;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();
  
  -- Get actor details
  SELECT * INTO v_actor_profile FROM profiles WHERE user_id = v_actor_id;
  
  -- Get target details
  IF p_target_profile_id IS NOT NULL THEN
    SELECT * INTO v_target_profile FROM profiles WHERE id = p_target_profile_id;
  END IF;
  
  -- Determine user role
  IF EXISTS (SELECT 1 FROM admins WHERE user_id = v_actor_id AND role = 'super_admin') THEN
    v_user_role := 'super_admin';
  ELSIF EXISTS (SELECT 1 FROM admins WHERE user_id = v_actor_id) THEN
    v_user_role := 'admin';
  ELSE
    v_user_role := 'user';
  END IF;
  
  -- Categorize action
  v_action_category := CASE 
    WHEN p_action_type IN ('PROFILE_DELETE', 'PARENT_CHANGE', 'CHILD_ADD', 'CHILD_REMOVE') THEN 'tree_structure'
    WHEN p_action_type IN ('PROFILE_UPDATE_NAME', 'PROFILE_UPDATE_DOB', 'PROFILE_UPDATE_BIO') THEN 'profile_data'
    WHEN p_action_type IN ('MARRIAGE_ADD', 'MARRIAGE_DELETE', 'SPOUSE_LINK') THEN 'relationships'
    WHEN p_action_type IN ('BULK_IMPORT', 'BULK_UPDATE', 'TREE_VALIDATION') THEN 'admin_operation'
    ELSE 'profile_data'
  END;
  
  -- Determine severity
  v_action_severity := CASE
    WHEN p_action_type IN ('PROFILE_DELETE', 'BULK_DELETE', 'BRANCH_MERGE') THEN 'critical'
    WHEN p_action_type IN ('PARENT_CHANGE', 'MARRIAGE_DELETE') THEN 'high'
    WHEN p_action_type LIKE 'PROFILE_UPDATE_%' THEN 'medium'
    WHEN p_action_type LIKE '%VIEW%' THEN 'low'
    ELSE 'medium'
  END;
  
  -- Generate Arabic description
  v_description_ar := CASE p_action_type
    WHEN 'PROFILE_CREATE' THEN 'إضافة شخص جديد'
    WHEN 'PROFILE_UPDATE_NAME' THEN 'تغيير الاسم'
    WHEN 'PROFILE_UPDATE_DOB' THEN 'تغيير تاريخ الميلاد'
    WHEN 'PROFILE_DELETE' THEN 'حذف شخص'
    WHEN 'PARENT_CHANGE' THEN 'تغيير الوالد/الوالدة'
    WHEN 'CHILD_ADD' THEN 'إضافة ابن/ابنة'
    WHEN 'CHILD_REMOVE' THEN 'إزالة ابن/ابنة'
    WHEN 'MARRIAGE_ADD' THEN 'إضافة زواج'
    WHEN 'MARRIAGE_DELETE' THEN 'حذف زواج'
    WHEN 'BULK_IMPORT' THEN 'استيراد جماعي'
    ELSE 'عملية على الشجرة'
  END;
  
  -- Insert log entry
  INSERT INTO audit_log_enhanced (
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
    is_revertable
  ) VALUES (
    v_actor_id,
    v_actor_profile.name,
    v_actor_profile.phone,
    v_user_role,
    p_target_profile_id,
    v_target_profile.name,
    v_target_profile.hid,
    p_action_type,
    v_action_category,
    v_action_severity,
    v_description_ar,
    p_changes,
    p_affected_profiles,
    COALESCE(array_length(p_affected_profiles, 1), 1),
    p_action_type NOT IN ('PROFILE_DELETE', 'BULK_DELETE') -- Can't revert deletions easily
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log profile changes
CREATE OR REPLACE FUNCTION auto_log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB;
  v_action_type TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'PROFILE_CREATE';
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect specific change type
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      v_action_type := 'PROFILE_UPDATE_NAME';
    ELSIF OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth THEN
      v_action_type := 'PROFILE_UPDATE_DOB';
    ELSIF OLD.bio IS DISTINCT FROM NEW.bio THEN
      v_action_type := 'PROFILE_UPDATE_BIO';
    ELSE
      v_action_type := 'PROFILE_UPDATE';
    END IF;
    
    v_changes := jsonb_build_object(
      'before', to_jsonb(OLD),
      'after', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'PROFILE_DELETE';
    v_changes := to_jsonb(OLD);
  END IF;
  
  -- Log the operation
  PERFORM log_tree_operation(v_action_type, COALESCE(NEW.id, OLD.id), v_changes);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Enable automatic logging for profiles table
CREATE TRIGGER trigger_log_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_log_profile_changes();

-- View for easy querying with all details
CREATE OR REPLACE VIEW activity_log_detailed AS
SELECT 
  l.*,
  -- Actor user details
  au.email as actor_email,
  -- Target relationships
  tp.father_id,
  tp.mother_id,
  father.name as father_name,
  mother.name as mother_name,
  -- Time formatting
  to_char(l.created_at, 'DD/MM/YYYY HH24:MI') as formatted_time,
  -- Relative time (for UI)
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
LEFT JOIN profiles mother ON tp.mother_id = mother.id;

-- Function to get activity stats for dashboard
CREATE OR REPLACE FUNCTION get_activity_stats(
  p_time_range INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  total_actions BIGINT,
  unique_actors BIGINT,
  profiles_modified BIGINT,
  critical_actions BIGINT,
  top_actor_name TEXT,
  top_actor_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_actions,
    COUNT(DISTINCT actor_id)::BIGINT as unique_actors,
    COUNT(DISTINCT target_profile_id)::BIGINT as profiles_modified,
    COUNT(*) FILTER (WHERE action_severity = 'critical')::BIGINT as critical_actions,
    (SELECT actor_name FROM audit_log_enhanced 
     WHERE created_at > NOW() - p_time_range 
     GROUP BY actor_name 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as top_actor_name,
    (SELECT COUNT(*)::BIGINT FROM audit_log_enhanced 
     WHERE created_at > NOW() - p_time_range 
     AND actor_name = (SELECT actor_name FROM audit_log_enhanced 
                       WHERE created_at > NOW() - p_time_range 
                       GROUP BY actor_name 
                       ORDER BY COUNT(*) DESC 
                       LIMIT 1)) as top_actor_count
  FROM audit_log_enhanced
  WHERE created_at > NOW() - p_time_range;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT SELECT ON audit_log_enhanced TO authenticated;
GRANT INSERT ON audit_log_enhanced TO authenticated;
GRANT SELECT ON activity_log_detailed TO authenticated;
GRANT EXECUTE ON FUNCTION log_tree_operation TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_stats TO authenticated;