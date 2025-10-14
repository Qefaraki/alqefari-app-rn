-- Consolidated Baseline Migration
-- Generated: 2025-09-27T12:14:48.705Z
-- This file consolidates all migrations up to September 2024

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hid TEXT,
    name TEXT NOT NULL,
    father_id UUID REFERENCES profiles(id),
    mother_id UUID REFERENCES profiles(id),
    generation INT DEFAULT 1,
    sibling_order INT DEFAULT 1,
    gender TEXT CHECK (gender IN ('male', 'female')),
    photo_url TEXT,
    status TEXT DEFAULT 'living' CHECK (status IN ('living', 'deceased')),
    current_residence TEXT,
    occupation TEXT,
    layout_position JSONB,
    dob_data JSONB,
    dod_data JSONB,
    bio TEXT,
    birth_place TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    social_media_links JSONB,
    achievements JSONB,
    timeline JSONB,
    kunya TEXT,
    nickname TEXT,
    profile_visibility TEXT DEFAULT 'public',
    dob_is_public BOOLEAN DEFAULT false,
    birth_date TEXT,
    death_date TEXT,
    biography TEXT,
    role TEXT CHECK (role IN ('admin', 'user')),
    family_origin TEXT,
    user_id UUID REFERENCES auth.users(id),
    auth_user_id UUID REFERENCES auth.users(id),
    claim_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    search_vector tsvector,
    CONSTRAINT unique_active_hid UNIQUE NULLS NOT DISTINCT (hid, deleted_at)
);

-- Profiles Indexes
CREATE INDEX idx_profiles_father_id ON profiles(father_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_mother_id ON profiles(mother_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_generation ON profiles(generation) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_hid ON profiles(hid) WHERE hid IS NOT NULL;
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX idx_profiles_search_vector ON profiles USING gin(search_vector);
CREATE INDEX idx_profiles_user_id ON profiles(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_munasib ON profiles(id) WHERE hid IS NULL;
CREATE INDEX idx_profiles_family_origin ON profiles(family_origin) WHERE hid IS NULL;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "profiles_select_active" ON profiles
    FOR SELECT
    TO anon, authenticated
    USING (deleted_at IS NULL);

-- ============================================================================
-- MARRIAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS marriages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    husband_id UUID REFERENCES profiles(id) NOT NULL,
    wife_id UUID REFERENCES profiles(id) NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'married' CHECK (status IN ('married', 'divorced', 'widowed')),
    munasib TEXT,
    marriage_order INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id)
);

-- Marriages Indexes
CREATE INDEX idx_marriages_husband_id ON marriages(husband_id);
CREATE INDEX idx_marriages_wife_id ON marriages(wife_id);
CREATE INDEX idx_marriages_deleted_at ON marriages(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE marriages ENABLE ROW LEVEL SECURITY;

-- RLS Policy (Read-only for all)
CREATE POLICY "marriages_select_all"
    ON marriages
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- ============================================================================
-- AUDIT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    version_number INT,
    reverted_at TIMESTAMPTZ,
    reverted_by UUID REFERENCES auth.users(id),
    action_type TEXT,
    action_category TEXT,
    description TEXT,
    severity TEXT,
    metadata JSONB
);

-- Audit Indexes
CREATE INDEX idx_audit_log_enhanced_table_record ON audit_log_enhanced(table_name, record_id);
CREATE INDEX idx_audit_log_enhanced_actor ON audit_log_enhanced(actor_id);
CREATE INDEX idx_audit_log_enhanced_created ON audit_log_enhanced(created_at DESC);

-- ============================================================================
-- ADMIN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    profile_id UUID REFERENCES profiles(id),
    role TEXT DEFAULT 'admin',
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_admins_user_id ON admins(user_id);

-- ============================================================================
-- PROFILE LINK REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    profile_id UUID REFERENCES profiles(id) NOT NULL,
    phone TEXT NOT NULL,
    verification_method TEXT DEFAULT 'phone',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    withdrawn_at TIMESTAMPTZ,
    can_resubmit BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_profile_link_requests_user ON profile_link_requests(user_id);
CREATE INDEX idx_profile_link_requests_status ON profile_link_requests(status);

-- ============================================================================
-- ADMIN MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name_chain TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'no_profile_found',
    status TEXT DEFAULT 'unread',
    admin_notes TEXT,
    profile_id UUID REFERENCES profiles(id),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_messages_status ON admin_messages(status) WHERE status = 'unread';
CREATE INDEX idx_admin_messages_user ON admin_messages(user_id);

-- Enable RLS
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CORE FUNCTIONS
-- ============================================================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    SET search_path = public;
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get branch data function
CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    status TEXT,
    current_residence TEXT,
    occupation TEXT,
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,
    dob_data JSONB,
    dod_data JSONB,
    bio TEXT,
    birth_place TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    social_media_links JSONB,
    achievements JSONB,
    timeline JSONB,
    kunya TEXT,
    nickname TEXT,
    profile_visibility TEXT,
    dob_is_public BOOLEAN,
    birth_date TEXT,
    death_date TEXT,
    biography TEXT,
    role TEXT
) AS $$
DECLARE
    root_depth INT;
