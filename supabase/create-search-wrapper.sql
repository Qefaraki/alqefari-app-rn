-- Create a simple wrapper function that takes a single search term
-- and converts it to the array format expected by the main search function
CREATE OR REPLACE FUNCTION search_name_chain(
  p_search_term TEXT
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name VARCHAR(255),
  display_name TEXT,
  parent_id UUID,
  generation INT,
  birth_year_hijri INT,
  branch_path TEXT[]
) AS $$
DECLARE
  cleaned_term TEXT;
  search_names TEXT[];
BEGIN
  -- Clean the search term
  cleaned_term := TRIM(p_search_term);
  
  -- Remove leading "بن" if present
  IF cleaned_term LIKE 'بن %' THEN
    cleaned_term := SUBSTRING(cleaned_term FROM 4);
  END IF;
  
  -- Split by spaces to get individual names
  search_names := string_to_array(TRIM(cleaned_term), ' ');
  
  -- Call the main search function with the array
  RETURN QUERY
  SELECT * FROM search_name_chain(search_names, 20, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT) TO anon, authenticated;