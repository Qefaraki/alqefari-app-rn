-- Fix function conflicts by dropping old versions first

-- Drop conflicting functions with return type changes
DROP FUNCTION IF EXISTS get_tree_stats();
DROP FUNCTION IF EXISTS admin_bulk_create_children(UUID, TEXT, JSONB);

-- Recreate get_tree_stats with proper search_path
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

-- Recreate admin_bulk_create_children with proper search_path
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

-- Grant permissions on the fixed functions
GRANT EXECUTE ON FUNCTION get_tree_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_create_children TO authenticated;