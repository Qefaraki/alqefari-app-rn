-- 025_consistency_fixes.sql
-- Add SET search_path to all SECURITY DEFINER functions and standardize admin checks

-- ============================================================================
-- 1. Fix admin functions from 009_create_admin_functions_v2.sql
-- ============================================================================

-- admin_create_profile
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_mother_id UUID DEFAULT NULL,
    p_generation INT DEFAULT 1,
    p_sibling_order INT DEFAULT 1,
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
    p_achievements TEXT[] DEFAULT NULL,
    p_timeline JSONB DEFAULT NULL,
    p_dob_is_public BOOLEAN DEFAULT FALSE,
    p_profile_visibility TEXT DEFAULT 'public'
) RETURNS profiles AS $$
DECLARE
    v_new_profile profiles;
    v_next_hid TEXT;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Validate parents exist if provided
    IF p_father_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_father_id AND deleted_at IS NULL) THEN
            RAISE EXCEPTION 'Father profile not found or deleted';
        END IF;
        
        -- Prevent circular relationships
        IF p_father_id = p_mother_id THEN
            RAISE EXCEPTION 'Circular parent relationship detected';
        END IF;
    END IF;
    
    IF p_mother_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_mother_id AND deleted_at IS NULL) THEN
            RAISE EXCEPTION 'Mother profile not found or deleted';
        END IF;
    END IF;
    
    -- Validate generation hierarchy
    IF p_father_id IS NOT NULL THEN
        IF p_generation <= (SELECT generation FROM profiles WHERE id = p_father_id) THEN
            RAISE EXCEPTION 'Generation hierarchy violation: child generation must be greater than parent';
        END IF;
    END IF;
    
    IF p_mother_id IS NOT NULL THEN
        IF p_generation <= (SELECT generation FROM profiles WHERE id = p_mother_id) THEN
            RAISE EXCEPTION 'Generation hierarchy violation: child generation must be greater than parent';
        END IF;
    END IF;
    
    -- Generate next HID
    IF p_father_id IS NOT NULL THEN
        v_next_hid := generate_next_hid((SELECT hid FROM profiles WHERE id = p_father_id));
    ELSIF p_mother_id IS NOT NULL THEN
        v_next_hid := generate_next_hid((SELECT hid FROM profiles WHERE id = p_mother_id));
    ELSE
        v_next_hid := generate_next_hid(NULL);
    END IF;
    
    -- Create the profile
    INSERT INTO profiles (
        hid, name, gender, father_id, mother_id, generation, sibling_order,
        kunya, nickname, status, dob_data, bio, birth_place, current_residence,
        occupation, education, phone, email, photo_url, social_media_links,
        achievements, timeline, dob_is_public, profile_visibility,
        created_by, updated_by, version
    ) VALUES (
        v_next_hid, p_name, p_gender, p_father_id, p_mother_id, p_generation, p_sibling_order,
        p_kunya, p_nickname, p_status, p_dob_data, p_bio, p_birth_place, p_current_residence,
        p_occupation, p_education, p_phone, p_email, p_photo_url, p_social_media_links,
        p_achievements, p_timeline, p_dob_is_public, p_profile_visibility,
        v_actor_id, v_actor_id, 1
    ) RETURNING * INTO v_new_profile;
    
    -- Log to audit
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'INSERT', 'profiles', v_new_profile.id, v_actor_id,
        NULL, to_jsonb(v_new_profile), jsonb_build_object('source', 'admin_create_profile')
    );
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(v_new_profile.id);
    
    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_profile
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_updates JSONB
) RETURNS profiles AS $$
DECLARE
    v_old_profile profiles;
    v_updated_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Lock and fetch the profile
    SELECT * INTO v_old_profile FROM profiles 
    WHERE id = p_id AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or deleted';
    END IF;
    
    -- Apply updates using dynamic SQL (safe with parameterized query)
    UPDATE profiles 
    SET 
        name = COALESCE(p_updates->>'name', name),
        kunya = COALESCE(p_updates->>'kunya', kunya),
        nickname = COALESCE(p_updates->>'nickname', nickname),
        gender = COALESCE(p_updates->>'gender', gender),
        status = COALESCE(p_updates->>'status', status),
        dob_data = COALESCE(p_updates->'dob_data', dob_data),
        dod_data = COALESCE(p_updates->'dod_data', dod_data),
        bio = COALESCE(p_updates->>'bio', bio),
        birth_place = COALESCE(p_updates->>'birth_place', birth_place),
        current_residence = COALESCE(p_updates->>'current_residence', current_residence),
        occupation = COALESCE(p_updates->>'occupation', occupation),
        education = COALESCE(p_updates->>'education', education),
        phone = COALESCE(p_updates->>'phone', phone),
        email = COALESCE(p_updates->>'email', email),
        photo_url = COALESCE(p_updates->>'photo_url', photo_url),
        social_media_links = COALESCE(p_updates->'social_media_links', social_media_links),
        achievements = COALESCE((p_updates->'achievements')::TEXT[], achievements),
        timeline = COALESCE(p_updates->'timeline', timeline),
        dob_is_public = COALESCE((p_updates->>'dob_is_public')::BOOLEAN, dob_is_public),
        profile_visibility = COALESCE(p_updates->>'profile_visibility', profile_visibility),
        updated_by = v_actor_id,
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_updated_profile;
    
    -- Log to audit
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'UPDATE', 'profiles', p_id, v_actor_id,
        to_jsonb(v_old_profile), to_jsonb(v_updated_profile),
        jsonb_build_object('updates', p_updates, 'source', 'admin_update_profile')
    );
    
    -- Trigger layout recalculation if structural changes
    IF p_updates ? 'father_id' OR p_updates ? 'mother_id' OR p_updates ? 'generation' THEN
        PERFORM trigger_layout_recalc_async(p_id);
    END IF;
    
    RETURN v_updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_profile
