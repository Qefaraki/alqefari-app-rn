-- Create reorder_children function as a migration
-- This ensures it's properly registered in Supabase

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.reorder_children(UUID, JSONB);

-- Create the function
CREATE OR REPLACE FUNCTION public.reorder_children(
  p_parent_id UUID,
  p_child_orders JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child JSONB;
  v_updated_count INT := 0;
  v_error_count INT := 0;
BEGIN
  -- Validate input
  IF p_parent_id IS NULL OR p_child_orders IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  END IF;

  -- Loop through each child and update their order
  FOR v_child IN SELECT * FROM jsonb_array_elements(p_child_orders)
  LOOP
    UPDATE profiles
    SET 
      sibling_order = (v_child->>'new_order')::INT,
      updated_at = NOW()
    WHERE 
      id = (v_child->>'id')::UUID
      AND (father_id = p_parent_id OR mother_id = p_parent_id);
  END LOOP;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reorder_children TO anon;
GRANT EXECUTE ON FUNCTION public.reorder_children TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_children TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.reorder_children IS 'Reorders children by updating their sibling_order values';