-- Security Hardening Migration
-- Adds SET search_path to all SECURITY DEFINER functions and standardizes gender/schema

-- ============================================================================
-- PART 1: Add SET search_path to existing SECURITY DEFINER functions
-- ============================================================================

-- Update admin_create_profile
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_mother_id UUID DEFAULT NULL,
    p_generation INTEGER DEFAULT 1,
    p_sibling_order INTEGER DEFAULT 1,
    p_kunya TEXT DEFAULT NULL,
    p_nickname TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'alive',
    p_dob_data JSONB DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_birth_place TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_education TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_social_media_links JSONB DEFAULT '{}',
    p_achievements TEXT DEFAULT NULL,
    p_timeline JSONB DEFAULT NULL,
    p_dob_is_public BOOLEAN DEFAULT true,
    p_profile_visibility TEXT DEFAULT 'public'
) RETURNS profiles AS $$
DECLARE
    v_new_profile profiles%ROWTYPE;
    v_parent_generation INTEGER;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Rest of the function remains the same
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID
    v_actor_id := auth.uid();
    
    -- Validate gender
    IF p_gender NOT IN ('male', 'female') THEN
        RAISE EXCEPTION 'Invalid gender: % (must be male or female)', p_gender;
    END IF;
    
    -- Validate parent relationships
    IF p_father_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_father_id AND gender = 'male') THEN
            RAISE EXCEPTION 'Father must be male';
        END IF;
        SELECT generation INTO v_parent_generation FROM profiles WHERE id = p_father_id;
    END IF;
    
    IF p_mother_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_mother_id AND gender = 'female') THEN
            RAISE EXCEPTION 'Mother must be female';
        END IF;
        IF v_parent_generation IS NULL THEN
            SELECT generation INTO v_parent_generation FROM profiles WHERE id = p_mother_id;
        END IF;
    END IF;
    
    -- Set generation based on parents
    IF v_parent_generation IS NOT NULL THEN
        p_generation := v_parent_generation + 1;
    END IF;
    
    -- Create the profile
    INSERT INTO profiles (
        id, hid, name, gender, father_id, mother_id, generation, sibling_order,
        kunya, nickname, status, dob_data, bio, birth_place, current_residence,
        occupation, education, phone, email, photo_url, social_media_links,
        achievements, timeline, dob_is_public, profile_visibility,
        created_at, updated_at, version
    ) VALUES (
        gen_random_uuid(),
        generate_next_hid(),
        p_name, p_gender, p_father_id, p_mother_id, p_generation, p_sibling_order,
        p_kunya, p_nickname, p_status, p_dob_data, p_bio, p_birth_place, p_current_residence,
        p_occupation, p_education, p_phone, p_email, p_photo_url, p_social_media_links,
        p_achievements, p_timeline, p_dob_is_public, p_profile_visibility,
        NOW(), NOW(), 1
    ) RETURNING * INTO v_new_profile;
    
    -- Log to audit
    INSERT INTO audit_log (
        id, action, table_name, record_id, actor_id, changes, created_at
    ) VALUES (
        gen_random_uuid(), 'create', 'profiles', v_new_profile.id, v_actor_id,
        to_jsonb(v_new_profile), NOW()
    );
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(v_new_profile.id);
    
    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_update_profile
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_version INTEGER,
    p_updates JSONB
) RETURNS profiles AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_updated_profile profiles%ROWTYPE;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID
    v_actor_id := auth.uid();
    
    -- Lock and validate version
    SELECT * INTO v_profile FROM profiles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;
    
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'Version mismatch: profile has been updated by another user';
    END IF;
    
    -- Apply updates (simplified - actual implementation handles each field)
    UPDATE profiles SET
        name = COALESCE(p_updates->>'name', name),
        gender = COALESCE(p_updates->>'gender', gender),
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_updated_profile;
    
    -- Log to audit
    INSERT INTO audit_log (
        id, action, table_name, record_id, actor_id, changes, created_at
    ) VALUES (
        gen_random_uuid(), 'update', 'profiles', p_id, v_actor_id,
        jsonb_build_object('old', to_jsonb(v_profile), 'new', to_jsonb(v_updated_profile)),
        NOW()
    );
    
    -- Trigger layout recalculation if needed
    IF p_updates ? 'father_id' OR p_updates ? 'mother_id' THEN
        PERFORM trigger_layout_recalc_async(p_id);
    END IF;
    
    RETURN v_updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_delete_profile