BEGIN
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;

    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    IF p_hid IS NULL THEN
        root_depth := 1;
    ELSE
        SELECT p.generation INTO root_depth
        FROM profiles p
        WHERE p.hid = p_hid;

        IF root_depth IS NULL THEN
            RAISE EXCEPTION 'Profile with hid % not found', p_hid;
        END IF;
    END IF;

    RETURN QUERY
    WITH RECURSIVE descendant_tree AS (
        SELECT
            p.*,
            0 as relative_depth,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE (p_hid IS NULL AND p.generation = 1)
           OR (p_hid IS NOT NULL AND p.hid = p_hid)

        UNION ALL

        SELECT
            p.*,
            dt.relative_depth + 1,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        INNER JOIN descendant_tree dt ON (p.father_id = dt.id OR p.mother_id = dt.id)
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE dt.relative_depth < p_max_depth - 1
    ),
    descendants_summary AS (
        SELECT
            dt.id,
            COUNT(DISTINCT p.id) as total_descendants
        FROM descendant_tree dt
        LEFT JOIN profiles p ON (p.father_id = dt.id OR p.mother_id = dt.id)
        GROUP BY dt.id
    )
    SELECT
        dt.id, dt.hid, dt.name, dt.father_id, dt.mother_id,
        dt.generation, dt.sibling_order, dt.gender, dt.photo_url,
        dt.status, dt.current_residence, dt.occupation,
        dt.layout_position,
        COALESCE(ds.total_descendants, 0)::INT as descendants_count,
        CASE
            WHEN dt.relative_depth >= p_max_depth - 1 AND dt.child_count > 0 THEN true
            ELSE false
        END as has_more_descendants,
        dt.dob_data, dt.dod_data, dt.bio, dt.birth_place,
        dt.education, dt.phone, dt.email, dt.social_media_links,
        dt.achievements, dt.timeline, dt.kunya, dt.nickname,
        dt.profile_visibility, dt.dob_is_public,
        dt.birth_date, dt.death_date, dt.biography, dt.role
    FROM descendant_tree dt
    LEFT JOIN descendants_summary ds ON ds.id = dt.id
    ORDER BY dt.generation, dt.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update search vector on profile changes
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('arabic', COALESCE(NEW.name, '') || ' ' ||
                                                COALESCE(NEW.nickname, '') || ' ' ||
                                                COALESCE(NEW.kunya, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_marriages_updated_at
    BEFORE UPDATE ON marriages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add migration marker
COMMENT ON SCHEMA public IS 'Consolidated baseline migration - includes all migrations up to September 2024';
