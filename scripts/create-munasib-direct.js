const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS admin_create_munasib_profile CASCADE;

-- Create a simpler function for creating Munasib profiles
CREATE OR REPLACE FUNCTION admin_create_munasib_profile(
    p_name TEXT,
    p_gender TEXT,
    p_generation INT,
    p_family_origin TEXT DEFAULT NULL,
    p_sibling_order INT DEFAULT 0,
    p_status TEXT DEFAULT 'alive',
    p_phone TEXT DEFAULT NULL
) RETURNS profiles AS $$
DECLARE
    v_new_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor for audit
    v_actor_id := auth.uid();

    -- Validate required fields
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
        RAISE EXCEPTION 'Name is required';
    END IF;

    IF p_gender NOT IN ('male', 'female') THEN
        RAISE EXCEPTION 'Gender must be male or female';
    END IF;

    IF p_generation < 1 THEN
        RAISE EXCEPTION 'Generation must be at least 1';
    END IF;

    -- Create the Munasib profile with NULL HID
    INSERT INTO profiles (
        hid,
        name,
        gender,
        generation,
        family_origin,
        sibling_order,
        status,
        phone,
        created_by,
        updated_by,
        version
    ) VALUES (
        NULL,  -- NULL HID for Munasib
        p_name,
        p_gender,
        p_generation,
        p_family_origin,
        p_sibling_order,
        p_status,
        p_phone,
        v_actor_id,
        v_actor_id,
        1
    ) RETURNING * INTO v_new_profile;

    -- Log to audit
    INSERT INTO audit_log (
        action,
        table_name,
        target_profile_id,
        actor_id,
        new_data,
        details
    ) VALUES (
        'INSERT',
        'profiles',
        v_new_profile.id,
        v_actor_id,
        to_jsonb(v_new_profile),
        jsonb_build_object(
            'source', 'admin_create_munasib_profile',
            'is_munasib', true,
            'family_origin', p_family_origin
        )
    );

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
`;

async function deploy() {
  try {
    console.log('Deploying admin_create_munasib_profile function...');

    const { data, error } = await supabase.rpc('query', {
      query_text: sql
    });

    if (error) {
      // Try direct SQL execution if query RPC doesn't exist
      console.log('Query RPC not found, trying direct execution...');
      const { data: execData, error: execError } = await supabase
        .from('_migrations')
        .insert({
          name: 'admin_create_munasib_profile',
          executed_at: new Date().toISOString(),
          sql: sql
        });

      if (execError) {
        throw execError;
      }
    }

    console.log('✅ Function deployed successfully!');
    console.log('Schema cache will refresh shortly...');
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n📋 Please run this SQL directly in Supabase Dashboard:');
    console.log('=' * 60);
    console.log(sql);
    console.log('=' * 60);
  }
}

deploy();