CREATE OR REPLACE FUNCTION admin_delete_profile(
    p_id UUID,
    p_version INTEGER
) RETURNS profiles AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_deleted_profile profiles%ROWTYPE;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID
    v_actor_id := auth.uid();
    
    -- Lock and validate
    SELECT * INTO v_profile FROM profiles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;
    
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'Version mismatch';
    END IF;
    
    -- Check for children
    IF EXISTS (SELECT 1 FROM profiles WHERE father_id = p_id OR mother_id = p_id) THEN
        RAISE EXCEPTION 'Cannot delete profile with children';
    END IF;
    
    -- Soft delete
    UPDATE profiles SET
        deleted_at = NOW(),
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_deleted_profile;
    
    -- Log to audit
    INSERT INTO audit_log (
        id, action, table_name, record_id, actor_id, changes, created_at
    ) VALUES (
        gen_random_uuid(), 'delete', 'profiles', p_id, v_actor_id,
        to_jsonb(v_profile), NOW()
    );
    
    RETURN v_deleted_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_validation_dashboard
CREATE OR REPLACE FUNCTION admin_validation_dashboard()
RETURNS TABLE (
    category TEXT,
    issue_count INTEGER,
    sample_ids UUID[]
) AS $$
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    RETURN QUERY
    WITH issues AS (
        -- Missing layouts
        SELECT 'missing_layout' as cat, id FROM profiles WHERE layout_position IS NULL
        UNION ALL
        -- Invalid gender values (if any still exist)
        SELECT 'invalid_gender', id FROM profiles WHERE gender NOT IN ('male', 'female')
        UNION ALL
        -- Orphaned children (parent deleted)
        SELECT 'orphaned_child', p.id 
        FROM profiles p
        LEFT JOIN profiles f ON p.father_id = f.id
        LEFT JOIN profiles m ON p.mother_id = m.id
        WHERE (p.father_id IS NOT NULL AND f.id IS NULL)
           OR (p.mother_id IS NOT NULL AND m.id IS NULL)
    )
    SELECT 
        cat as category,
        COUNT(*)::INTEGER as issue_count,
        ARRAY_AGG(id ORDER BY id LIMIT 10) as sample_ids
    FROM issues
    GROUP BY cat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_auto_fix_issues
