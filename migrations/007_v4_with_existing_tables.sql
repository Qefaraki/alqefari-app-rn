-- =====================================================
-- PERMISSION SYSTEM v4.2 - DEPLOYMENT WITH EXISTING TABLES
-- =====================================================
-- This version handles existing tables from old migrations
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 0: HANDLE EXISTING TABLES
-- =====================================================

-- Drop existing branch_moderators table (it has wrong structure)
DROP TABLE IF EXISTS branch_moderators CASCADE;

-- Drop existing suggestion_blocks table (it has wrong structure)
DROP TABLE IF EXISTS suggestion_blocks CASCADE;

-- =====================================================
-- SECTION 1: CORE TABLES (FRESH START)
-- =====================================================

-- 1.1 Profile Edit Suggestions Table
CREATE TABLE IF NOT EXISTS profile_edit_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitter_id UUID NOT NULL REFERENCES profiles(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Add check constraint for valid statuses
  CONSTRAINT check_valid_status CHECK (
    status IN ('pending', 'approved', 'rejected', 'auto_approved')
  ),

  -- Add check constraint for valid field names (whitelist)
  CONSTRAINT check_valid_field CHECK (
    field_name IN (
      'display_name', 'phone', 'email', 'date_of_birth',
      'place_of_birth', 'current_location', 'occupation',
      'bio', 'instagram', 'twitter', 'linkedin', 'notes'
    )
  ),

  -- Prevent self-review
  CONSTRAINT prevent_self_review CHECK (
    reviewed_by IS NULL OR reviewed_by != submitter_id
  )
);

