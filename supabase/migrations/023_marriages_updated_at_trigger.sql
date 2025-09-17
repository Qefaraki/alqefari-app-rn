-- Create or replace the generic update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_marriages_updated_at ON marriages;

-- Create trigger to automatically update updated_at on marriages table
CREATE TRIGGER update_marriages_updated_at
    BEFORE UPDATE ON marriages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TRIGGER update_marriages_updated_at ON marriages IS 
    'Automatically updates the updated_at timestamp when a marriage record is modified';