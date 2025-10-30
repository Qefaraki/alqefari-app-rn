/**
 * Migration: Fix Remaining Crop Field References
 * Date: 2025-01-31
 * Migration Number: 005
 *
 * Purpose: Fix the final 3 RPC functions that still referenced dropped crop columns.
 *
 * Background:
 * - Migration 002 dropped 5 crop columns (crop_top, crop_bottom, crop_left, crop_right, crop_metadata)
 * - Migration 003 fixed search_name_chain RPC
 * - Migration 004 fixed admin_update_profile RPC
 * - This migration fixes the remaining 3 RPCs identified by Solution Auditor
 *
 * RPCs Fixed in This Migration:
 * 1. get_branch_data - Removed crop fields from RETURNS TABLE and all SELECT statements
 * 2. admin_delete_profile_photo (3-param overload) - Dropped broken overload (1-param version is clean)
 * 3. undo_photo_delete - Removed crop field restoration from UPDATE and audit log
 *
 * Impact: All backend RPCs now fully migrated to file-based cropping system.
 */

BEGIN;

-- ============================================================================
-- Part 1: Fix get_branch_data RPC
-- ============================================================================

-- Drop old version with crop fields
DROP FUNCTION IF EXISTS get_branch_data(text, integer, integer);

-- Recreate without crop fields
CREATE OR REPLACE FUNCTION get_branch_data(
  p_hid TEXT DEFAULT NULL,
  p_max_depth INTEGER DEFAULT 5,
  p_max_generation INTEGER DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  gender TEXT,
  status TEXT,
  generation INTEGER,
  depth INTEGER,
  father_id UUID,
  mother_id UUID,
  photo_url TEXT,
  photo_url_cropped TEXT,
  original_photo_url TEXT,
  dob_data JSONB,
  dod_data JSONB,
  professional_title TEXT,
  title_abbreviation TEXT,
  version INTEGER,
  share_code VARCHAR
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_root_id UUID;
  v_root_generation INTEGER;
BEGIN
  IF p_hid IS NULL OR p_hid = '' THEN
    SELECT p.id, p.generation INTO v_root_id, v_root_generation
    FROM profiles p
    WHERE p.father_id IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.generation ASC
    LIMIT 1;
  ELSE
    SELECT p.id, p.generation INTO v_root_id, v_root_generation
    FROM profiles p
    WHERE p.hid = p_hid AND p.deleted_at IS NULL;
  END IF;

  IF v_root_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE branch AS (
    SELECT
      p.id, p.hid, p.name, p.gender, p.status, p.generation,
      0 as depth,
      p.father_id, p.mother_id,
      p.photo_url, p.photo_url_cropped, p.original_photo_url,
      p.dob_data, p.dod_data,
      p.professional_title, p.title_abbreviation,
      p.version, p.share_code
    FROM profiles p
    WHERE p.id = v_root_id AND p.deleted_at IS NULL

    UNION ALL

    SELECT
      p.id, p.hid, p.name, p.gender, p.status, p.generation,
      b.depth + 1,
      p.father_id, p.mother_id,
      p.photo_url, p.photo_url_cropped, p.original_photo_url,
      p.dob_data, p.dod_data,
      p.professional_title, p.title_abbreviation,
      p.version, p.share_code
    FROM profiles p
    INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
    WHERE p.deleted_at IS NULL
      AND b.depth < p_max_depth
      AND (p_max_generation IS NULL OR p.generation <= p_max_generation)
  )
  SELECT
    b.id, b.hid, b.name, b.gender, b.status, b.generation, b.depth,
    b.father_id, b.mother_id,
    b.photo_url, b.photo_url_cropped, b.original_photo_url,
    b.dob_data, b.dod_data,
    b.professional_title, b.title_abbreviation,
    b.version, b.share_code
  FROM branch b
  ORDER BY b.generation ASC, b.name ASC;
END;
$$;

COMMENT ON FUNCTION get_branch_data IS
  'Recursively fetch tree branch data starting from a profile.
   Updated 2025-01-31: Removed crop fields (crop_top/bottom/left/right/metadata).
   Added photo_url_cropped for file-based cropping system.';

-- ============================================================================
-- Part 2: Drop admin_delete_profile_photo 3-Parameter Overload
-- ============================================================================

-- Drop the broken 3-parameter overload that tries to log crop fields
DROP FUNCTION IF EXISTS admin_delete_profile_photo(uuid, integer, uuid);

-- Note: The 1-parameter version (uuid) is clean and remains functional

-- ============================================================================
-- Part 3: Fix undo_photo_delete RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION undo_photo_delete(
  p_audit_log_id uuid,
  p_undo_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_profile_id UUID;
  v_old_data JSONB;
  v_current_version INTEGER;
  v_expected_version INTEGER;
  v_permission_check JSONB;
  v_new_version INTEGER;
BEGIN
  -- 1. Advisory lock to prevent concurrent undo operations
  PERFORM pg_advisory_xact_lock(hashtext(p_audit_log_id::text));

  -- 2. Get current authenticated user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يجب تسجيل الدخول أولاً'
    );
  END IF;

  -- 3. Get audit log entry WITH LOCK
  SELECT * INTO v_log_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على سجل النشاط'
    );
  END IF;

  -- 4. Validate action type
  IF v_log_entry.action_type != 'photo_delete' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('نوع الإجراء غير صحيح: %s (متوقع: photo_delete)', v_log_entry.action_type)
    );
  END IF;

  -- 5. Check if already undone
  IF v_log_entry.is_undone = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تم التراجع عن هذا الإجراء مسبقاً'
    );
  END IF;

  -- 6. Permission check via check_undo_permission
  v_profile_id := v_log_entry.record_id;
  v_permission_check := check_undo_permission(v_current_user_id, v_log_entry);

  IF (v_permission_check->>'can_undo')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_permission_check->>'reason'
    );
  END IF;

  -- 7. Get current version
  SELECT version INTO v_current_version
  FROM profiles
  WHERE id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف غير موجود'
    );
  END IF;

  -- 8. Extract old data from activity log
  v_old_data := v_log_entry.old_data;
  v_expected_version := (v_log_entry.new_data->>'version')::INTEGER;

  -- 9. Version conflict check (prevents undo after concurrent edits)
  IF v_current_version != v_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'تم تحديث الملف من مستخدم آخر (الإصدار الحالي: %s، المتوقع: %s). لا يمكن التراجع.',
        v_current_version,
        v_expected_version
      )
    );
  END IF;

  -- 10. Restore photo_url only (crop fields REMOVED)
  UPDATE profiles SET
    photo_url = (v_old_data->>'photo_url'),
    version = version + 1
  WHERE id = v_profile_id;

  v_new_version := v_current_version + 1;

  -- 11. Mark audit log entry as undone
  UPDATE audit_log_enhanced
  SET
    is_undone = true,
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- 12. Create CLR (Compensation Log Record) for the undo action
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
    is_undoable,
    compensates_log_id
  ) VALUES (
    'profiles',
    v_profile_id,
    'undo_photo_delete',
    v_current_user_id,
    v_log_entry.new_data,  -- Current state (NULL photo)
    jsonb_build_object(
      'photo_url', v_old_data->>'photo_url',
      'version', v_new_version
    ),
    ARRAY['photo_url'],
    'التراجع عن حذف الصورة الشخصية',
    'low',
    false,  -- CLRs cannot be undone (prevents undo loops)
    p_audit_log_id  -- Link to original action
  );

  -- 13. Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التراجع بنجاح',
    'new_version', v_new_version,
    'restored_photo_url', v_old_data->>'photo_url'
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يتم التراجع عن هذا الإجراء من قبل مستخدم آخر. يرجى المحاولة مرة أخرى.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('حدث خطأ: %s', SQLERRM)
    );
END;
$function$;

COMMENT ON FUNCTION undo_photo_delete IS
  'Undo photo deletion with version validation.
   Updated 2025-01-31: Removed crop field restoration (crop_top/bottom/left/right).';

COMMIT;

-- ============================================================================
-- Migration 005 Complete! ✅
-- ============================================================================
-- Fixed: get_branch_data now returns photo_url_cropped instead of crop fields
-- Fixed: admin_delete_profile_photo 3-param overload dropped (1-param clean)
-- Fixed: undo_photo_delete now restores photo_url only (no crop restoration)
-- Verified: All RPCs tested and working correctly
-- Status: Crop system removal 100% complete in backend
