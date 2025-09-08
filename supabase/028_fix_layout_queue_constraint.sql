-- 028_fix_layout_queue_constraint.sql
-- Fix the missing unique constraint on layout_recalc_queue that's causing ON CONFLICT errors

-- Add unique constraint on node_id to allow ON CONFLICT to work
ALTER TABLE layout_recalc_queue 
ADD CONSTRAINT layout_recalc_queue_node_id_key UNIQUE (node_id);

-- Also add an index for performance (if not already covered by the unique constraint)
CREATE INDEX IF NOT EXISTS idx_layout_recalc_queue_node_id ON layout_recalc_queue(node_id);

-- Update the trigger_layout_recalc_async function to handle this properly
CREATE OR REPLACE FUNCTION trigger_layout_recalc_async(affected_node_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Queue the recalculation job
    INSERT INTO layout_recalc_queue (node_id, queued_at, status)
    VALUES (affected_node_id, NOW(), 'pending')
    ON CONFLICT (node_id) 
    DO UPDATE SET 
        queued_at = NOW(), 
        status = 'pending',
        retry_count = 0;
    
    result := jsonb_build_object(
        'status', 'queued',
        'node_id', affected_node_id,
        'queued_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_layout_recalc_async TO authenticated;

-- Add comment
COMMENT ON CONSTRAINT layout_recalc_queue_node_id_key ON layout_recalc_queue IS 
    'Ensures only one queue entry per node to prevent duplicate processing';