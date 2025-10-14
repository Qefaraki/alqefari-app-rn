-- Create marriages table (The Relationship Layer)
CREATE TABLE marriages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    husband_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    wife_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    munasib TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'married' CHECK (status IN ('married', 'divorced', 'widowed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_marriages_husband_id ON marriages(husband_id);
CREATE INDEX idx_marriages_wife_id ON marriages(wife_id);

-- Prevent duplicate active marriages
CREATE UNIQUE INDEX idx_unique_active_marriage ON marriages(husband_id, wife_id) 
WHERE status = 'married';