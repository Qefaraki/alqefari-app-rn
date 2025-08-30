-- Create admin_bulk_create_children RPC for efficient bulk child creation
CREATE OR REPLACE FUNCTION admin_bulk_create_children(
    p_parent_id UUID,
    p_children JSONB
) RETURNS SETOF profiles AS $$
DECLARE
    v_parent profiles%ROWTYPE;
    v_existing_siblings_count INTEGER;
    v_new_child profiles%ROWTYPE;
    v_child_data JSONB;
    v_created_children profiles[];
    v_job_id UUID;
    v_actor_id UUID;
    v_parent_root UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor ID
    v_actor_id := auth.uid();
    
    -- Validate parent exists and get its data
    SELECT * INTO v_parent FROM profiles WHERE id = p_parent_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent profile not found: %', p_parent_id;
    END IF;

    -- Check if parent is soft-deleted (if deleted_at column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'deleted_at') THEN
        IF v_parent.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot add children to deleted profile: %', p_parent_id;
        END IF;
    END IF;

    -- Get parent's root for consistent tree structure
    v_parent_root := COALESCE(v_parent.root, v_parent.id);

    -- Lock existing siblings to prevent concurrent sibling_order conflicts
    -- Count existing children
    SELECT COUNT(*) INTO v_existing_siblings_count
    FROM profiles 
    WHERE parent_id = p_parent_id
    FOR UPDATE;

    -- Begin creating children
    FOR v_child_data IN SELECT * FROM jsonb_array_elements(p_children) LOOP
        -- Validate required fields
        IF v_child_data->>'name' IS NULL OR v_child_data->>'gender' IS NULL THEN
            RAISE EXCEPTION 'Child data missing required fields (name, gender): %', v_child_data;
        END IF;

        -- Validate gender
        IF v_child_data->>'gender' NOT IN ('M', 'F') THEN
            RAISE EXCEPTION 'Invalid gender value: %', v_child_data->>'gender';
        END IF;

        -- Generate HID using existing function
        v_new_child.id := gen_random_uuid();
        v_new_child.hid := generate_next_hid();
        v_new_child.name := v_child_data->>'name';
        v_new_child.gender := v_child_data->>'gender';
        v_new_child.parent_id := p_parent_id;
        v_new_child.root := v_parent_root;
        v_new_child.sibling_order := v_existing_siblings_count;
        v_new_child.generation := v_parent.generation + 1;
        
        -- Set optional fields
        IF v_child_data->>'birth_year' IS NOT NULL THEN
            v_new_child.birth_year := (v_child_data->>'birth_year')::INTEGER;
        END IF;
        
        IF v_child_data->>'notes' IS NOT NULL THEN
            v_new_child.notes := v_child_data->>'notes';
        END IF;

        -- Insert the child
        INSERT INTO profiles (
            id, hid, name, gender, parent_id, root, 
            sibling_order, generation, birth_year, notes
        ) VALUES (
            v_new_child.id, v_new_child.hid, v_new_child.name, 
            v_new_child.gender, v_new_child.parent_id, v_new_child.root,
            v_new_child.sibling_order, v_new_child.generation,
            v_new_child.birth_year, v_new_child.notes
        ) RETURNING * INTO v_new_child;

        -- Store created child
        v_created_children := array_append(v_created_children, v_new_child);

        -- Create audit log entry
        INSERT INTO audit_log (
            id, action, table_name, target_profile_id, 
            actor_id, new_data, created_at
        ) VALUES (
            gen_random_uuid(), 
            'INSERT', 
            'profiles', 
            v_new_child.id,
            v_actor_id,
            jsonb_build_object(
                'id', v_new_child.id,
                'hid', v_new_child.hid,
                'name', v_new_child.name,
                'gender', v_new_child.gender,
                'parent_id', v_new_child.parent_id,
                'sibling_order', v_new_child.sibling_order,
                'generation', v_new_child.generation,
                'birth_year', v_new_child.birth_year,
                'notes', v_new_child.notes
            ),
            now()
        );

        -- Increment sibling order for next child
        v_existing_siblings_count := v_existing_siblings_count + 1;

        -- Return the created child
        RETURN NEXT v_new_child;
    END LOOP;

    -- Create a single background job for layout recalculation
    INSERT INTO background_jobs (
        id, job_type, status, details, created_by, created_at
    ) VALUES (
        gen_random_uuid(),
        'layout_recalculation',
        'queued',
        jsonb_build_object(
            'parent_id', p_parent_id,
            'parent_hid', v_parent.hid,
            'children_count', array_length(v_created_children, 1),
            'children_ids', (SELECT array_agg(c.id) FROM unnest(v_created_children) c)
        ),
        v_actor_id,
        now()
    ) RETURNING id INTO v_job_id;

    -- Trigger async layout recalculation (using existing function)
    PERFORM trigger_layout_recalc_async(v_parent_root);

    -- Log the bulk operation in audit log
    INSERT INTO audit_log (
        id, action, table_name, actor_id, 
        new_data, created_at
    ) VALUES (
        gen_random_uuid(),
        'BULK_INSERT',
        'profiles',
        v_actor_id,
        jsonb_build_object(
            'parent_id', p_parent_id,
            'children_count', array_length(v_created_children, 1),
            'job_id', v_job_id
        ),
        now()
    );

    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback will happen automatically
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be checked inside function)
GRANT EXECUTE ON FUNCTION admin_bulk_create_children TO authenticated;