-- 1.2 Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_suggestions_profile_id
  ON profile_edit_suggestions(profile_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_submitter_id
  ON profile_edit_suggestions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON profile_edit_suggestions(status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at
  ON profile_edit_suggestions(created_at);

-- 1.3 Branch Moderators Table (v4.2 structure with HID)
CREATE TABLE branch_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  branch_hid TEXT NOT NULL,  -- HID like "1.2.3" not UUID
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 1.4 Create indexes for branch moderators
CREATE INDEX idx_branch_moderators_user_id
  ON branch_moderators(user_id);
CREATE INDEX idx_branch_moderators_branch_hid
  ON branch_moderators(branch_hid);
CREATE INDEX idx_branch_moderators_active
  ON branch_moderators(is_active)
  WHERE is_active = true;

-- 1.5 User Rate Limits Table
CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  daily_suggestions INT DEFAULT 0,
  daily_approvals INT DEFAULT 0,
  daily_rejections INT DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 Suggestion Blocks Table (fresh)
CREATE TABLE suggestion_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_user_id UUID NOT NULL REFERENCES profiles(id),
  blocked_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 1.7 Create index for blocked user lookups
CREATE INDEX idx_suggestion_blocks_blocked_user
  ON suggestion_blocks(blocked_user_id)
  WHERE is_active = true;

-- 1.8 Create partial unique indexes for constraints
CREATE UNIQUE INDEX unique_active_branch_moderator
  ON branch_moderators(branch_hid, is_active)
  WHERE is_active = true;

CREATE UNIQUE INDEX unique_active_block
  ON suggestion_blocks(blocked_user_id, is_active)
  WHERE is_active = true;

-- =====================================================
-- SECTION 2: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- 2.1 Enable RLS on all tables
ALTER TABLE profile_edit_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_blocks ENABLE ROW LEVEL SECURITY;

-- 2.2 Profile Edit Suggestions Policies
CREATE POLICY suggestions_select ON profile_edit_suggestions
  FOR SELECT USING (
    auth.uid() IN (submitter_id, profile_id, reviewed_by)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY suggestions_insert ON profile_edit_suggestions
  FOR INSERT WITH CHECK (
    submitter_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM suggestion_blocks
      WHERE blocked_user_id = auth.uid()
      AND is_active = true
    )
  );

-- 2.3 Branch Moderators Policies
CREATE POLICY branch_moderators_select ON branch_moderators
  FOR SELECT USING (true);

CREATE POLICY branch_moderators_admin ON branch_moderators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- 2.4 User Rate Limits Policies (Fixed: separated policies)
CREATE POLICY rate_limit_select ON user_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY rate_limit_no_insert ON user_rate_limits
  FOR INSERT WITH CHECK (false);

CREATE POLICY rate_limit_no_update ON user_rate_limits
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY rate_limit_no_delete ON user_rate_limits
  FOR DELETE USING (false);

-- 2.5 Suggestion Blocks Policies
CREATE POLICY blocks_select ON suggestion_blocks
  FOR SELECT USING (
    blocked_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY blocks_admin ON suggestion_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- SECTION 3: CORE PERMISSION CHECKING FUNCTION
-- =====================================================

-- SECURE VERSION with HID pattern matching
CREATE OR REPLACE FUNCTION check_family_permission_v4(
  p_user_id UUID,
  p_target_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_user_profile RECORD;
  v_target_profile RECORD;
  v_permission TEXT := 'none';
  v_is_blocked BOOLEAN;
  v_target_hid TEXT;
BEGIN
  -- Get user profile
  SELECT * INTO v_user_profile FROM profiles WHERE id = p_user_id;

  -- Fallback: resolve via user_id if column exists
  IF v_user_profile.id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'user_id'
    ) THEN
      SELECT * INTO v_user_profile
      FROM profiles
      WHERE user_id = p_user_id
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback: resolve via auth_user_id when available
  IF v_user_profile.id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
    ) THEN
      SELECT * INTO v_user_profile
      FROM profiles
      WHERE auth_user_id = p_user_id
      LIMIT 1;
    END IF;
  END IF;

  SELECT * INTO v_target_profile FROM profiles WHERE id = p_target_id;

  IF v_user_profile.id IS NULL OR v_target_profile.id IS NULL THEN
    RETURN 'none';
  END IF;

  -- Check if user is blocked
  SELECT EXISTS(
    SELECT 1 FROM suggestion_blocks
    WHERE blocked_user_id = v_user_profile.id
    AND is_active = true
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN 'blocked';
  END IF;

  -- Super admin/admin can edit anyone
  IF v_user_profile.role IN ('super_admin', 'admin') THEN
    RETURN 'admin';
  END IF;

  -- Get target's HID for branch moderator check
  SELECT hid INTO v_target_hid FROM profiles WHERE id = p_target_id;

  -- Check branch moderator permissions (FIXED: HID pattern matching)
  IF EXISTS (
    SELECT 1 FROM branch_moderators bm
    WHERE bm.user_id = v_user_profile.id
    AND bm.is_active = true
    AND v_target_hid IS NOT NULL
    AND v_target_hid LIKE bm.branch_hid || '%'
  ) THEN
    RETURN 'moderator';
  END IF;

  -- Self edit
  IF v_user_profile.id = p_target_id THEN
    RETURN 'inner';
  END IF;

  -- Check spouse relationship
  IF EXISTS (
    SELECT 1 FROM marriages
    WHERE is_current = true
    AND (
      (husband_id = v_user_profile.id AND wife_id = p_target_id) OR
      (wife_id = v_user_profile.id AND husband_id = p_target_id)
    )
  ) THEN
    RETURN 'inner';
  END IF;

  -- Check parent-child relationship (both directions)
  IF v_user_profile.father_id = p_target_id OR
     v_user_profile.mother_id = p_target_id OR
     v_target_profile.father_id = v_user_profile.id OR
     v_target_profile.mother_id = v_user_profile.id THEN
    RETURN 'inner';
  END IF;

  -- Check sibling relationship
  IF (v_user_profile.father_id IS NOT NULL AND
      v_user_profile.father_id = v_target_profile.father_id) OR
     (v_user_profile.mother_id IS NOT NULL AND
      v_user_profile.mother_id = v_target_profile.mother_id) THEN
    RETURN 'inner';
  END IF;

  -- Check if user is descendant of target (can edit ancestors)
  IF is_descendant_of(v_user_profile.id, p_target_id) THEN
    RETURN 'inner';
  END IF;

  -- Check if target is descendant of user (can edit all descendants)
  IF is_descendant_of(p_target_id, v_user_profile.id) THEN
    RETURN 'inner';
  END IF;

  -- Check grandparent relationship
  IF EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_target_id
    AND (p.father_id = v_user_profile.father_id OR
         p.father_id = v_user_profile.mother_id OR
         p.mother_id = v_user_profile.father_id OR
         p.mother_id = v_user_profile.mother_id)
  ) OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = v_user_profile.id
    AND (p.father_id = v_target_profile.father_id OR
         p.father_id = v_target_profile.mother_id OR
         p.mother_id = v_target_profile.father_id OR
         p.mother_id = v_target_profile.mother_id)
  ) THEN
    RETURN 'family';
  END IF;

  -- Check aunt/uncle or nephew/niece relationship
  IF EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON (
      p1.father_id = p2.father_id OR
      p1.mother_id = p2.mother_id
    )
    WHERE p1.id = v_user_profile.id
    AND (p2.id = v_target_profile.father_id OR
         p2.id = v_target_profile.mother_id)
  ) OR EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON (
      p1.father_id = p2.father_id OR
      p1.mother_id = p2.mother_id
    )
    WHERE p1.id = p_target_id
    AND (p2.id = v_user_profile.father_id OR
         p2.id = v_user_profile.mother_id)
  ) THEN
    RETURN 'family';
  END IF;

  -- Check first cousin relationship
  IF EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON (
      p1.father_id IS NOT NULL AND p2.father_id IS NOT NULL
    )
    JOIN profiles gp1 ON p1.father_id = gp1.id
    JOIN profiles gp2 ON p2.father_id = gp2.id
    WHERE p1.id = v_user_profile.id
    AND p2.id = p_target_id
    AND (gp1.father_id = gp2.father_id OR gp1.mother_id = gp2.mother_id)
  ) THEN
    RETURN 'family';
  END IF;

  -- Default to extended family for any other Al Qefari member
  IF v_target_profile.hid IS NOT NULL THEN
    RETURN 'extended';
  END IF;

  RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 4: AUTO-APPROVAL SYSTEM