CREATE OR REPLACE FUNCTION admin_delete_profile(p_id UUID)
RETURNS profiles AS $$
DECLARE
    v_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Soft delete the profile
    UPDATE profiles 
    SET deleted_at = NOW(), updated_by = v_actor_id, updated_at = NOW()
    WHERE id = p_id AND deleted_at IS NULL
    RETURNING * INTO v_profile;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or already deleted';
    END IF;
    
    -- Log to audit
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'DELETE', 'profiles', p_id, v_actor_id,
        to_jsonb(v_profile), NULL,
        jsonb_build_object('soft_delete', true, 'source', 'admin_delete_profile')
    );
    
    -- Trigger layout recalculation for parent
    IF v_profile.father_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(v_profile.father_id);
    ELSIF v_profile.mother_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(v_profile.mother_id);
    END IF;
    
    RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_restore_profile
CREATE OR REPLACE FUNCTION admin_restore_profile(p_id UUID)
RETURNS profiles AS $$
DECLARE
    v_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Restore the profile
    UPDATE profiles 
    SET deleted_at = NULL, updated_by = v_actor_id, updated_at = NOW()
    WHERE id = p_id AND deleted_at IS NOT NULL
    RETURNING * INTO v_profile;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or not deleted';
    END IF;
    
    -- Log to audit
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'UPDATE', 'profiles', p_id, v_actor_id,
        NULL, to_jsonb(v_profile),
        jsonb_build_object('action', 'restore', 'source', 'admin_restore_profile')
    );
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(p_id);
    
    RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_reorder_siblings
CREATE OR REPLACE FUNCTION admin_reorder_siblings(
    p_profile_id UUID,
    p_new_order INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Get the profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or deleted';
    END IF;
    
    -- Update sibling orders
    UPDATE profiles 
    SET sibling_order = CASE 
        WHEN id = p_profile_id THEN p_new_order
        WHEN sibling_order >= p_new_order AND sibling_order < v_profile.sibling_order THEN sibling_order + 1
        WHEN sibling_order <= p_new_order AND sibling_order > v_profile.sibling_order THEN sibling_order - 1
        ELSE sibling_order
    END,
    updated_at = NOW(),
    updated_by = v_actor_id
    WHERE (father_id = v_profile.father_id OR (father_id IS NULL AND v_profile.father_id IS NULL))
      AND (mother_id = v_profile.mother_id OR (mother_id IS NULL AND v_profile.mother_id IS NULL))
      AND deleted_at IS NULL;
    
    -- Log to audit
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'UPDATE', 'profiles', p_profile_id, v_actor_id,
        jsonb_build_object('old_order', v_profile.sibling_order),
        jsonb_build_object('new_order', p_new_order),
        jsonb_build_object('action', 'reorder_siblings', 'source', 'admin_reorder_siblings')
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Fix safe access functions from 011_create_safe_access_functions.sql
-- ============================================================================

-- get_branch_data
CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT,
    p_max_depth INT DEFAULT 3
) RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    status TEXT,
    photo_url TEXT,
    depth INT
) AS $$
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Start with the requested node
        SELECT p.*, 0 as depth
        FROM profiles p
        WHERE p.hid = p_hid AND p.deleted_at IS NULL
        
        UNION ALL
        
        -- Get children up to max depth
        SELECT c.*, b.depth + 1
        FROM profiles c
        INNER JOIN branch b ON (c.father_id = b.id OR c.mother_id = b.id)
        WHERE c.deleted_at IS NULL AND b.depth < p_max_depth
    )
    SELECT 
        b.id, b.hid, b.name, b.father_id, b.mother_id, 
        b.generation, b.sibling_order, b.gender, b.status, 
        b.photo_url, b.depth
    FROM branch b
    ORDER BY b.generation, b.sibling_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- search_profiles_safe
