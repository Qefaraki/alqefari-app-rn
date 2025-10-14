-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (The Heart of the System - Refined Version)
-- This schema enforces single source of truth and removes all redundancy
CREATE TABLE profiles (
    -- Core Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hid TEXT UNIQUE NOT NULL,
    
    -- Family Structure & Ordering
    father_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    mother_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    generation INT NOT NULL CHECK (generation > 0),
    sibling_order INT NOT NULL DEFAULT 0 CHECK (sibling_order >= 0),
    
    -- Personal Identity (The Atomic Unit)
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    kunya TEXT,
    nickname TEXT,
    
    -- Biographical Data
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'deceased')),
    
    -- Flexible Date Storage (supports approximate dates, dual calendars)
    -- Example: {"hijri": {"year": 1445, "month": 7, "day": 15}, "gregorian": {"year": 2024, "approximate": true}, "display": "1445هـ"}
    dob_data JSONB,
    dod_data JSONB,
    
    -- Biography and Details
    bio TEXT,
    birth_place TEXT,
    current_residence TEXT,
    occupation TEXT,
    education TEXT,
    
    -- Contact Information
    phone TEXT,
    email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    photo_url TEXT,
    
    -- Flexible Social Media Storage
    -- Example: {"twitter": "https://twitter.com/username", "linkedin": "https://linkedin.com/in/username"}
    social_media_links JSONB DEFAULT '{}',
    
    -- Complex Data Structures
    achievements TEXT[],
    timeline JSONB, -- Array of {"year": "1445", "event": "تخرج من الجامعة"}
    
    -- Privacy & Permissions
    dob_is_public BOOLEAN DEFAULT FALSE,
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'family', 'private')),
    
    -- Data Integrity & Housekeeping
    version INT NOT NULL DEFAULT 1 CHECK (version > 0),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Search & Performance
    search_vector tsvector,
    layout_position JSONB, -- {"x": 100, "y": 200, "depth": 3}
    
    -- Computed values cache (updated by triggers)
    descendants_count INT DEFAULT 0,
    tree_meta JSONB DEFAULT '{}'
);

-- Add indexes for performance
CREATE INDEX idx_profiles_father_id ON profiles(father_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_mother_id ON profiles(mother_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_generation ON profiles(generation) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_hid ON profiles(hid);
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX idx_profiles_search_vector ON profiles USING gin(search_vector);
CREATE INDEX idx_profiles_social_media ON profiles USING gin(social_media_links);
CREATE INDEX idx_profiles_layout_position ON profiles USING gin(layout_position);

-- Ensure HID structure is valid (e.g., "1", "1.1", "1.1.1", "R1", etc.)
ALTER TABLE profiles ADD CONSTRAINT check_hid_format 
  CHECK (hid ~ '^[R]?\d+(\.\d+)*$');

-- Add comments
COMMENT ON TABLE profiles IS 'Core table storing individual family members - enforces single source of truth';
COMMENT ON COLUMN profiles.name IS 'CRITICAL: Only stores the person''s own single name';
COMMENT ON COLUMN profiles.hid IS 'Hierarchical ID following pattern: 1, 1.1, 1.1.1 or R1 for roots';
COMMENT ON COLUMN profiles.sibling_order IS 'Zero-based index for ordering siblings under same parent';
COMMENT ON COLUMN profiles.version IS 'Optimistic locking - incremented on every update';
COMMENT ON COLUMN profiles.deleted_at IS 'Soft delete timestamp - non-null means hidden';
COMMENT ON COLUMN profiles.dob_data IS 'Flexible date storage supporting Hijri/Gregorian and approximate dates';
COMMENT ON COLUMN profiles.social_media_links IS 'JSONB object with platform names as keys and URLs as values';
COMMENT ON COLUMN profiles.descendants_count IS 'Cached count of all descendants - updated by triggers';
COMMENT ON COLUMN profiles.tree_meta IS 'Cached metadata like subtree bounds, max depth, etc.';