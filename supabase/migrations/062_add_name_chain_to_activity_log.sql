-- Migration 062: Add Full Name Chains to Activity Log
-- Created: 2025-01-10
-- Purpose: Display full ancestry names (محمد بن علي بن عبدالله القفاري) in activity log
-- Instead of just first names

-- ============================================
-- PART 1: Create Name Chain Builder Function
-- ============================================

-- Recursive function to build full name chain with ancestry
CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
  v_father_id UUID;
  v_father_name TEXT;
  v_chain TEXT := '';
  v_current_id UUID := p_profile_id;
  v_max_depth INT := 10; -- Prevent infinite loops
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

    -- Get father's info
    SELECT father_id INTO v_father_id
    FROM profiles
    WHERE id = v_current_id;

    EXIT WHEN v_father_id IS NULL;

    -- Get father's name
    SELECT name INTO v_father_name
    FROM profiles
    WHERE id = v_father_id;

    EXIT WHEN v_father_name IS NULL;

    -- Append father's name
    v_chain := v_chain || ' بن ' || v_father_name;

    -- Move up the tree
    v_current_id := v_father_id;
  END LOOP;

  -- Always append family name "القفاري" at the end
  v_chain := v_chain || ' القفاري';

  RETURN v_chain;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION build_name_chain(UUID) IS
  'Builds full name chain with ancestry (محمد بن علي بن عبدالله القفاري) for display in activity logs and UI';

-- ============================================
-- PART 2: Update Activity Log View with Name Chains
-- ============================================

-- Drop and recreate view with full name chains
DROP VIEW IF EXISTS public.activity_log_detailed;

CREATE VIEW public.activity_log_detailed AS
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

  -- Actor information with FULL NAME CHAIN
  build_name_chain(actor_p.id) as actor_name,
  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- Target information with FULL NAME CHAIN
  build_name_chain(target_p.id) as target_name,
  target_p.phone as target_phone,
  target_p.hid as target_hid

FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.user_id
LEFT JOIN profiles target_p ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

-- Add comment
COMMENT ON VIEW activity_log_detailed IS
  'Enhanced audit log view with full name chains (محمد بن علي بن عبدالله القفاري) for actor and target. Used by Activity Log Dashboard.';

-- ============================================
-- PART 3: Create Index for Performance
-- ============================================

-- Index on father_id for efficient recursive queries
CREATE INDEX IF NOT EXISTS idx_profiles_father_id_for_chain
  ON profiles(father_id)
  WHERE father_id IS NOT NULL;

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 062 Complete';
  RAISE NOTICE '   - build_name_chain() function created';
  RAISE NOTICE '   - activity_log_detailed view updated with full name chains';
  RAISE NOTICE '   - Performance index added on father_id';
  RAISE NOTICE '   - Activity Log will now show: "محمد بن علي بن عبدالله القفاري"';
  RAISE NOTICE '   - Instead of just: "محمد"';
END $$;
