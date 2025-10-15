-- Migration: QuickAdd Batch Save Operation
-- Purpose: Replace 23 sequential RPC calls with single atomic batch operation
-- Impact: 95% reduction in RPC calls, atomic transactions, cleaner audit trail
-- Safety: 7 critical mechanisms (locking, validation, limits, error messages)

-- ============================================================================
-- FUNCTION: admin_quick_add_batch_save
-- ============================================================================
-- Atomically creates, updates, and deletes child profiles in a single transaction.
-- Replaces sequential admin_create_profile, admin_update_profile, admin_delete_profile calls.
--
-- Safety Mechanisms:
-- 1. Parent profile locking (prevents TOCTOU vulnerabilities)
-- 2. Selected parent validation (mother/father existence, gender, locking)
-- 3. Permission level validation (rejects suggest-only 'family' permission)
-- 4. Max batch size limit (50 operations, prevents timeout/DoS)
-- 5. Generation auto-calculation (don't trust frontend input)
-- 6. All-or-nothing transaction (no partial success mode)
-- 7. Formal Saudi Arabic error messages (culturally appropriate)

CREATE OR REPLACE FUNCTION admin_quick_add_batch_save(
  p_parent_id UUID,                          -- Parent profile ID (required)
  p_parent_gender TEXT,                      -- Parent gender: 'male' or 'female' (required)
  p_selected_mother_id UUID DEFAULT NULL,    -- Optional mother (if parent is father)
  p_selected_father_id UUID DEFAULT NULL,    -- Required father (if parent is mother)
  p_children_to_create JSONB DEFAULT '[]'::jsonb,  -- Array of child objects to create
  p_children_to_update JSONB DEFAULT '[]'::jsonb,  -- Array of child objects to update
  p_children_to_delete JSONB DEFAULT '[]'::jsonb,  -- Array of child IDs to delete
  p_operation_description TEXT DEFAULT NULL        -- Optional description for audit trail
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Actor identification
  v_actor_id UUID;                    -- auth.uid()
  v_actor_profile_id UUID;            -- profiles.id for permission checking

  -- Parent validation
  v_parent profiles%ROWTYPE;          -- Parent profile record
  v_permission_level TEXT;            -- Permission level on parent

  -- Selected parent validation
  v_selected_mother_valid BOOLEAN;
  v_selected_father_valid BOOLEAN;

  -- Operation tracking
  v_operation_group_id UUID;          -- Operation group for undo capability
  v_total_operations INTEGER := 0;    -- Count of all operations
  v_created_count INTEGER := 0;       -- Count of created profiles
  v_updated_count INTEGER := 0;       -- Count of updated profiles
  v_deleted_count INTEGER := 0;       -- Count of deleted profiles

  -- Iteration variables
  v_child JSONB;                      -- Iterator for JSONB arrays
  v_child_id UUID;                    -- Generated/existing child ID
  v_child_name TEXT;                  -- Child name for validation
  v_child_gender TEXT;                -- Child gender for validation
  v_child_version INTEGER;            -- Current version for optimistic locking
  v_child_expected_version INTEGER;   -- Expected version from frontend
  v_child_generation INTEGER;         -- Calculated generation
  v_child_sibling_order INTEGER;      -- Sort order

  -- Parent assignment
  v_father_id UUID;                   -- Resolved father ID
  v_mother_id UUID;                   -- Resolved mother ID

  -- Descendant checking (for deletes)
  v_has_descendants BOOLEAN;
  v_descendant_count INTEGER;

  -- Performance tracking
  v_start_time TIMESTAMP;
  v_duration_ms NUMERIC;
BEGIN
  -- ========================================================================
  -- 1. INITIALIZATION
  -- ========================================================================

  v_start_time := clock_timestamp();

  -- Set transaction timeout (10 seconds)
  SET LOCAL statement_timeout = '10000';

  -- Get authenticated user
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتنفيذ هذه العملية';
  END IF;

  -- Get actor's profile ID
  SELECT id INTO v_actor_profile_id
  FROM profiles
  WHERE user_id = v_actor_id;

  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'الملف الشخصي للمستخدم غير موجود';
  END IF;

  -- ========================================================================
  -- 2. VALIDATE BATCH SIZE (Safety Mechanism #4)
  -- ========================================================================

  v_total_operations :=
    jsonb_array_length(p_children_to_create) +
    jsonb_array_length(p_children_to_update) +
    jsonb_array_length(p_children_to_delete);

  IF v_total_operations > 50 THEN
    RAISE EXCEPTION 'الحد الأقصى 50 عملية في الدفعة الواحدة. يرجى تقسيم التغييرات إلى دفعات أصغر';
  END IF;

  -- Handle empty batch (no-op)
  IF v_total_operations = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'لا توجد تغييرات للحفظ',
      'operation_group_id', NULL,
      'results', jsonb_build_object(
        'created', 0,
        'updated', 0,
        'deleted', 0,
        'errors', '[]'::jsonb
      )
    );
  END IF;

  -- ========================================================================
  -- 3. LOCK AND VALIDATE PARENT PROFILE (Safety Mechanism #1)
  -- ========================================================================

  -- Lock parent profile to prevent concurrent deletion/modification
  SELECT * INTO v_parent
  FROM profiles
  WHERE id = p_parent_id AND deleted_at IS NULL
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الملف الشخصي للوالد غير موجود أو محذوف';
  END IF;

  -- Verify parent gender hasn't changed (TOCTOU protection)
  IF v_parent.gender != p_parent_gender THEN
    RAISE EXCEPTION 'تم تغيير جنس الوالد. يرجى تحديث البيانات والمحاولة مرة أخرى';
  END IF;

  -- Verify parent has valid generation
  IF v_parent.generation IS NULL THEN
    RAISE EXCEPTION 'الجيل غير محدد للوالد. يرجى تحديث الملف الشخصي للوالد أولاً';
  END IF;

  -- Advisory lock for parent coordination (prevents concurrent batch operations)
  PERFORM pg_advisory_xact_lock(hashtext(p_parent_id::text));

  -- ========================================================================
  -- 4. VALIDATE PERMISSIONS (Safety Mechanism #3)
  -- ========================================================================

  -- Check permission level on parent profile
  SELECT check_family_permission_v4(
    p_user_id := v_actor_profile_id,
    p_target_id := p_parent_id
  ) INTO v_permission_level;

  -- QuickAdd requires DIRECT EDIT permission (not suggest-only)
  IF v_permission_level NOT IN ('inner', 'admin', 'moderator') THEN
    IF v_permission_level = 'family' THEN
      RAISE EXCEPTION 'ليس لديك صلاحية مباشرة لإضافة أطفال لهذا الملف. يمكنك إرسال اقتراح للمشرفين';
    ELSIF v_permission_level = 'blocked' THEN
      RAISE EXCEPTION 'تم منعك من إجراء تعديلات على الشجرة. يرجى التواصل مع المشرف';
    ELSE
      RAISE EXCEPTION 'ليس لديك صلاحية لتعديل هذا الملف الشخصي';
    END IF;
  END IF;

  -- ========================================================================
  -- 5. VALIDATE SELECTED PARENTS (Safety Mechanism #2)
  -- ========================================================================

  -- For male parent: validate selected mother (if provided)
  IF p_parent_gender = 'male' AND p_selected_mother_id IS NOT NULL THEN
    -- Check mother exists, is female, and not deleted
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = p_selected_mother_id
        AND gender = 'female'
        AND deleted_at IS NULL
    ) INTO v_selected_mother_valid;

    IF NOT v_selected_mother_valid THEN
      RAISE EXCEPTION 'الملف الشخصي للأم المحددة غير موجود أو محذوف';
    END IF;

    -- Lock selected mother to prevent concurrent deletion
    PERFORM id FROM profiles
    WHERE id = p_selected_mother_id
    FOR UPDATE NOWAIT;
  END IF;

  -- For female parent: validate selected father (REQUIRED)
  IF p_parent_gender = 'female' THEN
    IF p_selected_father_id IS NULL THEN
      RAISE EXCEPTION 'يجب تحديد الأب عند إضافة أطفال لأم';
    END IF;

    -- Check father exists, is male, and not deleted
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = p_selected_father_id
        AND gender = 'male'
        AND deleted_at IS NULL
    ) INTO v_selected_father_valid;

    IF NOT v_selected_father_valid THEN
      RAISE EXCEPTION 'الملف الشخصي للأب المحدد غير موجود أو محذوف';
    END IF;

    -- Lock selected father to prevent concurrent deletion
    PERFORM id FROM profiles
    WHERE id = p_selected_father_id
    FOR UPDATE NOWAIT;
  END IF;

  -- ========================================================================
  -- 6. RESOLVE PARENT ASSIGNMENTS
  -- ========================================================================

  -- Determine father_id and mother_id based on parent gender
  IF p_parent_gender = 'male' THEN
    v_father_id := p_parent_id;
    v_mother_id := p_selected_mother_id;  -- Can be NULL (Munasib case)
  ELSE  -- female
    v_mother_id := p_parent_id;
    v_father_id := p_selected_father_id;  -- Required (validated above)
  END IF;

  -- Calculate child generation (Safety Mechanism #5)
  v_child_generation := v_parent.generation + 1;

  -- ========================================================================
  -- 7. CREATE OPERATION GROUP
  -- ========================================================================

  INSERT INTO operation_groups (
    created_by,
    group_type,
    operation_count,
    description
  ) VALUES (
    v_actor_profile_id,
    'quick_add_batch',
    v_total_operations,
    COALESCE(p_operation_description, 'إضافة سريعة جماعية')
  )
  RETURNING id INTO v_operation_group_id;

  -- ========================================================================
  -- 8. CREATE NEW CHILDREN
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_create)
  LOOP
    -- Validate required fields
    v_child_name := v_child->>'name';
    v_child_gender := v_child->>'gender';

    IF v_child_name IS NULL OR trim(v_child_name) = '' THEN
      RAISE EXCEPTION 'الاسم مطلوب لإنشاء الملف الشخصي';
    END IF;

    IF v_child_gender IS NULL THEN
      RAISE EXCEPTION 'الجنس مطلوب لإنشاء الملف الشخصي';
    END IF;

    -- Validate gender value
    IF v_child_gender NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'قيمة الجنس غير صالحة. يجب أن تكون "male" أو "female"';
    END IF;

    -- Validate name length (including diacritics)
    IF length(v_child_name) > 100 THEN
      RAISE EXCEPTION 'الاسم يتجاوز الحد المسموح به (100 حرف كحد أقصى)';
    END IF;

    -- Validate sibling_order
    v_child_sibling_order := COALESCE((v_child->>'sibling_order')::integer, 0);
    IF v_child_sibling_order < 0 THEN
      RAISE EXCEPTION 'رقم الترتيب يجب أن يكون موجباً أو صفر';
    END IF;

    -- Insert new profile (all 24 fields supported)
    INSERT INTO profiles (
      name,
      gender,
      father_id,
      mother_id,
      generation,
      sibling_order,
      kunya,
      nickname,
      status,
      dob_data,
      dod_data,
      bio,
      birth_place,
      current_residence,
      occupation,
      education,
      phone,
      email,
      photo_url,
      social_media_links,
      achievements,
      timeline,
      dob_is_public,
      profile_visibility,
      version
    ) VALUES (
      v_child_name,
      v_child_gender,
      v_father_id,
      v_mother_id,
      v_child_generation,
      v_child_sibling_order,
      v_child->>'kunya',
      v_child->>'nickname',
      COALESCE(v_child->>'status', 'alive'),
      (v_child->'dob_data')::jsonb,
      (v_child->'dod_data')::jsonb,
      v_child->>'bio',
      v_child->>'birth_place',
      v_child->>'current_residence',
      v_child->>'occupation',
      v_child->>'education',
      v_child->>'phone',
      v_child->>'email',
      v_child->>'photo_url',
      (v_child->'social_media_links')::jsonb,
      (v_child->'achievements')::text[],
      (v_child->'timeline')::jsonb,
      COALESCE((v_child->>'dob_is_public')::boolean, false),
      COALESCE(v_child->>'profile_visibility', 'public'),
      1  -- Initial version
    )
    RETURNING id INTO v_child_id;

    -- Create audit log entry
    INSERT INTO audit_log_enhanced (
      actor_id,
      action_type,
      table_name,
      record_id,
      new_data,
      operation_group_id
    ) VALUES (
      v_actor_profile_id,
      'profile_create',
      'profiles',
      v_child_id,
      to_jsonb(v_child),
      v_operation_group_id
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  -- ========================================================================
  -- 9. UPDATE EXISTING CHILDREN
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_update)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_expected_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف مطلوب للتحديث';
    END IF;

    -- Lock and verify version (optimistic locking)
    SELECT version INTO v_child_version
    FROM profiles
    WHERE id = v_child_id AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الملف الشخصي غير موجود أو محذوف';
    END IF;

    -- Version conflict check
    IF v_child_version != v_child_expected_version THEN
      RAISE EXCEPTION 'تم تحديث البيانات من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى';
    END IF;

    -- Validate sibling_order if updating
    IF v_child ? 'sibling_order' THEN
      v_child_sibling_order := (v_child->>'sibling_order')::integer;
      IF v_child_sibling_order < 0 THEN
        RAISE EXCEPTION 'رقم الترتيب يجب أن يكون موجباً أو صفر';
      END IF;
    END IF;

    -- Validate name length if updating
    IF v_child ? 'name' THEN
      v_child_name := v_child->>'name';
      IF v_child_name IS NULL OR trim(v_child_name) = '' THEN
        RAISE EXCEPTION 'الاسم مطلوب';
      END IF;
      IF length(v_child_name) > 100 THEN
        RAISE EXCEPTION 'الاسم يتجاوز الحد المسموح به (100 حرف كحد أقصى)';
      END IF;
    END IF;

    -- Update profile (dynamic field updates)
    UPDATE profiles
    SET
      name = COALESCE(v_child->>'name', name),
      kunya = COALESCE(v_child->>'kunya', kunya),
      nickname = COALESCE(v_child->>'nickname', nickname),
      status = COALESCE(v_child->>'status', status),
      sibling_order = COALESCE((v_child->>'sibling_order')::integer, sibling_order),
      dob_data = COALESCE((v_child->'dob_data')::jsonb, dob_data),
      dod_data = COALESCE((v_child->'dod_data')::jsonb, dod_data),
      bio = COALESCE(v_child->>'bio', bio),
      birth_place = COALESCE(v_child->>'birth_place', birth_place),
      current_residence = COALESCE(v_child->>'current_residence', current_residence),
      occupation = COALESCE(v_child->>'occupation', occupation),
      education = COALESCE(v_child->>'education', education),
      phone = COALESCE(v_child->>'phone', phone),
      email = COALESCE(v_child->>'email', email),
      photo_url = COALESCE(v_child->>'photo_url', photo_url),
      social_media_links = COALESCE((v_child->'social_media_links')::jsonb, social_media_links),
      achievements = COALESCE((v_child->'achievements')::text[], achievements),
      timeline = COALESCE((v_child->'timeline')::jsonb, timeline),
      dob_is_public = COALESCE((v_child->>'dob_is_public')::boolean, dob_is_public),
      profile_visibility = COALESCE(v_child->>'profile_visibility', profile_visibility),
      version = version + 1,
      updated_at = now()
    WHERE id = v_child_id;

    -- Create audit log entry
    INSERT INTO audit_log_enhanced (
      actor_id,
      action_type,
      table_name,
      record_id,
      old_data,
      new_data,
      operation_group_id
    )
    SELECT
      v_actor_profile_id,
      'profile_update',
      'profiles',
      v_child_id,
      to_jsonb(p.*) - 'version' - 'updated_at',  -- Old data (before update)
      v_child,                                     -- New data (changes applied)
      v_operation_group_id
    FROM profiles p
    WHERE p.id = v_child_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- 10. DELETE CHILDREN (WITH DESCENDANT CHECK)
  -- ========================================================================

  FOR v_child IN SELECT * FROM jsonb_array_elements(p_children_to_delete)
  LOOP
    v_child_id := (v_child->>'id')::uuid;
    v_child_expected_version := COALESCE((v_child->>'version')::integer, 1);

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف مطلوب للحذف';
    END IF;

    -- Lock profile
    SELECT version, name INTO v_child_version, v_child_name
    FROM profiles
    WHERE id = v_child_id AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الملف الشخصي غير موجود أو محذوف بالفعل';
    END IF;

    -- Version conflict check
    IF v_child_version != v_child_expected_version THEN
      RAISE EXCEPTION 'تم تحديث البيانات من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى';
    END IF;

    -- Check for descendants
    SELECT
      EXISTS(SELECT 1 FROM profiles WHERE (father_id = v_child_id OR mother_id = v_child_id) AND deleted_at IS NULL),
      COUNT(*)
    INTO v_has_descendants, v_descendant_count
    FROM profiles
    WHERE (father_id = v_child_id OR mother_id = v_child_id) AND deleted_at IS NULL;

    IF v_has_descendants THEN
      RAISE EXCEPTION 'لا يمكن حذف "%" لأن لديه % طفل/أطفال. يرجى حذف الأطفال أولاً أو استخدام الحذف المتسلسل',
        v_child_name,
        v_descendant_count;
    END IF;

    -- Soft delete
    UPDATE profiles
    SET
      deleted_at = now(),
      version = version + 1
    WHERE id = v_child_id;

    -- Create audit log entry
    INSERT INTO audit_log_enhanced (
      actor_id,
      action_type,
      table_name,
      record_id,
      old_data,
      operation_group_id
    )
    SELECT
      v_actor_profile_id,
      'profile_soft_delete',
      'profiles',
      v_child_id,
      to_jsonb(p.*) - 'deleted_at' - 'version' - 'updated_at',
      v_operation_group_id
    FROM profiles p
    WHERE p.id = v_child_id;

    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- ========================================================================
  -- 11. UPDATE OPERATION GROUP METADATA
  -- ========================================================================

  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;

  UPDATE operation_groups
  SET
    metadata = jsonb_build_object(
      'duration_ms', v_duration_ms,
      'created_count', v_created_count,
      'updated_count', v_updated_count,
      'deleted_count', v_deleted_count,
      'parent_id', p_parent_id,
      'parent_gender', p_parent_gender
    )
  WHERE id = v_operation_group_id;

  -- Log performance
  RAISE NOTICE 'QuickAdd batch save completed in % ms for % operations (created: %, updated: %, deleted: %)',
    v_duration_ms,
    v_total_operations,
    v_created_count,
    v_updated_count,
    v_deleted_count;

  -- ========================================================================
  -- 12. RETURN SUCCESS RESULT
  -- ========================================================================

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حفظ جميع التغييرات بنجاح',
    'operation_group_id', v_operation_group_id,
    'results', jsonb_build_object(
      'created', v_created_count,
      'updated', v_updated_count,
      'deleted', v_deleted_count,
      'total', v_total_operations,
      'duration_ms', v_duration_ms
    )
  );

EXCEPTION
  -- Lock timeout (NOWAIT)
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة بعد قليل';

  -- Transaction timeout
  WHEN query_canceled THEN
    RAISE EXCEPTION 'انتهت مهلة العملية. يرجى تقليل عدد التغييرات والمحاولة مرة أخرى';

  -- Foreign key violation (parent reference)
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'مرجع الوالد غير صالح. يرجى التحقق من البيانات والمحاولة مرة أخرى';

  -- Check constraint violation (e.g., invalid status)
  WHEN check_violation THEN
    RAISE EXCEPTION 'قيمة غير صالحة في أحد الحقول. يرجى التحقق من البيانات';

  -- All other errors
  WHEN OTHERS THEN
    RAISE;  -- Re-raise with original error message
END;
$function$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_quick_add_batch_save TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION admin_quick_add_batch_save IS
'Atomically creates, updates, and deletes child profiles in a single transaction.

PURPOSE:
Replaces 23 sequential RPC calls with 1 atomic batch operation for QuickAddOverlay.
Reduces audit log clutter, improves performance, and provides transaction safety.

SAFETY MECHANISMS:
1. Parent profile locking (prevents TOCTOU vulnerabilities)
2. Selected parent validation (mother/father existence, gender, locking)
3. Permission level validation (rejects suggest-only ''family'' permission)
4. Max batch size limit (50 operations)
5. Generation auto-calculation (don''t trust frontend)
6. All-or-nothing transaction (no partial success)
7. Formal Saudi Arabic error messages

PARAMETERS:
- p_parent_id: Parent profile UUID
- p_parent_gender: ''male'' or ''female''
- p_selected_mother_id: Optional mother UUID (if parent is father)
- p_selected_father_id: Required father UUID (if parent is mother)
- p_children_to_create: JSONB array of child objects with fields:
    {name, gender, sibling_order, kunya, nickname, status, dob_data, ...}
- p_children_to_update: JSONB array with {id, version, ...updated fields}
- p_children_to_delete: JSONB array with {id, version}
- p_operation_description: Optional description for audit trail

RETURNS:
{
  "success": true,
  "message": "تم حفظ جميع التغييرات بنجاح",
  "operation_group_id": "uuid-here",
  "results": {
    "created": 5,
    "updated": 3,
    "deleted": 1,
    "total": 9,
    "duration_ms": 145.3
  }
}

INTEGRATION:
- Creates operation_group for atomic undo via undo_operation_group()
- Links all audit_log_enhanced entries to operation_group_id
- Supports all 24 profile fields from admin_create_profile

PERFORMANCE:
- Expected: <1 second for 20 operations
- Timeout: 10 seconds (adjustable via statement_timeout)
- Advisory lock prevents concurrent batch operations on same parent

ERROR MESSAGES (Formal Saudi Arabic):
- Parent validation: "الملف الشخصي للوالد غير موجود أو محذوف"
- Permission denied: "ليس لديك صلاحية مباشرة لإضافة أطفال لهذا الملف"
- Version conflict: "تم تحديث البيانات من قبل مستخدم آخر"
- Lock conflict: "عملية أخرى قيد التنفيذ على هذا الملف الشخصي"
- Batch size: "الحد الأقصى 50 عملية في الدفعة الواحدة"

EXAMPLES:
-- Create 3 children for father (with selected mother)
SELECT admin_quick_add_batch_save(
  ''parent-uuid'',
  ''male'',
  ''mother-uuid'',
  NULL,
  ''[{"name": "محمد", "gender": "male", "sibling_order": 0}]''::jsonb,
  ''[]''::jsonb,
  ''[]''::jsonb
);

-- Delete 1 child (triggers reordering of siblings)
SELECT admin_quick_add_batch_save(
  ''parent-uuid'',
  ''male'',
  NULL,
  NULL,
  ''[]''::jsonb,
  ''[{"id": "sibling1-uuid", "version": 1, "sibling_order": 0},
     {"id": "sibling2-uuid", "version": 1, "sibling_order": 1}]''::jsonb,
  ''[{"id": "child-uuid", "version": 1}]''::jsonb
);

TESTING:
See /docs/BATCH_SAVE_TESTING.md for manual test scenarios.
';