-- =====================================================

CREATE OR REPLACE FUNCTION auto_approve_suggestions_v4()
RETURNS void AS $$
DECLARE
  v_suggestion RECORD;
  v_permission TEXT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Process suggestions older than 48 hours in family circle
  FOR v_suggestion IN
    SELECT s.*
    FROM profile_edit_suggestions s
    WHERE s.status = 'pending'
    AND s.created_at <= NOW() - INTERVAL '48 hours'
    ORDER BY s.created_at
    LIMIT 100
  LOOP
    -- Acquire advisory lock to prevent concurrent processing
    v_lock_acquired := pg_try_advisory_xact_lock(
      'profile_edit_suggestions'::regclass::oid::bigint,
      v_suggestion.id::text::hashtext
    );

    IF NOT v_lock_acquired THEN
      CONTINUE;
    END IF;

    -- Check permission level
    v_permission := check_family_permission_v4(
      v_suggestion.submitter_id,
      v_suggestion.profile_id
    );

    -- Auto-approve if in family circle
    IF v_permission = 'family' THEN
      BEGIN
        -- Use advisory lock for atomic update
        UPDATE profile_edit_suggestions
        SET status = 'auto_approved',
            reviewed_at = NOW(),
            reviewed_by = NULL,  -- FIXED: NULL for system approval
            notes = 'تمت الموافقة تلقائياً بواسطة النظام بعد 48 ساعة'
        WHERE id = v_suggestion.id
        AND status = 'pending';

        -- Apply the change
        PERFORM apply_profile_edit_v4(v_suggestion.id);

        -- Log the auto-approval (if audit_log table exists)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
          INSERT INTO audit_log (
            action, entity_type, entity_id,
            changed_by, details, created_at
          ) VALUES (
            'AUTO_APPROVE', 'profile_edit_suggestions',
            v_suggestion.id, NULL,
            jsonb_build_object(
              'field', v_suggestion.field_name,
              'auto_approved_after', '48 hours'
            ),
            NOW()
          );
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue processing others
          RAISE WARNING 'Auto-approval failed for suggestion %: %',
            v_suggestion.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 5: SUGGESTION SUBMISSION
-- =====================================================

