-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (The Heart of the System)
CREATE TABLE profiles (
    -- Core Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hid TEXT UNIQUE,
    
    -- Family Structure & Ordering
    father_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    mother_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    generation INT NOT NULL,
    sibling_order INT NOT NULL DEFAULT 0,
    
    -- Personal Identity (The Atomic Unit)
    name TEXT NOT NULL,
    kunya TEXT,
    nickname TEXT,
    
    -- Biographical Data
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'deceased')),
    dob_data JSONB,
    dod_data JSONB,
    bio TEXT,
    
    -- Additional Fields from Current Data
    birth_date TEXT,
    death_date TEXT,
    birth_place TEXT,
    current_residence TEXT,
    occupation TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    photo_url TEXT,
    
    -- Social Media
    social_media_links JSONB,
    twitter TEXT,
    instagram TEXT,
    linkedin TEXT,
    website TEXT,
    
    -- Complex Data
    spouse_count INT,
    spouse_names TEXT[],
    achievements TEXT[],
    timeline JSONB,
    
    -- Privacy & Permissions
    dob_is_public BOOLEAN DEFAULT FALSE,
    
    -- Data Integrity & Housekeeping
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Search & Performance
    search_vector tsvector,
    layout_position JSONB
);

-- Add indexes for performance
CREATE INDEX idx_profiles_father_id ON profiles(father_id);
CREATE INDEX idx_profiles_generation ON profiles(generation);
CREATE INDEX idx_profiles_hid ON profiles(hid);
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX idx_profiles_search_vector ON profiles USING gin(search_vector);

-- Add comments
COMMENT ON TABLE profiles IS 'Core table storing individual family members';
COMMENT ON COLUMN profiles.name IS 'CRITICAL: Only stores the person''s own single name';
COMMENT ON COLUMN profiles.sibling_order IS 'Index (0, 1, 2...) to manually order siblings under a parent';
COMMENT ON COLUMN profiles.version IS 'For optimistic locking to prevent edit conflicts';
COMMENT ON COLUMN profiles.deleted_at IS 'For soft deletes. Non-null means profile is hidden';