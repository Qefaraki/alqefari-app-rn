-- Bulk Operations and Performance Optimizations

-- Function for bulk layout updates (called by Edge Function)
CREATE OR REPLACE FUNCTION admin_bulk_update_layouts(
    p_updates JSONB[]
)
RETURNS JSONB AS $$
DECLARE
    update_count INT := 0;
    error_count INT := 0;
    batch_size INT := 100;
    i INT;
BEGIN
    -- Check service role (Edge Functions only)
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'This function can only be called by Edge Functions';
    END IF;
    
    -- Process updates in batches for better performance
    FOR i IN 1..array_length(p_updates, 1) BY batch_size LOOP
        BEGIN
            -- Bulk update using unnest
            UPDATE profiles p
            SET 
                layout_position = u.data->'layout_position',
                tree_meta = COALESCE(tree_meta, '{}'::jsonb) || (u.data->'tree_meta')::jsonb,
                updated_at = NOW()
            FROM (
                SELECT 
                    (elem->>'id')::UUID as id,
                    elem as data
                FROM unnest(p_updates[i:LEAST(i + batch_size - 1, array_length(p_updates, 1))]) as elem
            ) u
            WHERE p.id = u.id AND p.deleted_at IS NULL;
            
            GET DIAGNOSTICS update_count = update_count + ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            -- Log error but continue processing
            RAISE NOTICE 'Error in batch %: %', i, SQLERRM;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', error_count = 0,
        'updated_count', update_count,
        'error_count', error_count,
        'total_requested', array_length(p_updates, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update descendants count recursively
CREATE OR REPLACE FUNCTION update_descendants_count(p_root_id UUID)
RETURNS VOID AS $$
BEGIN
    WITH RECURSIVE descendant_counts AS (
        -- Calculate descendants for each node
        SELECT 
            p.id,
            COUNT(DISTINCT d.id) as desc_count
        FROM profiles p
        LEFT JOIN LATERAL (
            WITH RECURSIVE descendants AS (
                SELECT id FROM profiles WHERE father_id = p.id AND deleted_at IS NULL
                UNION ALL
                SELECT p2.id 
                FROM profiles p2
                INNER JOIN descendants d ON p2.father_id = d.id
                WHERE p2.deleted_at IS NULL
            )
            SELECT id FROM descendants
        ) d ON TRUE
        WHERE p.deleted_at IS NULL
        GROUP BY p.id
    )
    UPDATE profiles p
    SET descendants_count = dc.desc_count
    FROM descendant_counts dc
    WHERE p.id = dc.id;
END;
$$ LANGUAGE plpgsql;

-- Validation dashboard function
CREATE OR REPLACE FUNCTION admin_validation_dashboard()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details JSONB,
    severity TEXT,
    affected_count INT
) AS $$
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    
    -- Check 1: Orphaned nodes (profiles without valid parents)
    RETURN QUERY
    SELECT 
        'Orphaned Nodes' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END as status,
        jsonb_build_object(
            'description', 'Profiles with non-existent parent references',
            'ids', array_agg(p.id),
            'names', array_agg(p.name)
        ) as details,
        CASE 
            WHEN COUNT(*) = 0 THEN 'info'
            ELSE 'error'
        END as severity,
        COUNT(*)::INT as affected_count
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND p.father_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM profiles p2 
        WHERE p2.id = p.father_id 
        AND p2.deleted_at IS NULL
    );
    
    -- Check 2: Generation consistency
    RETURN QUERY
    SELECT 
        'Generation Inconsistency' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END as status,
        jsonb_build_object(
            'description', 'Children with generation <= parent generation',
            'violations', array_agg(
                jsonb_build_object(
                    'child_id', c.id,
                    'child_name', c.name,
                    'child_gen', c.generation,
                    'parent_name', p.name,
                    'parent_gen', p.generation
                )
            )
        ) as details,
        CASE 
            WHEN COUNT(*) = 0 THEN 'info'
            ELSE 'error'
        END as severity,
        COUNT(*)::INT as affected_count
    FROM profiles c
    INNER JOIN profiles p ON c.father_id = p.id
    WHERE c.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND c.generation <= p.generation;
    
    -- Check 3: HID uniqueness
    RETURN QUERY
    SELECT 
        'Duplicate HIDs' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END as status,
        jsonb_build_object(
            'description', 'Multiple profiles sharing the same HID',
            'duplicates', array_agg(
                jsonb_build_object(
                    'hid', hid,
                    'count', cnt,
                    'ids', ids
                )
            )
        ) as details,
        CASE 
            WHEN COUNT(*) = 0 THEN 'info'
            ELSE 'critical'
        END as severity,
        COUNT(*)::INT as affected_count
    FROM (
        SELECT hid, COUNT(*) as cnt, array_agg(id) as ids
        FROM profiles
        WHERE deleted_at IS NULL
        GROUP BY hid
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Check 4: Missing layout positions
    RETURN QUERY
    SELECT 
        'Missing Layout Positions' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'WARN'
        END as status,
        jsonb_build_object(
            'description', 'Profiles without calculated layout positions',
            'count', COUNT(*),
            'sample_ids', (array_agg(id))[1:10]
        ) as details,
        CASE 
            WHEN COUNT(*) = 0 THEN 'info'
            ELSE 'warning'
        END as severity,
        COUNT(*)::INT as affected_count
    FROM profiles
    WHERE deleted_at IS NULL
    AND layout_position IS NULL;
    
    -- Check 5: Invalid date formats
    RETURN QUERY
    SELECT 
        'Invalid Date Formats' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'WARN'
        END as status,
        jsonb_build_object(
            'description', 'Profiles with invalid date data structures',
            'invalid_dob', array_agg(id) FILTER (WHERE NOT validate_date_jsonb(dob_data)),
            'invalid_dod', array_agg(id) FILTER (WHERE NOT validate_date_jsonb(dod_data))
        ) as details,
        'warning' as severity,
        COUNT(*)::INT as affected_count
    FROM profiles
    WHERE deleted_at IS NULL
    AND (
        (dob_data IS NOT NULL AND NOT validate_date_jsonb(dob_data))
        OR (dod_data IS NOT NULL AND NOT validate_date_jsonb(dod_data))
    );
    
    -- Check 6: Circular relationships
    RETURN QUERY
    WITH RECURSIVE circular_check AS (
        SELECT 
            p1.id as start_id,
            p1.id as current_id,
            p1.father_id as next_id,
            ARRAY[p1.id] as path,
            1 as depth
        FROM profiles p1
        WHERE p1.deleted_at IS NULL AND p1.father_id IS NOT NULL
        
        UNION ALL
        
        SELECT 
            cc.start_id,
            cc.next_id as current_id,
            p2.father_id as next_id,
            cc.path || cc.next_id,
            cc.depth + 1
        FROM circular_check cc
        INNER JOIN profiles p2 ON p2.id = cc.next_id
        WHERE p2.deleted_at IS NULL 
        AND p2.father_id IS NOT NULL
        AND cc.depth < 20
        AND NOT (cc.next_id = ANY(cc.path[1:array_length(cc.path, 1)-1]))
    )
    SELECT 
        'Circular Relationships' as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END as status,
        jsonb_build_object(
            'description', 'Circular parent-child relationships detected',
            'cycles', array_agg(
                jsonb_build_object('path', path)
            )
        ) as details,
        'critical' as severity,
        COUNT(*)::INT as affected_count
    FROM circular_check
    WHERE start_id = next_id;
    
    -- Check 7: Data integrity summary
    RETURN QUERY
    SELECT 
        'Overall Health' as check_name,
        'INFO' as status,
        jsonb_build_object(
            'total_profiles', COUNT(*),
            'with_photos', COUNT(*) FILTER (WHERE photo_url IS NOT NULL),
            'with_bio', COUNT(*) FILTER (WHERE bio IS NOT NULL),
            'with_dates', COUNT(*) FILTER (WHERE dob_data IS NOT NULL),
            'last_update', MAX(updated_at)
        ) as details,
        'info' as severity,
        0 as affected_count
    FROM profiles
    WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fix common issues automatically
CREATE OR REPLACE FUNCTION admin_auto_fix_issues()
RETURNS JSONB AS $$
DECLARE
    fixes_applied JSONB := '[]'::jsonb;
    fix_count INT;
BEGIN
    -- Check super admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Only super admins can run auto-fix';
    END IF;
    
    -- Fix 1: Update missing descendants count
    PERFORM update_descendants_count(NULL);
    GET DIAGNOSTICS fix_count = ROW_COUNT;
    fixes_applied := fixes_applied || jsonb_build_object(
        'fix', 'Updated descendants count',
        'affected', fix_count
    );
    
    -- Fix 2: Regenerate missing HIDs
    WITH missing_hids AS (
        SELECT 
            p.id,
            COALESCE(parent.hid || '.', '') || 
            ROW_NUMBER() OVER (PARTITION BY p.father_id ORDER BY p.sibling_order, p.id) as new_hid
        FROM profiles p
        LEFT JOIN profiles parent ON p.father_id = parent.id
        WHERE p.hid IS NULL AND p.deleted_at IS NULL
    )
    UPDATE profiles p
    SET hid = m.new_hid
    FROM missing_hids m
    WHERE p.id = m.id;
    
    GET DIAGNOSTICS fix_count = ROW_COUNT;
    fixes_applied := fixes_applied || jsonb_build_object(
        'fix', 'Generated missing HIDs',
        'affected', fix_count
    );
    
    -- Fix 3: Queue layout recalculation for nodes without positions
    INSERT INTO layout_recalc_queue (node_id, queued_at, status)
    SELECT id, NOW(), 'pending'
    FROM profiles
    WHERE layout_position IS NULL AND deleted_at IS NULL
    ON CONFLICT (node_id) DO NOTHING;
    
    GET DIAGNOSTICS fix_count = ROW_COUNT;
    fixes_applied := fixes_applied || jsonb_build_object(
        'fix', 'Queued layout recalculation',
        'affected', fix_count
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'fixes_applied', fixes_applied,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    execution_time_ms INT NOT NULL,
    input_size INT,
    output_size INT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX idx_performance_metrics_function ON performance_metrics(function_name, created_at DESC);
CREATE INDEX idx_performance_metrics_time ON performance_metrics(execution_time_ms DESC);

-- Function to log performance metrics
CREATE OR REPLACE FUNCTION log_performance_metric(
    p_function_name TEXT,
    p_start_time TIMESTAMPTZ,
    p_input_size INT DEFAULT NULL,
    p_output_size INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO performance_metrics (
        function_name,
        execution_time_ms,
        input_size,
        output_size,
        user_id
    ) VALUES (
        p_function_name,
        EXTRACT(MILLISECONDS FROM (CLOCK_TIMESTAMP() - p_start_time))::INT,
        p_input_size,
        p_output_size,
        auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_validation_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION admin_auto_fix_issues TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_update_layouts TO service_role;