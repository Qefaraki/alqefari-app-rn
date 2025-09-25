const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sql = `
-- Drop and recreate the function
DROP FUNCTION IF EXISTS admin_create_munasib_profile CASCADE;

CREATE OR REPLACE FUNCTION admin_create_munasib_profile(
    p_name TEXT,
    p_gender TEXT,
    p_generation INT,
    p_family_origin TEXT,
    p_sibling_order INT,
    p_status TEXT,
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

    v_actor_id := auth.uid();

    -- Create the Munasib profile
    INSERT INTO profiles (
        hid, name, gender, generation, family_origin,
        sibling_order, status, phone, created_by, updated_by
    ) VALUES (
        NULL, p_name, p_gender, p_generation, p_family_origin,
        p_sibling_order, p_status, p_phone, v_actor_id, v_actor_id
    ) RETURNING * INTO v_new_profile;

    -- Audit log
    INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id,
        new_data, details
    ) VALUES (
        'INSERT', 'profiles', v_new_profile.id, v_actor_id,
        to_jsonb(v_new_profile),
        jsonb_build_object('source', 'admin_create_munasib_profile', 'is_munasib', true)
    );

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;
`;

async function executeSQL() {
  console.log('Deploying admin_create_munasib_profile function...\n');

  // Parse the URL
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.split('.')[0];

  // Prepare the request
  const postData = sql;

  const options = {
    hostname: url.hostname,
    path: '/rest/v1/rpc/admin_execute_sql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify({ p_sql: postData })),
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=representation'
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          console.log('✅ Function deployed successfully!');
          console.log('Schema cache will refresh within 60 seconds.');
          resolve();
        } else {
          console.log('Response status:', res.statusCode);
          console.log('Response:', data);

          // If admin_execute_sql doesn't exist, provide manual instructions
          if (res.statusCode === 404) {
            console.log('\n📋 Manual deployment required. Copy this SQL to Supabase Dashboard SQL Editor:\n');
            console.log('=' .repeat(80));
            console.log(sql);
            console.log('=' .repeat(80));
            console.log('\n1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
            console.log('2. Paste the SQL above');
            console.log('3. Click "Run" button');
            console.log('4. Wait 60 seconds for schema cache to refresh');
          }
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });

    req.write(JSON.stringify({ p_sql: postData }));
    req.end();
  });
}

executeSQL().catch(console.error);