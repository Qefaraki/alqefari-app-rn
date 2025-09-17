-- Add spouse profile fields to marriages table
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS spouse_date_of_birth DATE,
ADD COLUMN IF NOT EXISTS spouse_date_of_death DATE,
ADD COLUMN IF NOT EXISTS spouse_location TEXT,
ADD COLUMN IF NOT EXISTS spouse_story TEXT,
ADD COLUMN IF NOT EXISTS spouse_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS spouse_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS spouse_photo_url TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marriages_spouse_dates ON marriages(spouse_date_of_birth, spouse_date_of_death);

-- Success message
SELECT 'Spouse profile fields added successfully' as message;