CREATE OR REPLACE FUNCTION submit_edit_suggestion_v4(
  p_profile_id UUID,
  p_field_name TEXT,
  p_new_value TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_suggestion_id UUID;
  v_old_value TEXT;
  v_permission TEXT;
  v_suggestions_today INT;
  v_column_allowed BOOLEAN;
BEGIN
  -- Validate field name against whitelist
  v_column_allowed := p_field_name IN (
    'display_name', 'phone', 'email', 'date_of_birth',
    'place_of_birth', 'current_location', 'occupation',
    'bio', 'instagram', 'twitter', 'linkedin', 'notes'
  );

  IF NOT v_column_allowed THEN
    RAISE EXCEPTION 'Field % is not allowed for editing', p_field_name;
  END IF;

  -- Check permission
  v_permission := check_family_permission_v4(auth.uid(), p_profile_id);

  IF v_permission = 'blocked' THEN
    RAISE EXCEPTION 'You are blocked from making suggestions';
  END IF;

  IF v_permission = 'none' THEN
    RAISE EXCEPTION 'You do not have permission to suggest edits for this profile';
  END IF;

  -- Check rate limit (10 suggestions per day)
  SELECT COUNT(*) INTO v_suggestions_today
  FROM profile_edit_suggestions
  WHERE submitter_id = auth.uid()
  AND created_at >= CURRENT_DATE;

  IF v_suggestions_today >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 suggestions per day.';
  END IF;

  -- Get current value using safe dynamic SQL
  EXECUTE format(
    'SELECT %I FROM profiles WHERE id = $1',
    p_field_name
  ) INTO v_old_value USING p_profile_id;

  -- If user has inner circle permission, apply immediately
  IF v_permission IN ('inner', 'admin', 'moderator') THEN
    -- Direct update
    EXECUTE format(
      'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
      p_field_name
    ) USING p_new_value, p_profile_id;

    -- Log the direct edit (if audit_log exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
      INSERT INTO audit_log (
        action, entity_type, entity_id,
        changed_by, details, created_at
      ) VALUES (
        'DIRECT_EDIT', 'profiles', p_profile_id,
        auth.uid(),
        jsonb_build_object(
          'field', p_field_name,
          'old_value', v_old_value,
          'new_value', p_new_value,
          'permission_level', v_permission
        ),
        NOW()
      );
    END IF;

    RETURN NULL; -- No suggestion needed
  ELSE
    -- Create suggestion for family/extended circles
    INSERT INTO profile_edit_suggestions (
      profile_id, submitter_id, field_name,
      old_value, new_value, reason, status
    ) VALUES (
      p_profile_id, auth.uid(), p_field_name,
      v_old_value, p_new_value, p_reason, 'pending'
    ) RETURNING id INTO v_suggestion_id;

    -- Notify approvers
    PERFORM notify_approvers_v4(v_suggestion_id, p_profile_id, auth.uid());

    RETURN v_suggestion_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_edit_suggestion_v4 TO authenticated;

-- =====================================================
-- SECTION 6: APPROVAL/REJECTION FUNCTIONS
-- =====================================================

-- Approve suggestion function (with rate limiting)
CREATE OR REPLACE FUNCTION approve_suggestion(
  p_suggestion_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_can_approve BOOLEAN;
  v_permission TEXT;
  v_approvals_today INT;
BEGIN
  -- Check rate limit (max 100 approvals per day per user)
  SELECT COUNT(*) INTO v_approvals_today
  FROM profile_edit_suggestions
  WHERE reviewed_by = auth.uid()
  AND reviewed_at >= CURRENT_DATE
  AND status = 'approved';

  IF v_approvals_today >= 100 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 100 approvals per day.';
  END IF;

  -- Get suggestion
  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id
  AND status = 'pending'
  FOR UPDATE;

  IF v_suggestion.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user can approve
  v_permission := check_family_permission_v4(auth.uid(), v_suggestion.profile_id);

  v_can_approve := (
    v_permission IN ('inner', 'admin', 'moderator') OR
    auth.uid() = v_suggestion.profile_id
  );

  IF NOT v_can_approve THEN
    RAISE EXCEPTION 'You do not have permission to approve this suggestion';
  END IF;

  -- Update suggestion status
  UPDATE profile_edit_suggestions
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      notes = p_notes
  WHERE id = p_suggestion_id;

  -- Apply the change
  PERFORM apply_profile_edit_v4(p_suggestion_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION approve_suggestion TO authenticated;

-- Reject suggestion function (with rate limiting)
CREATE OR REPLACE FUNCTION reject_suggestion(
  p_suggestion_id UUID,
  p_notes TEXT DEFAULT 'رفض من قبل المالك'
) RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_can_reject BOOLEAN;
  v_rejections_today INT;
BEGIN
  -- Check rate limit (max 100 rejections per day per user)
  SELECT COUNT(*) INTO v_rejections_today
  FROM profile_edit_suggestions
  WHERE reviewed_by = auth.uid()
  AND reviewed_at >= CURRENT_DATE
  AND status = 'rejected';

  IF v_rejections_today >= 100 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 100 rejections per day.';
  END IF;

  -- Get suggestion
  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id
  AND status = 'pending'
  FOR UPDATE;

  IF v_suggestion.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user can reject
  v_can_reject := (
    auth.uid() = v_suggestion.profile_id OR
    check_family_permission_v4(auth.uid(), v_suggestion.profile_id)
      IN ('admin', 'moderator')
  );

  IF NOT v_can_reject THEN
    RAISE EXCEPTION 'You do not have permission to reject this suggestion';
  END IF;

  -- Update suggestion status
  UPDATE profile_edit_suggestions
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      notes = p_notes
  WHERE id = p_suggestion_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reject_suggestion TO authenticated;

-- =====================================================
-- SECTION 7: HELPER FUNCTIONS
-- =====================================================

-- Apply approved edit to profile
CREATE OR REPLACE FUNCTION apply_profile_edit_v4(
  p_suggestion_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_column_allowed BOOLEAN;
BEGIN
  -- Get approved suggestion
  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id
  AND status IN ('approved', 'auto_approved');

  IF v_suggestion.id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Validate field name against whitelist
  v_column_allowed := v_suggestion.field_name IN (
    'display_name', 'phone', 'email', 'date_of_birth',
    'place_of_birth', 'current_location', 'occupation',
    'bio', 'instagram', 'twitter', 'linkedin', 'notes'
  );

  IF NOT v_column_allowed THEN
    RAISE EXCEPTION 'Field % is not allowed for editing', v_suggestion.field_name;
  END IF;

  -- Apply the change using safe dynamic SQL
  EXECUTE format(
    'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
    v_suggestion.field_name
  ) USING v_suggestion.new_value, v_suggestion.profile_id;

  -- Log the change (if audit_log exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, entity_type, entity_id,
      changed_by, details, created_at
    ) VALUES (
      'PROFILE_EDIT', 'profiles', v_suggestion.profile_id,
      v_suggestion.reviewed_by,
      jsonb_build_object(
        'suggestion_id', v_suggestion.id,
        'field', v_suggestion.field_name,
        'old_value', v_suggestion.old_value,
        'new_value', v_suggestion.new_value,
        'submitted_by', v_suggestion.submitter_id
      ),
      NOW()
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending suggestions count
CREATE OR REPLACE FUNCTION get_pending_suggestions_count(
  p_profile_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_profile_id IS NOT NULL THEN
    -- Count for specific profile
    SELECT COUNT(*) INTO v_count
    FROM profile_edit_suggestions
    WHERE profile_id = p_profile_id
    AND status = 'pending';
  ELSE
    -- Count all user can review
    SELECT COUNT(*) INTO v_count
    FROM profile_edit_suggestions s
    WHERE s.status = 'pending'
    AND (
      s.profile_id = auth.uid() OR
      check_family_permission_v4(auth.uid(), s.profile_id)
        IN ('admin', 'moderator')
    );
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_suggestions_count TO authenticated;

-- =====================================================
-- SECTION 8: NOTIFICATION SYSTEM
-- =====================================================

-- Notify approvers of new suggestion (FIXED HID pattern matching)
CREATE OR REPLACE FUNCTION notify_approvers_v4(
  p_suggestion_id UUID,
  p_profile_id UUID,
  p_submitter_id UUID
) RETURNS void AS $$
DECLARE
  v_approver_ids UUID[];
  v_target_hid TEXT;
BEGIN
  -- Get target profile's HID for branch moderator check
  SELECT hid INTO v_target_hid
  FROM profiles
  WHERE id = p_profile_id;

  -- Get list of potential approvers (with backpressure limit)
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_approver_ids
  FROM (
    -- Profile owner
    SELECT id AS user_id FROM profiles WHERE id = p_profile_id
    UNION
    -- Branch moderators (FIX: use HID pattern matching, not UUID cast)
    SELECT bm.user_id
    FROM branch_moderators bm
    WHERE bm.is_active = true
    AND v_target_hid IS NOT NULL
    AND v_target_hid LIKE bm.branch_hid || '%'
    UNION
    -- Admins
    SELECT id AS user_id FROM profiles
    WHERE role IN ('admin', 'super_admin')
    LIMIT 50 -- Backpressure: Prevent notification spam
  ) approvers
  WHERE user_id != p_submitter_id;

  -- Create notifications (only if notifications table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    IF v_approver_ids IS NOT NULL AND array_length(v_approver_ids, 1) > 0 THEN
      INSERT INTO notifications (
        user_id, type, title, body,
        data, created_at
      )
      SELECT
        unnest(v_approver_ids),
        'suggestion_pending',
        'اقتراح تعديل جديد',
        'لديك اقتراح تعديل جديد للمراجعة',
        jsonb_build_object(
          'suggestion_id', p_suggestion_id,
          'profile_id', p_profile_id,
          'submitter_id', p_submitter_id
        ),
        NOW();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 9: ADMIN FUNCTIONS
-- =====================================================

-- Block user from making suggestions
CREATE OR REPLACE FUNCTION block_user_suggestions(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can block users';
  END IF;

  -- Insert or update block
  INSERT INTO suggestion_blocks (
    blocked_user_id, blocked_by, reason, is_active
  ) VALUES (
    p_user_id, auth.uid(), p_reason, true
  )
  ON CONFLICT (blocked_user_id, is_active)
  WHERE is_active = true
  DO UPDATE SET
    blocked_by = EXCLUDED.blocked_by,
    reason = EXCLUDED.reason,
    blocked_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock user
CREATE OR REPLACE FUNCTION unblock_user_suggestions(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can unblock users';
  END IF;

  -- Deactivate block
  UPDATE suggestion_blocks
  SET is_active = false
  WHERE blocked_user_id = p_user_id
  AND is_active = true;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign branch moderator
CREATE OR REPLACE FUNCTION assign_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can assign branch moderators';
  END IF;

  -- Deactivate any existing moderator for this branch
  UPDATE branch_moderators
  SET is_active = false
  WHERE branch_hid = p_branch_hid
  AND is_active = true;

  -- Assign new moderator
  INSERT INTO branch_moderators (
    user_id, branch_hid, assigned_by, is_active
  ) VALUES (
    p_user_id, p_branch_hid, auth.uid(), true
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for admin functions
GRANT EXECUTE ON FUNCTION block_user_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION assign_branch_moderator TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES - Run these to confirm deployment
-- =====================================================

-- 1. Verify all tables exist
SELECT 'Tables Check:' as check_type, COUNT(*) as found,
  CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'profile_edit_suggestions',
  'branch_moderators',
  'user_rate_limits',
  'suggestion_blocks'
);

-- 2. Verify all functions exist
SELECT 'Functions Check:' as check_type, COUNT(*) as found,
  CASE WHEN COUNT(*) >= 11 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_proc
WHERE proname IN (
  'check_family_permission_v4',
  'submit_edit_suggestion_v4',
  'approve_suggestion',
  'reject_suggestion',
  'auto_approve_suggestions_v4',
  'apply_profile_edit_v4',
  'notify_approvers_v4',
  'get_pending_suggestions_count',
  'block_user_suggestions',
  'unblock_user_suggestions',
  'assign_branch_moderator'
);

-- 3. Verify RLS is enabled
SELECT 'RLS Check:' as check_type, COUNT(*) as enabled,
  CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'profile_edit_suggestions',
  'branch_moderators',
  'user_rate_limits',
  'suggestion_blocks'
)
AND rowsecurity = true;

-- 4. Verify branch_moderators has correct structure
SELECT 'Branch Moderators Structure:' as check_type,
  CASE WHEN COUNT(*) = 1 THEN '✅ HID column exists' ELSE '❌ Missing HID' END as status
FROM information_schema.columns
WHERE table_name = 'branch_moderators'
AND column_name = 'branch_hid'
AND data_type = 'text';

-- 5. Final Summary
SELECT '=====================================' as separator;
SELECT 'DEPLOYMENT COMPLETE!' as message;
SELECT 'Run test suite: scripts/test_permission_v4.sql' as next_step;
SELECT '=====================================' as separator;