CREATE OR REPLACE FUNCTION search_profiles_safe(
    p_search_term TEXT,
    p_limit INT DEFAULT 50
) RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    kunya TEXT,
    nickname TEXT,
    gender TEXT,
    status TEXT,
    generation INT,
    father_id UUID,
    mother_id UUID,
    photo_url TEXT
) AS $$
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    RETURN QUERY
    SELECT 
        p.id, p.hid, p.name, p.kunya, p.nickname,
        p.gender, p.status, p.generation,
        p.father_id, p.mother_id, p.photo_url
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND (
        p.name ILIKE '%' || p_search_term || '%'
        OR p.kunya ILIKE '%' || p_search_term || '%'
        OR p.nickname ILIKE '%' || p_search_term || '%'
      )
    ORDER BY p.generation, p.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_person_marriages (from 013_fix_marriage_function.sql)
CREATE OR REPLACE FUNCTION get_person_marriages(p_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    SELECT json_agg(
        json_build_object(
            'id', m.id,
            'spouse_id', CASE 
                WHEN m.husband_id = p_id THEN m.wife_id 
                ELSE m.husband_id 
            END,
            'spouse_name', CASE 
                WHEN m.husband_id = p_id THEN w.name 
                ELSE h.name 
            END,
            'spouse_hid', CASE 
                WHEN m.husband_id = p_id THEN w.hid 
                ELSE h.hid 
            END,
            'munasib', m.munasib,
            'start_date', m.start_date,
            'end_date', m.end_date,
            'status', m.status,
            'created_at', m.created_at
        )
    ) INTO v_result
    FROM marriages m
    LEFT JOIN profiles h ON m.husband_id = h.id
    LEFT JOIN profiles w ON m.wife_id = w.id
    WHERE (m.husband_id = p_id OR m.wife_id = p_id);
    
    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_tree_stats
CREATE OR REPLACE FUNCTION get_tree_stats()
RETURNS JSON AS $$
DECLARE
    v_stats JSON;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    SELECT json_build_object(
        'total_profiles', COUNT(*),
        'total_males', COUNT(*) FILTER (WHERE gender = 'male'),
        'total_females', COUNT(*) FILTER (WHERE gender = 'female'),
        'total_alive', COUNT(*) FILTER (WHERE status = 'alive'),
        'total_deceased', COUNT(*) FILTER (WHERE status = 'deceased'),
        'total_marriages', (SELECT COUNT(*) FROM marriages),
        'generations', json_build_object(
            'min', MIN(generation),
            'max', MAX(generation),
            'count', COUNT(DISTINCT generation)
        ),
        'last_updated', MAX(updated_at)
    ) INTO v_stats
    FROM profiles
    WHERE deleted_at IS NULL;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Fix bulk operations from 012_create_bulk_operations.sql
-- ============================================================================

-- admin_bulk_create_children
CREATE OR REPLACE FUNCTION admin_bulk_create_children(
    p_parent_id UUID,
    p_parent_type TEXT,
    p_children JSONB
) RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_parent profiles;
    v_other_parent_id UUID;
    v_child JSONB;
    v_created_ids UUID[];
    v_created_child profiles;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Validate parent exists
    SELECT * INTO v_parent FROM profiles WHERE id = p_parent_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent profile not found or deleted';
    END IF;
    
    -- Determine father_id and mother_id based on parent type
    IF p_parent_type = 'father' THEN
        IF v_parent.gender != 'male' THEN
            RAISE EXCEPTION 'Father must be male';
        END IF;
    ELSIF p_parent_type = 'mother' THEN
        IF v_parent.gender != 'female' THEN
            RAISE EXCEPTION 'Mother must be female';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid parent_type: must be father or mother';
    END IF;
    
    -- Process each child
    FOR v_child IN SELECT * FROM jsonb_array_elements(p_children)
    LOOP
        -- Create child profile
        IF p_parent_type = 'father' THEN
            INSERT INTO profiles (
                hid, name, gender, father_id, mother_id, generation,
                sibling_order, status, created_by, updated_by
            ) VALUES (
                generate_next_hid(v_parent.hid),
                v_child->>'name',
                v_child->>'gender',
                p_parent_id,
                v_other_parent_id,
                v_parent.generation + 1,
                COALESCE((v_child->>'sibling_order')::INT, 1),
                COALESCE(v_child->>'status', 'alive'),
                v_actor_id,
                v_actor_id
            ) RETURNING * INTO v_created_child;
        ELSE
            INSERT INTO profiles (
                hid, name, gender, father_id, mother_id, generation,
                sibling_order, status, created_by, updated_by
            ) VALUES (
                generate_next_hid(v_parent.hid),
                v_child->>'name',
                v_child->>'gender',
                v_other_parent_id,
                p_parent_id,
                v_parent.generation + 1,
                COALESCE((v_child->>'sibling_order')::INT, 1),
                COALESCE(v_child->>'status', 'alive'),
                v_actor_id,
                v_actor_id
            ) RETURNING * INTO v_created_child;
        END IF;
        
        v_created_ids := array_append(v_created_ids, v_created_child.id);
        
        -- Log to audit
        INSERT INTO audit_log (
            action, table_name, target_profile_id, actor_id,
            old_data, new_data, details
        ) VALUES (
            'BULK_INSERT', 'profiles', v_created_child.id, v_actor_id,
            NULL, to_jsonb(v_created_child),
            jsonb_build_object(
                'parent_id', p_parent_id,
                'parent_type', p_parent_type,
                'source', 'admin_bulk_create_children'
            )
        );
    END LOOP;
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(p_parent_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'created_count', array_length(v_created_ids, 1),
        'created_ids', v_created_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Fix admin_revert_action from 017_admin_revert_action.sql
-- ============================================================================

-- admin_revert_action
CREATE OR REPLACE FUNCTION admin_revert_action(p_audit_log_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_audit_entry audit_log%ROWTYPE;
    v_actor_id UUID;
    v_result JSONB;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check admin permission using standardized function
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor for audit
    v_actor_id := auth.uid();
    
    -- Fetch the audit log entry
    SELECT * INTO v_audit_entry FROM audit_log WHERE id = p_audit_log_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit log entry not found';
    END IF;
    
    -- Check if already reverted
    IF v_audit_entry.reverted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This action has already been reverted';
    END IF;
    
    -- Perform revert based on action type
    CASE v_audit_entry.action
        WHEN 'INSERT' THEN
            -- Delete the inserted record
            IF v_audit_entry.table_name = 'profiles' THEN
                UPDATE profiles SET deleted_at = NOW() 
                WHERE id = v_audit_entry.target_profile_id;
            END IF;
            v_result := jsonb_build_object('action', 'deleted', 'id', v_audit_entry.target_profile_id);
            
        WHEN 'UPDATE' THEN
            -- Restore old data
            IF v_audit_entry.table_name = 'profiles' AND v_audit_entry.old_data IS NOT NULL THEN
                UPDATE profiles 
                SET 
                    name = v_audit_entry.old_data->>'name',
                    kunya = v_audit_entry.old_data->>'kunya',
                    nickname = v_audit_entry.old_data->>'nickname',
                    gender = v_audit_entry.old_data->>'gender',
                    status = v_audit_entry.old_data->>'status',
                    updated_at = NOW(),
                    updated_by = v_actor_id,
                    version = version + 1
                WHERE id = v_audit_entry.target_profile_id;
            END IF;
            v_result := jsonb_build_object('action', 'restored', 'id', v_audit_entry.target_profile_id);
            
        WHEN 'DELETE' THEN
            -- Restore deleted record
            IF v_audit_entry.table_name = 'profiles' THEN
                UPDATE profiles SET deleted_at = NULL 
                WHERE id = v_audit_entry.target_profile_id;
            END IF;
            v_result := jsonb_build_object('action', 'undeleted', 'id', v_audit_entry.target_profile_id);
            
        ELSE
            RAISE EXCEPTION 'Cannot revert action type: %', v_audit_entry.action;
    END CASE;
    
    -- Mark as reverted
    UPDATE audit_log 
    SET reverted_at = NOW(), reverted_by = v_actor_id
    WHERE id = p_audit_log_id;
    
    -- Log the revert action
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        old_data, new_data, details
    ) VALUES (
        'REVERT', v_audit_entry.table_name, v_audit_entry.target_profile_id, v_actor_id,
        v_audit_entry.new_data, v_audit_entry.old_data,
        jsonb_build_object(
            'reverted_audit_id', p_audit_log_id,
            'original_action', v_audit_entry.action,
            'source', 'admin_revert_action'
        )
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

-- Grant execute permissions on all admin functions
GRANT EXECUTE ON FUNCTION admin_create_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_restore_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reorder_siblings TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_create_children TO authenticated;
GRANT EXECUTE ON FUNCTION admin_revert_action TO authenticated;

-- Grant execute permissions on safe access functions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_profiles_safe TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_person_marriages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tree_stats TO anon, authenticated;

-- ============================================================================
-- 6. Add migration metadata
-- ============================================================================
COMMENT ON SCHEMA public IS 'Migration 025: Consistency fixes - Added SET search_path to all SECURITY DEFINER functions, standardized admin checks to use is_admin()';