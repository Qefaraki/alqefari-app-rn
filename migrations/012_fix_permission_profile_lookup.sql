-- =====================================================
-- FIX: Allow check_family_permission_v4 to resolve linked users by auth/user id
-- =====================================================

BEGIN;

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
  -- Get user profile directly
  SELECT * INTO v_user_profile FROM profiles WHERE id = p_user_id;

  -- Fallback: resolve via user_id when column exists
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

  -- Fallback: resolve via auth_user_id when column exists
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

  -- Load target profile
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
  IF v_user_profile.father_id = v_target_profile.id OR
     v_user_profile.mother_id = v_target_profile.id OR
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

COMMIT;
