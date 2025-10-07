-- Migration 063: Complete Activity Log Visual System (COMBINED)
-- Created: 2025-01-10
-- Purpose: Single deployment for all activity log improvements
-- Combines: 061 (visual diffs) + 062 (name chains)

-- ============================================
-- PART 1: Fix Audit Trigger to Populate changed_fields
-- ============================================

-- Drop both old and new trigger names to prevent duplicates
DROP TRIGGER IF EXISTS trigger_log_profile_changes ON profiles;
DROP TRIGGER IF EXISTS audit_profile_changes ON profiles;

CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_description TEXT;
BEGIN
  v_actor_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
    v_description := 'Profile deleted: ' || OLD.name;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Calculate which fields changed
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

CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_profile_changes();

-- ============================================
-- PART 2: Create Name Chain Builder Function
-- ============================================

CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
  v_father_id UUID;
  v_father_name TEXT;
  v_chain TEXT := '';
  v_current_id UUID := p_profile_id;
  v_max_depth INT := 10;
  v_depth INT := 0;
BEGIN
  -- Get the person's name
  SELECT name INTO v_name FROM profiles WHERE id = p_profile_id;

  IF v_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Start with person's name
  v_chain := v_name;

  -- Build ancestry chain
  LOOP
    v_depth := v_depth + 1;
    EXIT WHEN v_depth >= v_max_depth;

    SELECT father_id INTO v_father_id
    FROM profiles
    WHERE id = v_current_id;

    EXIT WHEN v_father_id IS NULL;

    SELECT name INTO v_father_name
    FROM profiles
    WHERE id = v_father_id;

    EXIT WHEN v_father_name IS NULL;

    v_chain := v_chain || ' بن ' || v_father_name;
    v_current_id := v_father_id;
  END LOOP;

  -- Always append family name "القفاري"
  v_chain := v_chain || ' القفاري';

  RETURN v_chain;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION build_name_chain(UUID) IS
  'Builds full name chain with ancestry (محمد بن علي بن عبدالله القفاري) for activity logs';

-- ============================================
-- PART 3: Create Activity Log Detailed View with Name Chains
-- ============================================

DROP VIEW IF EXISTS public.activity_log_detailed;

CREATE VIEW public.activity_log_detailed AS
SELECT
  -- All audit log columns
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

  -- Actor with FULL NAME CHAIN
  build_name_chain(actor_p.id) as actor_name,
  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- Target with FULL NAME CHAIN
  build_name_chain(target_p.id) as target_name,
  target_p.phone as target_phone,
  target_p.hid as target_hid

FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.user_id
LEFT JOIN profiles target_p ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

COMMENT ON VIEW activity_log_detailed IS
  'Activity log with full name chains (محمد بن علي بن عبدالله القفاري) and change tracking';

-- ============================================
-- PART 4: Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_father_id_for_chain
  ON profiles(father_id)
  WHERE father_id IS NOT NULL;

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 063 Complete - Full Activity Log System Deployed';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Features Enabled:';
  RAISE NOTICE '   ✓ changed_fields array populated on profile updates';
  RAISE NOTICE '   ✓ Full name chains: "محمد بن علي بن عبدالله القفاري"';
  RAISE NOTICE '   ✓ activity_log_detailed view with comprehensive metadata';
  RAISE NOTICE '   ✓ Performance optimized with indexes';
  RAISE NOTICE '';
  RAISE NOTICE '🎨 Activity Log Dashboard Now Shows:';
  RAISE NOTICE '   • Visual inline diffs (collapsed view)';
  RAISE NOTICE '   • Side-by-side comparison (expanded view)';
  RAISE NOTICE '   • Smart descriptions: "غيّر رقم الجوال لـ محمد بن علي القفاري"';
  RAISE NOTICE '   • Field labels in Arabic (not database names)';
  RAISE NOTICE '   • Formatted values (phones, dates, titles)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for production use!';
END $$;
