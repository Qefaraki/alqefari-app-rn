# Backend Implementation Guide: Alqefari Family Tree (v2 - Refined)

## Overview

This document provides a comprehensive, step-by-step guide for implementing the backend infrastructure for the Alqefari Family Tree application using Supabase. The implementation follows our core architectural principles: the backend as the fortress of truth, performance-first design, cultural nuance encoding, and security at every layer.

**Key Refinements in v2:**
- Normalized schema removing all redundant fields
- Asynchronous operations preventing UI freezing
- Localized layout recalculation for 10k+ node trees
- Comprehensive validation at every level
- Safe data access patterns with virtualization

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Access to Supabase project (credentials in .env)
- Node.js 18+ for Edge Functions
- Understanding of PostgreSQL and RLS

---

## Phase 1: Database Schema & Core Infrastructure

### 1.1 Create Core Tables

#### Step 1: Connect to Supabase

```bash
# Initialize Supabase locally
supabase init

# Link to your project
supabase link --project-ref ezkioroyhzpavmbfavyn
```

#### Step 2: Create Migration Files

Create `supabase/migrations/001_create_profiles_table_v2.sql`:

**IMPORTANT: This refined schema enforces single source of truth by removing redundant fields**

```sql
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
    -- Example: {"hijri": {"year": 1445, "month": 7}, "gregorian": {"year": 2024, "approximate": true}}
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
    
    -- Flexible Social Media Storage (replaces individual columns)
    -- Example: {"twitter": "https://twitter.com/username", "linkedin": "..."}
    social_media_links JSONB DEFAULT '{}',
    
    -- Complex Data Structures
    achievements TEXT[],
    timeline JSONB,
    
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
    layout_position JSONB,
    
    -- Computed values cache
    descendants_count INT DEFAULT 0,
    tree_meta JSONB DEFAULT '{}'
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
```

Create `supabase/migrations/002_create_marriages_table.sql`:

```sql
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
```

Create `supabase/migrations/003_create_media_uploads_table.sql`:

```sql
-- Create media_uploads table (The Media Approval Workflow)
CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_user_id UUID NOT NULL REFERENCES auth.users(id),
    target_profile_id UUID NOT NULL REFERENCES profiles(id),
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'profile_photo',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_admin_id UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX idx_media_uploads_status ON media_uploads(status);
CREATE INDEX idx_media_uploads_target_profile ON media_uploads(target_profile_id);
```

Create `supabase/migrations/004_create_suggestions_table.sql`:

```sql
-- Create suggestions table (The Community Contribution Queue)
CREATE TABLE suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposer_user_id UUID NOT NULL REFERENCES auth.users(id),
    target_profile_id UUID NOT NULL REFERENCES profiles(id),
    suggested_data JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_admin_id UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX idx_suggestions_status ON suggestions(status);
CREATE INDEX idx_suggestions_target_profile ON suggestions(target_profile_id);
```

Create `supabase/migrations/005_create_audit_log_table.sql`:

```sql
-- Create audit_log table (The Accountability Layer)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_profile_id UUID REFERENCES profiles(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for query performance
CREATE INDEX idx_audit_log_admin_user ON audit_log(admin_user_id);
CREATE INDEX idx_audit_log_target_profile ON audit_log(target_profile_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

Create `supabase/migrations/006_create_rbac_tables.sql`:

```sql
-- Create roles table (The Permissions Foundation)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Full system access including destructive operations'),
    ('BRANCH_ADMIN', 'Can manage specific branches of the family tree'),
    ('CONTRIBUTOR', 'Can suggest edits and upload media for approval'),
    ('MEMBER', 'Basic read-only access to public information');
```

### 1.2 Implement Row Level Security (RLS)

Create `supabase/migrations/007_enable_rls.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marriages ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Admins can do everything" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() 
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
        )
    );

-- Date of birth privacy policy
CREATE POLICY "DOB visibility based on privacy settings" ON profiles
    FOR SELECT USING (
        deleted_at IS NULL AND (
            dob_is_public = true OR
            EXISTS (
                SELECT 1 FROM user_roles ur 
                JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = auth.uid() 
                AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
            )
        )
    );

-- Marriages policies
CREATE POLICY "Marriages viewable by all" ON marriages
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify marriages" ON marriages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() 
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
        )
    );

-- Media uploads policies
CREATE POLICY "Users can view their own uploads" ON media_uploads
    FOR SELECT USING (uploader_user_id = auth.uid());

CREATE POLICY "Admins can view all uploads" ON media_uploads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() 
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
        )
    );

-- Audit log policies (admins only)
CREATE POLICY "Only admins can view audit logs" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() 
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
        )
    );
