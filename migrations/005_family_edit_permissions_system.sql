-- Migration: Family-based Edit Permissions and Suggestion System
-- This adds a sophisticated permission system allowing family members to edit/suggest
-- changes based on their relationship to the profile owner

-- ============================================================================
-- PART 1: NEW TABLES
-- ============================================================================

-- Table for edit suggestions from family members
CREATE TABLE IF NOT EXISTS profile_edit_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_suggestions_profile_id ON profile_edit_suggestions(profile_id);
CREATE INDEX idx_suggestions_status ON profile_edit_suggestions(status);
CREATE INDEX idx_suggestions_suggested_by ON profile_edit_suggestions(suggested_by);

-- Table for branch moderators (can manage subtrees)
CREATE TABLE IF NOT EXISTS branch_moderators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  branch_root_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, branch_root_id)
);

-- Index for fast permission checks
CREATE INDEX idx_moderators_user_id ON branch_moderators(user_id) WHERE is_active = true;
CREATE INDEX idx_moderators_branch_root ON branch_moderators(branch_root_id) WHERE is_active = true;

-- Table for blocking users from making suggestions
CREATE TABLE IF NOT EXISTS suggestion_blocks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  blocked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: UPDATE ROLE ENUM
-- ============================================================================

-- Add moderator role to existing enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'moderator'
    AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'user_role'
    )
  ) THEN
    -- Since we can't easily alter enums, we'll use text for now
    -- and rely on CHECK constraints
    ALTER TABLE profiles
    ADD CONSTRAINT check_valid_role
    CHECK (role IS NULL OR role IN ('admin', 'moderator', 'user'))
    NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user is a descendant of another
CREATE OR REPLACE FUNCTION is_descendant_of(p_descendant_id UUID, p_ancestor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Use recursive CTE to check ancestry
  RETURN EXISTS (
    WITH RECURSIVE ancestors AS (
      -- Start with the person
      SELECT id, father_id, mother_id
      FROM profiles
      WHERE id = p_descendant_id

      UNION ALL

      -- Recursively get parents
      SELECT p.id, p.father_id, p.mother_id
      FROM profiles p
      JOIN ancestors a ON (p.id = a.father_id OR p.id = a.mother_id)
      WHERE p.id IS NOT NULL
    )
    SELECT 1 FROM ancestors WHERE id = p_ancestor_id
  );
END;
$$;

-- Function to get all descendants of a person
CREATE OR REPLACE FUNCTION get_all_descendants(p_ancestor_id UUID)
RETURNS TABLE(descendant_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Start with the person's direct children
    SELECT id
    FROM profiles
    WHERE (father_id = p_ancestor_id OR mother_id = p_ancestor_id)
      AND deleted_at IS NULL

    UNION ALL

    -- Recursively get children's children
    SELECT p.id
    FROM profiles p
    JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
    WHERE p.deleted_at IS NULL
  )
  SELECT id FROM descendants;
END;
$$;

-- ============================================================================
-- PART 4: MAIN PERMISSION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION can_user_edit_profile(
  p_user_id UUID,
  p_target_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_is_blocked BOOLEAN;
BEGIN
  -- Null checks
  IF p_user_id IS NULL OR p_target_id IS NULL THEN
    RETURN 'none';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id AND deleted_at IS NULL;

  -- Admin can edit everything
  IF v_user_role = 'admin' THEN
    RETURN 'full';
  END IF;

  -- Check if user is blocked from suggestions
  SELECT EXISTS(
    SELECT 1 FROM suggestion_blocks WHERE user_id = p_user_id
  ) INTO v_is_blocked;

  -- Self edit
  IF p_user_id = p_target_id THEN
    RETURN 'full';
  END IF;

  -- Parent can edit their children (including all descendants)
  IF is_descendant_of(p_target_id, p_user_id) THEN
    RETURN 'full';
  END IF;

  -- Children can edit their parents
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND (father_id = p_target_id OR mother_id = p_target_id)
      AND deleted_at IS NULL
  ) THEN
    RETURN 'full';
  END IF;

  -- Siblings can edit each other
  IF EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON (
      (p1.father_id = p2.father_id AND p1.father_id IS NOT NULL)
      OR (p1.mother_id = p2.mother_id AND p1.mother_id IS NOT NULL)
    )
    WHERE p1.id = p_user_id
      AND p2.id = p_target_id
      AND p1.deleted_at IS NULL
      AND p2.deleted_at IS NULL
  ) THEN
    RETURN 'full';
  END IF;

  -- Spouse can edit each other
  IF EXISTS (
    SELECT 1 FROM marriages
    WHERE status = 'active'
      AND ((husband_id = p_user_id AND wife_id = p_target_id)
        OR (wife_id = p_user_id AND husband_id = p_target_id))
  ) THEN
    RETURN 'full';
  END IF;

  -- Branch moderator check
  IF EXISTS (
    SELECT 1 FROM branch_moderators bm
    WHERE bm.user_id = p_user_id
      AND bm.is_active = true
      AND (bm.branch_root_id = p_target_id
        OR p_target_id IN (SELECT * FROM get_all_descendants(bm.branch_root_id)))
  ) THEN
    RETURN 'full';
  END IF;

  -- Everyone else can suggest (unless blocked)
  IF v_is_blocked THEN
    RETURN 'blocked';
  ELSE
    RETURN 'suggest';
  END IF;
