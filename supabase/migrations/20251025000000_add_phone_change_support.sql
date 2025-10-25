-- Migration: Add phone change support
-- Creates RPC function for logging phone changes to audit_log

-- Create RPC function for logging phone changes
CREATE OR REPLACE FUNCTION log_phone_change(
  p_user_id UUID,
  p_old_phone TEXT,
  p_new_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log_enhanced (
    actor_id,
    action_type,
    action_category,
    description,
    old_data,
    new_data,
    metadata,
    is_undoable
  ) VALUES (
    p_user_id,
    'phone_change',
    'account',
    'تغيير رقم الهاتف',
    jsonb_build_object('phone', p_old_phone),
    jsonb_build_object('phone', p_new_phone),
    jsonb_build_object(
      'timestamp', now(),
      'change_type', 'user_initiated'
    ),
    false  -- Phone changes are NOT undoable
  );
END;
$$;

-- Document the new action type in the audit_log_enhanced table
COMMENT ON COLUMN audit_log_enhanced.action_type IS
  'Valid action types:
   - profile_update: User or admin updates profile fields
   - profile_soft_delete: User or admin soft deletes a profile
   - profile_cascade_delete: Admin cascade deletes a profile and descendants
   - add_marriage: Marriage record created
   - marriage_soft_delete: Marriage record soft deleted
   - marriage_update: Marriage record updated
   - suggestion_rejected: Edit suggestion was rejected
   - admin_update: Admin made direct updates
   - admin_delete: Admin deleted records
   - profile_insert: New profile created
   - profile_hard_delete: Hard delete of profile
   - phone_change: User changed their phone number in auth';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_phone_change(UUID, TEXT, TEXT) TO authenticated;