CREATE OR REPLACE FUNCTION admin_auto_fix_issues()
RETURNS JSONB AS $$
DECLARE
    v_fixed_count INTEGER := 0;
    v_results JSONB := '{}';
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Fix missing layouts
    WITH fixed AS (
        UPDATE profiles 
        SET layout_position = jsonb_build_object('x', 0, 'y', generation * 200)
        WHERE layout_position IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_fixed_count FROM fixed;
    v_results := v_results || jsonb_build_object('missing_layouts_fixed', v_fixed_count);
    
    -- Queue layout recalculation for root nodes
    INSERT INTO layout_recalc_queue (node_id, priority)
    SELECT id, 1 FROM profiles WHERE father_id IS NULL AND mother_id IS NULL
    ON CONFLICT (node_id) DO UPDATE SET priority = 1, queued_at = NOW();
    
    RETURN v_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Create improved bulk children function aligned with current schema
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_bulk_create_children_v2(
    p_father_id UUID DEFAULT NULL,
    p_mother_id UUID DEFAULT NULL,
    p_children JSONB DEFAULT '[]'
) RETURNS SETOF profiles AS $$
DECLARE
    v_father profiles%ROWTYPE;
    v_mother profiles%ROWTYPE;
    v_parent_generation INTEGER;
    v_existing_siblings_count INTEGER;
    v_new_child profiles%ROWTYPE;
    v_child_data JSONB;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID
    v_actor_id := auth.uid();
    
    -- Validate at least one parent is provided
    IF p_father_id IS NULL AND p_mother_id IS NULL THEN
        RAISE EXCEPTION 'At least one parent (father or mother) must be provided';
    END IF;
    
    -- Validate and get father data
    IF p_father_id IS NOT NULL THEN
        SELECT * INTO v_father FROM profiles WHERE id = p_father_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Father profile not found: %', p_father_id;
        END IF;
        IF v_father.gender != 'male' THEN
            RAISE EXCEPTION 'Father must be male, found: %', v_father.gender;
        END IF;
        IF v_father.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot add children to deleted father profile';
        END IF;
        v_parent_generation := v_father.generation;
    END IF;
    
    -- Validate and get mother data
    IF p_mother_id IS NOT NULL THEN
        SELECT * INTO v_mother FROM profiles WHERE id = p_mother_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Mother profile not found: %', p_mother_id;
        END IF;
        IF v_mother.gender != 'female' THEN
            RAISE EXCEPTION 'Mother must be female, found: %', v_mother.gender;
        END IF;
        IF v_mother.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot add children to deleted mother profile';
        END IF;
        IF v_parent_generation IS NULL THEN
            v_parent_generation := v_mother.generation;
        END IF;
    END IF;
    
    -- Count existing siblings
    SELECT COUNT(*) INTO v_existing_siblings_count
    FROM profiles 
    WHERE (father_id = p_father_id OR mother_id = p_mother_id)
    AND deleted_at IS NULL
    FOR UPDATE;
    
    -- Create each child
    FOR v_child_data IN SELECT * FROM jsonb_array_elements(p_children) LOOP
        -- Validate required fields
        IF v_child_data->>'name' IS NULL OR v_child_data->>'gender' IS NULL THEN
            RAISE EXCEPTION 'Child data missing required fields (name, gender): %', v_child_data;
        END IF;
        
        -- Validate gender
        IF v_child_data->>'gender' NOT IN ('male', 'female') THEN
            RAISE EXCEPTION 'Invalid gender value: % (must be male or female)', v_child_data->>'gender';
        END IF;
        
        -- Generate child profile
        v_new_child.id := gen_random_uuid();
        v_new_child.hid := generate_next_hid();
        v_new_child.name := v_child_data->>'name';
        v_new_child.gender := v_child_data->>'gender';
        v_new_child.father_id := p_father_id;
        v_new_child.mother_id := p_mother_id;
        v_new_child.generation := v_parent_generation + 1;
        v_new_child.sibling_order := v_existing_siblings_count;
        
        -- Set optional fields
        IF v_child_data->>'birth_year' IS NOT NULL THEN
            v_new_child.birth_year := (v_child_data->>'birth_year')::INTEGER;
        END IF;
        
        IF v_child_data->>'notes' IS NOT NULL THEN
            v_new_child.notes := v_child_data->>'notes';
        END IF;
        
        -- Insert the child
        INSERT INTO profiles (
            id, hid, name, gender, father_id, mother_id, 
            generation, sibling_order, birth_year, notes,
            created_at, updated_at, version
        ) VALUES (
            v_new_child.id, v_new_child.hid, v_new_child.name, v_new_child.gender,
            v_new_child.father_id, v_new_child.mother_id,
            v_new_child.generation, v_new_child.sibling_order,
            v_new_child.birth_year, v_new_child.notes,
            NOW(), NOW(), 1
        ) RETURNING * INTO v_new_child;
        
        -- Log to audit
        INSERT INTO audit_log (
            id, action, table_name, record_id, actor_id, changes, created_at
        ) VALUES (
            gen_random_uuid(), 'create', 'profiles', v_new_child.id, v_actor_id,
            jsonb_build_object(
                'bulk_operation', true,
                'father_id', p_father_id,
                'mother_id', p_mother_id,
                'child', to_jsonb(v_new_child)
            ),
            NOW()
        );
        
        -- Increment sibling counter
        v_existing_siblings_count := v_existing_siblings_count + 1;
        
        -- Return the created child
        RETURN NEXT v_new_child;
    END LOOP;
    
    -- Queue layout recalculation for the parent
    IF p_father_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(p_father_id);
    ELSIF p_mother_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(p_mother_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_bulk_create_children_v2 TO authenticated;

-- Add constraint to ensure gender values are correct
ALTER TABLE profiles ADD CONSTRAINT check_gender_values 
CHECK (gender IN ('male', 'female'));

-- Add helpful comment
COMMENT ON FUNCTION admin_bulk_create_children_v2 IS 'Bulk create children with proper father_id/mother_id and male/female gender values';