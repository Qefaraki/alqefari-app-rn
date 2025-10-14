-- ============================================================================
-- Migration 090: Broadcast Notifications System
-- Purpose: Add super admin broadcast notification system with all security
--          and performance optimizations from validation
-- Author: Claude
-- Date: 2025-01-14
-- ============================================================================

-- ============================================================================
-- PART 1: EXTEND EXISTING NOTIFICATIONS TABLE
-- ============================================================================

-- Add broadcast-related columns to existing notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS broadcast_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('normal', 'high', 'urgent')) DEFAULT 'normal';

-- Update the type constraint to include broadcast type
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'profile_link_approved',
    'profile_link_rejected',
    'new_profile_link_request',
    'profile_updated',
    'admin_message',
    'system_message',
    'admin_broadcast'  -- NEW: Broadcast notification type
  ));

-- ============================================================================
-- PART 2: CREATE BROADCAST METADATA TABLE
-- ============================================================================

-- Store broadcast metadata (not individual recipients - those are in notifications table)
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) >= 3 AND length(title) <= 200),
  body TEXT NOT NULL CHECK (length(body) >= 10 AND length(body) <= 1000),
  sent_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Targeting criteria (stored for history/audit)
  target_criteria JSONB NOT NULL,

  -- Statistics (updated by triggers)
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0 AND total_recipients <= 1000),
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from notifications to broadcast_messages
ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_broadcast
  FOREIGN KEY (broadcast_id) REFERENCES public.broadcast_messages(id) ON DELETE CASCADE;

-- ============================================================================
-- PART 3: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for broadcast notifications lookup
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_id
  ON public.notifications(broadcast_id)
  WHERE broadcast_id IS NOT NULL;

-- Index for broadcast history queries
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_sent_by
  ON public.broadcast_messages(sent_by, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_sent_at
  ON public.broadcast_messages(sent_at DESC);

-- Composite index for recipient targeting queries
CREATE INDEX IF NOT EXISTS idx_profiles_broadcast_targeting
  ON public.profiles(role, gender, current_residence, deleted_at, user_id)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- ============================================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

-- Function: Verify super admin role
CREATE OR REPLACE FUNCTION verify_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = p_user_id
      AND role = 'super_admin'
      AND deleted_at IS NULL
  );
END;
$$;

-- Function: Get profile ID from auth user ID
CREATE OR REPLACE FUNCTION get_profile_id_from_auth(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

-- ============================================================================
-- PART 5: RECIPIENT TARGETING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_broadcast_recipients(
  p_criteria JSONB
)
RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  name TEXT,
  phone TEXT,
  hid TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_values JSONB;
BEGIN
  -- Verify caller is super admin
  IF NOT verify_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;

  v_type := p_criteria->>'type';
  v_values := p_criteria->'values';

  -- Validate criteria type
  IF v_type NOT IN ('all', 'role', 'gender', 'location', 'custom') THEN
    RAISE EXCEPTION 'Invalid criteria type: %. Must be all, role, gender, location, or custom', v_type;
  END IF;

  -- Base query: Only active profiles with auth accounts
  -- CRITICAL: Filter deleted_at IS NULL and user_id IS NOT NULL
  CASE v_type
    WHEN 'all' THEN
      RETURN QUERY
      SELECT p.user_id, p.id, p.name, p.phone, p.hid
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.user_id IS NOT NULL;

    WHEN 'role' THEN
      -- Validate values exist
      IF v_values IS NULL OR jsonb_array_length(v_values) = 0 THEN
        RAISE EXCEPTION 'Role filter requires at least one role in values array';
      END IF;

      RETURN QUERY
      SELECT p.user_id, p.id, p.name, p.phone, p.hid
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.user_id IS NOT NULL
        AND p.role = ANY(ARRAY(SELECT jsonb_array_elements_text(v_values)));

    WHEN 'gender' THEN
      IF v_values IS NULL OR jsonb_array_length(v_values) = 0 THEN
        RAISE EXCEPTION 'Gender filter requires at least one gender in values array';
      END IF;

      RETURN QUERY
      SELECT p.user_id, p.id, p.name, p.phone, p.hid
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.user_id IS NOT NULL
        AND p.gender = ANY(ARRAY(SELECT jsonb_array_elements_text(v_values)));

    WHEN 'location' THEN
      IF v_values IS NULL OR jsonb_array_length(v_values) = 0 THEN
        RAISE EXCEPTION 'Location filter requires at least one location in values array';
      END IF;

      RETURN QUERY
      SELECT p.user_id, p.id, p.name, p.phone, p.hid
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.user_id IS NOT NULL
        AND p.current_residence = ANY(ARRAY(SELECT jsonb_array_elements_text(v_values)));

    WHEN 'custom' THEN
      IF v_values IS NULL OR jsonb_array_length(v_values) = 0 THEN
        RAISE EXCEPTION 'Custom filter requires at least one profile ID in values array';
      END IF;

      RETURN QUERY
      SELECT p.user_id, p.id, p.name, p.phone, p.hid
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.user_id IS NOT NULL
        AND p.id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_values))::UUID[]);

  END CASE;