END;
$$;

-- ============================================================================
-- PART 5: SUGGESTION APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_edit_suggestion(
  p_suggestion_id UUID,
  p_approved_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion profile_edit_suggestions%ROWTYPE;
  v_old_profile profiles%ROWTYPE;
  v_new_profile profiles%ROWTYPE;
  v_update_sql TEXT;
BEGIN
  -- Check permission to approve
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_approved_by
      AND role IN ('admin', 'moderator')
      AND deleted_at IS NULL
  ) THEN
    -- Also allow profile owner to approve suggestions about themselves
    SELECT * INTO v_suggestion FROM profile_edit_suggestions WHERE id = p_suggestion_id;
    IF v_suggestion.profile_id != p_approved_by THEN
      RAISE EXCEPTION 'Unauthorized to approve suggestions';
    END IF;
  END IF;

  -- Get and lock suggestion
  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Get current profile for audit
  SELECT * INTO v_old_profile
  FROM profiles
  WHERE id = v_suggestion.profile_id
  FOR UPDATE;

  -- Build dynamic update based on field_name
  CASE v_suggestion.field_name
    WHEN 'name' THEN
      UPDATE profiles
      SET name = (v_suggestion.new_value->>'value')::TEXT,
          updated_by = p_approved_by,
          updated_at = NOW(),
          version = version + 1
      WHERE id = v_suggestion.profile_id
      RETURNING * INTO v_new_profile;

    WHEN 'bio' THEN
      UPDATE profiles
      SET bio = (v_suggestion.new_value->>'value')::TEXT,
          updated_by = p_approved_by,
          updated_at = NOW(),
          version = version + 1
      WHERE id = v_suggestion.profile_id
      RETURNING * INTO v_new_profile;

    WHEN 'phone' THEN
      UPDATE profiles
      SET phone = (v_suggestion.new_value->>'value')::TEXT,
          updated_by = p_approved_by,
          updated_at = NOW(),
          version = version + 1
      WHERE id = v_suggestion.profile_id
      RETURNING * INTO v_new_profile;

    WHEN 'email' THEN
      UPDATE profiles
      SET email = (v_suggestion.new_value->>'value')::TEXT,
          updated_by = p_approved_by,
          updated_at = NOW(),
          version = version + 1
      WHERE id = v_suggestion.profile_id
      RETURNING * INTO v_new_profile;

    WHEN 'current_residence' THEN
      UPDATE profiles
      SET current_residence = (v_suggestion.new_value->>'value')::TEXT,
          updated_by = p_approved_by,
          updated_at = NOW(),
          version = version + 1
      WHERE id = v_suggestion.profile_id
      RETURNING * INTO v_new_profile;

    ELSE
      RAISE EXCEPTION 'Unsupported field: %', v_suggestion.field_name;
  END CASE;

  -- Log to audit_log with suggestion context
  INSERT INTO audit_log (
    action,
    table_name,
    target_profile_id,
    actor_id,
    old_data,
    new_data,
    details,
    created_at
  ) VALUES (
    'UPDATE',
    'profiles',
    v_suggestion.profile_id,
    p_approved_by,
    to_jsonb(v_old_profile),
    to_jsonb(v_new_profile),
    jsonb_build_object(
      'source', 'suggestion_approval',
      'suggestion_id', p_suggestion_id,
      'suggested_by', v_suggestion.suggested_by,
      'field_changed', v_suggestion.field_name,
      'reason', v_suggestion.reason
    ),
    NOW()
  );

  -- Mark suggestion as approved
  UPDATE profile_edit_suggestions
  SET status = 'approved',
      reviewed_by = p_approved_by,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_suggestion_id;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_suggestion.profile_id,
    'field_changed', v_suggestion.field_name,
    'new_value', v_suggestion.new_value
  );