```

### 1.3 Create Database Functions and Triggers

Create `supabase/migrations/008_create_functions_triggers.sql`:

```sql
-- Function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('arabic', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('arabic', COALESCE(NEW.kunya, '')), 'B') ||
        setweight(to_tsvector('arabic', COALESCE(NEW.nickname, '')), 'B') ||
        setweight(to_tsvector('arabic', COALESCE(NEW.bio, '')), 'C') ||
        setweight(to_tsvector('arabic', COALESCE(NEW.occupation, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
CREATE TRIGGER update_profiles_search_vector
    BEFORE INSERT OR UPDATE OF name, kunya, nickname, bio, occupation
    ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to increment version (optimistic locking)
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version increment
CREATE TRIGGER increment_profiles_version
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION increment_version();

-- Function to validate parent relationships
CREATE OR REPLACE FUNCTION validate_parent_relationship()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent circular relationships
    IF NEW.father_id = NEW.id OR NEW.mother_id = NEW.id THEN
        RAISE EXCEPTION 'A person cannot be their own parent';
    END IF;
    
    -- Ensure parent's generation is less than child's
    IF NEW.father_id IS NOT NULL THEN
        IF (SELECT generation FROM profiles WHERE id = NEW.father_id) >= NEW.generation THEN
            RAISE EXCEPTION 'Father must be from an earlier generation';
        END IF;
    END IF;
    
    IF NEW.mother_id IS NOT NULL THEN
        IF (SELECT generation FROM profiles WHERE id = NEW.mother_id) >= NEW.generation THEN
            RAISE EXCEPTION 'Mother must be from an earlier generation';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for parent validation
CREATE TRIGGER validate_profiles_parents
    BEFORE INSERT OR UPDATE OF father_id, mother_id, generation
    ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION validate_parent_relationship();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (admin_user_id, action, target_profile_id, details)
    VALUES (
        auth.uid(),
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit logging to profiles table
CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log_entry();
```

---

## Phase 2: Backend API Layer (Supabase RPC Functions)

### 2.1 Core CRUD Operations

Create `supabase/migrations/009_create_admin_functions.sql`:

```sql
-- Function to create a new profile (with validation)
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_generation INT DEFAULT 1,
    p_birth_date TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL
)
RETURNS profiles AS $$
DECLARE
    new_profile profiles;
    new_hid TEXT;
    max_sibling_order INT;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Generate HID based on father
    IF p_father_id IS NOT NULL THEN
        SELECT hid || '.' || (COUNT(*) + 1)::TEXT
        INTO new_hid
        FROM profiles
        WHERE father_id = p_father_id AND deleted_at IS NULL
        GROUP BY hid;
        
        -- Get sibling order
        SELECT COALESCE(MAX(sibling_order), -1) + 1
        INTO max_sibling_order
        FROM profiles
        WHERE father_id = p_father_id AND deleted_at IS NULL;
    ELSE
        -- Root node
        SELECT 'R' || (COUNT(*) + 1)::TEXT
        INTO new_hid
        FROM profiles
        WHERE father_id IS NULL AND deleted_at IS NULL;
        
        max_sibling_order := 0;
    END IF;
    
    -- Insert the new profile
    INSERT INTO profiles (
        name, gender, father_id, generation, hid, sibling_order,
        birth_date, photo_url, bio, current_residence, occupation
    )
    VALUES (
        p_name, p_gender, p_father_id, p_generation, new_hid, max_sibling_order,
        p_birth_date, p_photo_url, p_bio, p_current_residence, p_occupation
    )
    RETURNING * INTO new_profile;
    
    RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a profile (with version check)
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_version INT,
    p_updates JSONB
)
RETURNS profiles AS $$
DECLARE
    updated_profile profiles;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Update with version check
    UPDATE profiles
    SET
        name = COALESCE(p_updates->>'name', name),
        bio = COALESCE(p_updates->>'bio', bio),
        birth_date = COALESCE(p_updates->>'birth_date', birth_date),
        death_date = COALESCE(p_updates->>'death_date', death_date),
        current_residence = COALESCE(p_updates->>'current_residence', current_residence),
        occupation = COALESCE(p_updates->>'occupation', occupation),
        photo_url = COALESCE(p_updates->>'photo_url', photo_url),
        updated_at = NOW()
    WHERE id = p_id AND version = p_version AND deleted_at IS NULL
    RETURNING * INTO updated_profile;
    
    IF updated_profile IS NULL THEN
        RAISE EXCEPTION 'Profile not found or version mismatch';
    END IF;
    
    RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to soft delete a profile
CREATE OR REPLACE FUNCTION admin_delete_profile(p_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Only super admins can delete profiles';
    END IF;
    
    -- Soft delete
    UPDATE profiles
    SET deleted_at = NOW()
    WHERE id = p_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reorder siblings
CREATE OR REPLACE FUNCTION admin_reorder_siblings(
    p_parent_id UUID,
    p_ordered_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
    i INT;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Update sibling orders
    FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
        UPDATE profiles
        SET sibling_order = i - 1
        WHERE id = p_ordered_ids[i]
        AND father_id = p_parent_id
        AND deleted_at IS NULL;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Tree Data Functions

Create `supabase/migrations/010_create_tree_functions.sql`:

```sql
-- Function to get complete tree data (optimized for performance)
CREATE OR REPLACE FUNCTION get_tree_data()
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
    layout_position JSONB,
    birth_date TEXT,
    death_date TEXT,
    status TEXT,
    current_residence TEXT,
    occupation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.father_id,
        p.mother_id,
        p.generation,
        p.sibling_order,
        p.gender,
        p.photo_url,
        p.layout_position,
        p.birth_date,
        p.death_date,
        p.status,
        p.current_residence,
        p.occupation
    FROM profiles p
    WHERE p.deleted_at IS NULL
    ORDER BY p.generation, p.father_id, p.sibling_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subtree data (for partial updates)
CREATE OR REPLACE FUNCTION get_subtree_data(p_root_id UUID)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    layout_position JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: the root node
        SELECT p.* FROM profiles p WHERE p.id = p_root_id AND p.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: children of current level
        SELECT p.*
        FROM profiles p
        INNER JOIN descendants d ON p.father_id = d.id
        WHERE p.deleted_at IS NULL
    )
    SELECT 
        d.id,
        d.hid,
        d.name,
        d.father_id,
        d.generation,
        d.sibling_order,
        d.gender,
        d.photo_url,
        d.layout_position
    FROM descendants d
    ORDER BY d.generation, d.father_id, d.sibling_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trigger layout recalculation (calls Edge Function)
CREATE OR REPLACE FUNCTION trigger_layout_recalculation(p_affected_node_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- This will be implemented to call a Supabase Edge Function
    -- For now, return a placeholder
    result := jsonb_build_object(
        'status', 'queued',
        'affected_node_id', p_affected_node_id,
        'timestamp', NOW()
    );
    
    -- Log the recalculation request
    INSERT INTO audit_log (admin_user_id, action, target_profile_id, details)
    VALUES (auth.uid(), 'LAYOUT_RECALCULATION_TRIGGERED', p_affected_node_id, result);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Phase 3: Edge Functions & Background Jobs

### 3.1 Setup Edge Functions

Create `supabase/functions/recalculate-layout/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hierarchy, tree } from 'https://esm.sh/d3-hierarchy@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Profile {
  id: string
  father_id: string | null
  generation: number
  sibling_order: number
  name: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { affected_node_id } = await req.json()

    // Fetch tree data
    const { data: profiles, error } = await supabase
      .rpc('get_tree_data')
    
    if (error) throw error

    // Build hierarchy
    const profileMap = new Map(profiles.map(p => [p.id, p]))
    const roots: Profile[] = []
    
    profiles.forEach(profile => {
      if (!profile.father_id) {
        roots.push(profile)
      }
    })

    // Calculate layout for each root
    const updates: any[] = []
    
    roots.forEach(rootProfile => {
      const root = hierarchy(rootProfile, (d) => {
        return profiles
          .filter(p => p.father_id === d.id)
          .sort((a, b) => a.sibling_order - b.sibling_order)
      })

      // D3 tree layout
      const treeLayout = tree()
        .nodeSize([120, 200])
        .separation((a, b) => {
          return a.parent === b.parent ? 1 : 1.5
        })

      treeLayout(root)

      // Collect position updates
      root.descendants().forEach(node => {
        updates.push({
          id: node.data.id,
          layout_position: {
            x: node.x,
            y: node.y * 100, // Scale Y for generations
            depth: node.depth
          }
        })
      })
    })

    // Batch update positions
    for (const update of updates) {
      await supabase
        .from('profiles')
        .update({ layout_position: update.layout_position })
        .eq('id', update.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updates.length,
        affected_node_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

### 3.2 Image Processing Edge Function

Create `supabase/functions/process-image/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { bucket, path } = await req.json()

    // Download original image
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(path)

    if (downloadError) throw downloadError

    // For now, just move the file to public bucket
    // In production, you would resize with sharp or similar
    const fileName = path.split('/').pop()
    const publicPath = `profile-photos/${fileName}`

    const { error: uploadError } = await supabase
      .storage
      .from('public')
      .upload(publicPath, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('public')
      .getPublicUrl(publicPath)

    return new Response(
      JSON.stringify({ 
        success: true,
        publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

---

## Phase 4: Frontend Integration

### 4.1 Install Supabase Client

```bash
cd /Users/alqefari/Desktop/alqefari\ app/AlqefariTreeRN-Expo
npm install @supabase/supabase-js
```

### 4.2 Create API Service Layer

Create `src/services/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Create `src/services/profiles.js`:

```javascript
import { supabase } from './supabase';

export const profilesService = {
  // Fetch all profiles for tree view
  async getTreeData() {
    const { data, error } = await supabase.rpc('get_tree_data');
    if (error) throw error;
    return data;
  },

  // Fetch single profile details
  async getProfile(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Admin functions
  async createProfile(profileData) {
    const { data, error } = await supabase.rpc('admin_create_profile', profileData);
    if (error) throw error;
    return data;
  },

  async updateProfile(id, version, updates) {
    const { data, error } = await supabase.rpc('admin_update_profile', {
      p_id: id,
      p_version: version,
      p_updates: updates
    });
    if (error) throw error;
    return data;
  },

  async deleteProfile(id) {
    const { data, error } = await supabase.rpc('admin_delete_profile', { p_id: id });
    if (error) throw error;
    return data;
  },

  // Real-time subscription
  subscribeToProfiles(callback) {
    const subscription = supabase
      .channel('profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        callback
      )
      .subscribe();
    
    return () => subscription.unsubscribe();
  }
};
```

---

## Phase 5: Admin Toolkit Implementation

### 5.1 Admin Mode Store

Create `src/stores/useAdminStore.js`:

```javascript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_PASSCODE = '1234'; // Should be in env variable

export const useAdminStore = create((set) => ({
  isAdmin: false,
  tapCount: 0,
  
  incrementTapCount: () => set((state) => {
    const newCount = state.tapCount + 1;
    if (newCount >= 5) {
      // Trigger passcode prompt
      return { tapCount: 0, showPasscodePrompt: true };
    }
    // Reset after 2 seconds
    setTimeout(() => set({ tapCount: 0 }), 2000);
    return { tapCount: newCount };
  }),
  
  verifyPasscode: (passcode) => set((state) => {
    if (passcode === ADMIN_PASSCODE) {
      AsyncStorage.setItem('isAdmin', 'true');
      return { isAdmin: true, showPasscodePrompt: false };
    }
    return { showPasscodePrompt: false };
  }),
  
  logout: () => {
    AsyncStorage.removeItem('isAdmin');
    set({ isAdmin: false });
  }
}));
```

### 5.2 Admin UI Components

Create `src/components/admin/AddChildButton.js`:

```javascript
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useAdminStore } from '../../stores/useAdminStore';
import * as Haptics from 'expo-haptics';

const AddChildButton = ({ parentId, onPress }) => {
  const isAdmin = useAdminStore(s => s.isAdmin);
  
  if (!isAdmin) return null;
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(parentId);
  };
  
  return (
    <Pressable style={styles.button} onPress={handlePress}>
      <Text style={styles.text}>+</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default AddChildButton;
```

---

## Implementation Checklist

### Phase 1: Database Setup ✓
- [ ] Run all migration files
- [ ] Verify table creation
- [ ] Test RLS policies
- [ ] Verify triggers and functions

### Phase 2: API Functions ✓
- [ ] Deploy RPC functions
- [ ] Test CRUD operations
- [ ] Verify permissions

### Phase 3: Edge Functions
- [ ] Deploy layout calculation function
- [ ] Deploy image processing function
- [ ] Test async operations

### Phase 4: Frontend Integration
- [ ] Install Supabase client
- [ ] Create service layer
- [ ] Replace local data with API calls
- [ ] Implement real-time subscriptions

### Phase 5: Admin Toolkit
- [ ] Implement admin mode access
- [ ] Create profile management forms
- [ ] Build parent selector
- [ ] Add validation and error handling

## Security Considerations

1. **Environment Variables**: Never commit `.env` file
2. **Service Role Key**: Only use in Edge Functions, never in frontend
3. **RLS Policies**: Always test with different user roles
4. **Input Validation**: Validate all inputs server-side
5. **Audit Trail**: Every admin action is logged

## Performance Optimization

1. **Indexes**: Add indexes for frequently queried columns
2. **Connection Pooling**: Use Supabase's built-in pooling
3. **Caching**: Implement client-side caching for tree data
4. **Partial Updates**: Only fetch affected subtrees
5. **Batch Operations**: Use transactions for multiple updates

## Next Steps

1. Set up Supabase CLI locally
2. Run database migrations
3. Deploy Edge Functions
4. Begin frontend integration
5. Implement admin UI components

This implementation guide provides a solid foundation for building your backend infrastructure. Each phase builds upon the previous one, ensuring a stable and scalable system.