END;
$$;

-- ============================================================================
-- PART 6: CREATE BROADCAST FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_broadcast_notification(
  p_title TEXT,
  p_body TEXT,
  p_criteria JSONB,
  p_priority TEXT DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_auth_id UUID;
  v_sender_profile_id UUID;
  v_broadcast_id UUID;
  v_recipient_count INTEGER := 0;
  v_inserted_count INTEGER := 0;
BEGIN
  -- CRITICAL: Get and verify super admin
  v_sender_auth_id := auth.uid();

  IF v_sender_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT verify_super_admin(v_sender_auth_id) THEN
    RAISE EXCEPTION 'Access denied: only super admins can create broadcasts';
  END IF;

  -- Get sender profile ID
  v_sender_profile_id := get_profile_id_from_auth(v_sender_auth_id);

  IF v_sender_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  -- Validate inputs
  IF length(p_title) < 3 OR length(p_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF length(p_body) < 10 OR length(p_body) > 1000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 1000 characters';
  END IF;

  IF p_priority NOT IN ('normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Priority must be normal, high, or urgent';
  END IF;

  -- Acquire advisory lock to prevent concurrent broadcasts
  IF NOT pg_try_advisory_xact_lock(hashtext('broadcast_creation')) THEN
    RAISE EXCEPTION 'Another broadcast is currently being sent. Please wait and try again.';
  END IF;

  -- Count potential recipients (with validation)
  SELECT COUNT(*) INTO v_recipient_count
  FROM get_broadcast_recipients(p_criteria);

  -- Validate recipient count
  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'No recipients match the specified criteria. Please adjust your filters.';
  END IF;

  IF v_recipient_count > 1000 THEN
    RAISE EXCEPTION 'Broadcast too large: % recipients. Maximum allowed is 1000. Please narrow your criteria.', v_recipient_count;
  END IF;

  -- Create broadcast message record
  INSERT INTO public.broadcast_messages (
    title,
    body,
    sent_by,
    target_criteria,
    total_recipients,
    priority,
    expires_at
  ) VALUES (
    p_title,
    p_body,
    v_sender_profile_id,
    p_criteria,
    v_recipient_count,
    p_priority,
    COALESCE(p_expires_at, NOW() + INTERVAL '90 days')  -- Broadcasts have longer retention
  )
  RETURNING id INTO v_broadcast_id;

  -- CRITICAL PERFORMANCE FIX: Batch insert all notifications in one query
  -- This replaces the loop-based insert which caused N+1 issues
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    broadcast_id,
    recipient_metadata,
    priority,
    expires_at
  )
  SELECT
    r.user_id,
    'admin_broadcast',
    p_title,
    p_body,
    jsonb_build_object(
      'broadcast_id', v_broadcast_id,
      'sent_by_profile_id', v_sender_profile_id,
      'criteria', p_criteria
    ),
    v_broadcast_id,
    jsonb_build_object(
      'profile_id', r.profile_id,
      'name', r.name,
      'hid', r.hid
    ),
    p_priority,
    COALESCE(p_expires_at, NOW() + INTERVAL '90 days')
  FROM get_broadcast_recipients(p_criteria) r;

  -- Get actual inserted count
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- Update delivered count
  UPDATE public.broadcast_messages
  SET delivered_count = v_inserted_count,
      updated_at = NOW()
  WHERE id = v_broadcast_id;

  -- Return success response with details
  RETURN jsonb_build_object(
    'success', true,
    'broadcast_id', v_broadcast_id,
    'total_recipients', v_recipient_count,
    'delivered_count', v_inserted_count,
    'sent_at', NOW(),
    'message', format('Broadcast sent successfully to %s users', v_inserted_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise with context
    RAISE EXCEPTION 'Broadcast creation failed: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PART 7: BROADCAST STATISTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_broadcast_statistics(
  p_broadcast_id UUID
)
RETURNS TABLE (
  broadcast_id UUID,
  total_recipients INTEGER,
  delivered_count INTEGER,
  read_count INTEGER,
  read_percentage NUMERIC,
  unread_count INTEGER,
  sent_at TIMESTAMPTZ,
  title TEXT,
  body TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT verify_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    bm.id,
    bm.total_recipients,
    bm.delivered_count,
    COUNT(n.id) FILTER (WHERE n.is_read = true)::INTEGER as read_count,
    CASE
      WHEN bm.total_recipients > 0
      THEN ROUND((COUNT(n.id) FILTER (WHERE n.is_read = true)::NUMERIC / bm.total_recipients) * 100, 1)
      ELSE 0
    END as read_percentage,
    COUNT(n.id) FILTER (WHERE n.is_read = false)::INTEGER as unread_count,
    bm.sent_at,
    bm.title,
    bm.body
  FROM public.broadcast_messages bm
  LEFT JOIN public.notifications n ON n.broadcast_id = bm.id
  WHERE bm.id = p_broadcast_id
  GROUP BY bm.id, bm.total_recipients, bm.delivered_count, bm.sent_at, bm.title, bm.body;
END;
$$;

-- ============================================================================
-- PART 8: BROADCAST HISTORY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_broadcast_history(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  sender_name TEXT,
  sender_id UUID,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER,
  delivered_count INTEGER,
  read_count INTEGER,
  read_percentage NUMERIC,
  target_criteria JSONB,
  priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT verify_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    bm.id,
    bm.title,
    bm.body,
    p.name as sender_name,
    bm.sent_by as sender_id,
    bm.sent_at,
    bm.total_recipients,
    bm.delivered_count,
    COUNT(n.id) FILTER (WHERE n.is_read = true)::INTEGER as read_count,
    CASE
      WHEN bm.total_recipients > 0
      THEN ROUND((COUNT(n.id) FILTER (WHERE n.is_read = true)::NUMERIC / bm.total_recipients) * 100, 1)
      ELSE 0
    END as read_percentage,
    bm.target_criteria,
    bm.priority
  FROM public.broadcast_messages bm
  LEFT JOIN public.profiles p ON p.id = bm.sent_by
  LEFT JOIN public.notifications n ON n.broadcast_id = bm.id
  GROUP BY bm.id, p.name, bm.sent_by, bm.sent_at, bm.total_recipients, bm.delivered_count, bm.target_criteria, bm.priority
  ORDER BY bm.sent_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- PART 9: ENHANCED MARK AS READ FUNCTION
-- ============================================================================

-- Update existing function to handle broadcast statistics
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_broadcast_id UUID;
  v_notification_user_id UUID;
BEGIN
  -- Get notification details
  SELECT user_id, broadcast_id
  INTO v_notification_user_id, v_broadcast_id
  FROM public.notifications
  WHERE id = p_notification_id;

  -- Verify ownership
  IF v_notification_user_id != p_user_id THEN
    RETURN FALSE;
  END IF;

  -- Mark notification as read
  UPDATE public.notifications
  SET is_read = true, read_at = NOW()
  WHERE id = p_notification_id AND is_read = false;

  -- If it's a broadcast notification, update broadcast statistics
  IF v_broadcast_id IS NOT NULL AND FOUND THEN
    UPDATE public.broadcast_messages
    SET read_count = (
      SELECT COUNT(*)
      FROM public.notifications
      WHERE broadcast_id = v_broadcast_id AND is_read = true
    ),
    updated_at = NOW()
    WHERE id = v_broadcast_id;
  END IF;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PART 10: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on broadcast_messages table
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Super admins can view all broadcasts
CREATE POLICY broadcast_messages_super_admin_select
  ON public.broadcast_messages
  FOR SELECT
  TO authenticated
  USING (
    verify_super_admin(auth.uid())
  );

-- Super admins can create broadcasts
CREATE POLICY broadcast_messages_super_admin_insert
  ON public.broadcast_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    verify_super_admin(auth.uid())
  );

-- Super admins can update their own broadcasts
CREATE POLICY broadcast_messages_super_admin_update
  ON public.broadcast_messages
  FOR UPDATE
  TO authenticated
  USING (
    verify_super_admin(auth.uid())
  )
  WITH CHECK (
    verify_super_admin(auth.uid())
  );

-- ============================================================================
-- PART 11: TRIGGER FOR AUTOMATIC STATISTICS UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_broadcast_read_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update if notification was marked as read and has a broadcast_id
  IF NEW.is_read = true AND OLD.is_read = false AND NEW.broadcast_id IS NOT NULL THEN
    UPDATE public.broadcast_messages
    SET read_count = read_count + 1,
        updated_at = NOW()
    WHERE id = NEW.broadcast_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_broadcast_read_count
  AFTER UPDATE ON public.notifications
  FOR EACH ROW
  WHEN (NEW.is_read = true AND OLD.is_read = false AND NEW.broadcast_id IS NOT NULL)
  EXECUTE FUNCTION update_broadcast_read_count();

-- ============================================================================
-- PART 12: GRANTS
-- ============================================================================

GRANT SELECT ON public.broadcast_messages TO authenticated;
GRANT EXECUTE ON FUNCTION verify_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_id_from_auth TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_recipients TO authenticated;
GRANT EXECUTE ON FUNCTION create_broadcast_notification TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_history TO authenticated;

-- ============================================================================
-- PART 13: AUDIT LOGGING
-- ============================================================================

-- Add broadcast actions to audit log
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log_enhanced') THEN
    -- Insert audit log entry for broadcast creation
    CREATE OR REPLACE FUNCTION log_broadcast_creation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $audit$
    BEGIN
      INSERT INTO public.audit_log_enhanced (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        metadata
      ) VALUES (
        'broadcast_messages',
        NEW.id,
        'INSERT',
        NULL,
        to_jsonb(NEW),
        auth.uid(),
        jsonb_build_object(
          'action_type', 'broadcast_created',
          'recipient_count', NEW.total_recipients,
          'priority', NEW.priority
        )
      );

      RETURN NEW;
    END;
    $audit$;

    CREATE TRIGGER trigger_audit_broadcast_creation
      AFTER INSERT ON public.broadcast_messages
      FOR EACH ROW
      EXECUTE FUNCTION log_broadcast_creation();
  END IF;
END $$;

-- ============================================================================
-- PART 14: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.broadcast_messages IS 'Stores metadata for broadcast notifications sent by super admins to multiple users';
COMMENT ON COLUMN public.broadcast_messages.target_criteria IS 'JSONB object describing recipient selection: {type: "all"|"role"|"gender"|"location"|"custom", values: [...]}';
COMMENT ON COLUMN public.broadcast_messages.total_recipients IS 'Total number of users who should receive this broadcast';
COMMENT ON COLUMN public.broadcast_messages.delivered_count IS 'Number of notifications successfully created';
COMMENT ON COLUMN public.broadcast_messages.read_count IS 'Number of users who have read the notification (updated by trigger)';

COMMENT ON FUNCTION create_broadcast_notification IS 'Super admin only: Create and send a broadcast notification to multiple users based on targeting criteria';
COMMENT ON FUNCTION get_broadcast_recipients IS 'Super admin only: Preview list of users who would receive a broadcast based on criteria';
COMMENT ON FUNCTION get_broadcast_statistics IS 'Super admin only: Get detailed statistics for a specific broadcast';
COMMENT ON FUNCTION get_broadcast_history IS 'Super admin only: Get paginated list of all broadcasts with statistics';

-- ============================================================================
-- END MIGRATION 090
-- ============================================================================

-- Migration complete message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 090: Broadcast Notifications System applied successfully';
  RAISE NOTICE '📊 New features:';
  RAISE NOTICE '   - Super admin broadcast messaging system';
  RAISE NOTICE '   - Recipient targeting by role, gender, location, or custom selection';
  RAISE NOTICE '   - Real-time broadcast statistics tracking';
  RAISE NOTICE '   - Batch notification creation for performance';
  RAISE NOTICE '   - Comprehensive security and validation';
  RAISE NOTICE '   - Audit logging integration';
END $$;