END;
$$;

-- ============================================================================
-- PART 6: SUGGESTION REJECTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_edit_suggestion(
  p_suggestion_id UUID,
  p_rejected_by UUID,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion profile_edit_suggestions%ROWTYPE;
BEGIN
  -- Check permission to reject
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_rejected_by
      AND role IN ('admin', 'moderator')
      AND deleted_at IS NULL
  ) THEN
    -- Also allow profile owner to reject suggestions about themselves
    SELECT * INTO v_suggestion FROM profile_edit_suggestions WHERE id = p_suggestion_id;
    IF v_suggestion.profile_id != p_rejected_by THEN
      RAISE EXCEPTION 'Unauthorized to reject suggestions';
    END IF;
  END IF;

  -- Update suggestion status
  UPDATE profile_edit_suggestions
  SET status = 'rejected',
      reviewed_by = p_rejected_by,
      reviewed_at = NOW(),
      rejection_reason = p_rejection_reason,
      updated_at = NOW()
  WHERE id = p_suggestion_id
    AND status = 'pending'
  RETURNING * INTO v_suggestion;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Log rejection to audit for transparency
  INSERT INTO audit_log (
    action,
    table_name,
    target_profile_id,
    actor_id,
    details,
    created_at
  ) VALUES (
    'SUGGESTION_REJECTED',
    'profile_edit_suggestions',
    v_suggestion.profile_id,
    p_rejected_by,
    jsonb_build_object(
      'suggestion_id', p_suggestion_id,
      'suggested_by', v_suggestion.suggested_by,
      'field', v_suggestion.field_name,
      'reason', p_rejection_reason
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'suggestion_id', p_suggestion_id,
    'status', 'rejected'
  );
END;
$$;

-- ============================================================================
-- PART 7: RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE profile_edit_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for profile_edit_suggestions
CREATE POLICY "Users can view suggestions" ON profile_edit_suggestions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can create suggestions" ON profile_edit_suggestions
  FOR INSERT WITH CHECK (
    suggested_by = auth.uid()
    AND can_user_edit_profile(auth.uid(), profile_id) IN ('full', 'suggest')
  );

CREATE POLICY "Users can cancel own suggestions" ON profile_edit_suggestions
  FOR UPDATE USING (
    suggested_by = auth.uid()
    AND status = 'pending'
  );

-- Policies for branch_moderators
CREATE POLICY "View branch moderators" ON branch_moderators
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins manage moderators" ON branch_moderators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

-- Policies for suggestion_blocks
CREATE POLICY "Admins manage blocks" ON suggestion_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'moderator')
        AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- PART 8: UPDATED PROFILE UPDATE POLICY
-- ============================================================================

-- Drop existing update policies if they exist
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin users can update profiles" ON profiles;

-- Create new unified update policy using our permission function
CREATE POLICY "Users can update based on relationships" ON profiles
  FOR UPDATE USING (
    can_user_edit_profile(auth.uid(), id) = 'full'
  );

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION can_user_edit_profile(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_edit_suggestion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_edit_suggestion(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_descendant_of(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_descendants(UUID) TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON profile_edit_suggestions TO authenticated;
GRANT SELECT ON branch_moderators TO authenticated;
GRANT SELECT ON suggestion_blocks TO authenticated;

-- ============================================================================
-- PART 10: HELPFUL INDEXES
-- ============================================================================

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_father_mother
  ON profiles(father_id, mother_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marriages_active
  ON marriages(husband_id, wife_id)
  WHERE status = 'active';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================