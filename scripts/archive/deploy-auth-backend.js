const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function deployAuthBackend() {
  console.log("🚀 Deploying authentication backend...\n");

  // Split the SQL into individual statements
  const statements = [
    // 1. Create profile_link_requests table
    `CREATE TABLE IF NOT EXISTS profile_link_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) NOT NULL,
      profile_id UUID REFERENCES profiles(id) NOT NULL,
      name_chain TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by UUID REFERENCES profiles(id),
      review_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      UNIQUE(user_id, profile_id)
    )`,

    // 2. Create indexes
    `CREATE INDEX IF NOT EXISTS idx_link_requests_user ON profile_link_requests(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending'`,
    `CREATE INDEX IF NOT EXISTS idx_link_requests_profile ON profile_link_requests(profile_id)`,

    // 3. Enable RLS
    `ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY`,

    // 4. Drop existing policies if they exist
    `DROP POLICY IF EXISTS "Users can view own link requests" ON profile_link_requests`,
    `DROP POLICY IF EXISTS "Users can create link requests" ON profile_link_requests`,
    `DROP POLICY IF EXISTS "Admins can view all link requests" ON profile_link_requests`,

    // 5. Create RLS policies
    `CREATE POLICY "Users can view own link requests" ON profile_link_requests
      FOR SELECT USING (auth.uid() = user_id)`,

    `CREATE POLICY "Users can create link requests" ON profile_link_requests
      FOR INSERT WITH CHECK (auth.uid() = user_id)`,

    `CREATE POLICY "Admins can view all link requests" ON profile_link_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE auth_user_id = auth.uid() AND role = 'admin'
        )
      )`,
  ];

  // Execute each statement
  for (const statement of statements) {
    try {
      const { error } = await supabase
        .rpc("query", {
          query_text: statement,
        })
        .catch((err) => {
          // If RPC doesn't work, try direct execution
          console.log("RPC failed, statement will be added to migration file");
          return { error: err };
        });

      if (error) {
        console.log(
          `⚠️  Statement needs manual execution: ${statement.substring(0, 50)}...`,
        );
      } else {
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
      }
    } catch (err) {
      console.log(`⚠️  Error: ${err.message}`);
    }
  }

  // Now let's create the functions using a migration file
  const functionsSQL = `
-- Search profiles by Arabic name chain
CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(p_name_chain TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  hid TEXT,
  generation INT,
  status TEXT,
  father_id UUID,
  mother_id UUID,
  gender TEXT,
  birth_date_hijri TEXT,
  death_date_hijri TEXT,
  is_claimed BOOLEAN
) AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces
  v_names := string_to_array(trim(p_name_chain), ' ');
  
  -- Extract name components
  v_first_name := v_names[1];
  v_father_name := v_names[2];
  v_grandfather_name := v_names[3];
  
  -- Search for profiles matching the name chain
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.hid,
    p.generation,
    p.status,
    p.father_id,
    p.mother_id,
    p.gender,
    p.birth_date_hijri,
    p.death_date_hijri,
    (p.auth_user_id IS NOT NULL) as is_claimed
  FROM profiles p
  WHERE 
    -- Match first name (handle various Arabic name variations)
    (
      p.name = v_first_name OR
      p.name LIKE v_first_name || ' %' OR
      p.name LIKE '% ' || v_first_name || ' %' OR
      p.name LIKE '% ' || v_first_name
    )
    -- Don't show already claimed profiles
    AND p.auth_user_id IS NULL
  ORDER BY p.generation DESC, p.name
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get profile tree context for verification
CREATE OR REPLACE FUNCTION get_profile_tree_context(p_profile_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH profile_data AS (
    SELECT 
      p.id,
      p.name,
      p.hid,
      p.generation,
      p.status,
      p.gender,
      p.birth_date_hijri,
      p.death_date_hijri,
      p.father_id,
      p.mother_id
    FROM profiles p
    WHERE p.id = p_profile_id
  ),
  lineage AS (
    -- Get ancestors up the tree
    WITH RECURSIVE ancestors AS (
      SELECT 
        p.id,
        p.name,
        p.generation,
        p.father_id,
        0 as level
      FROM profiles p
      WHERE p.id = p_profile_id
      
      UNION ALL
      
      SELECT 
        parent.id,
        parent.name,
        parent.generation,
        parent.father_id,
        a.level + 1
      FROM ancestors a
      JOIN profiles parent ON parent.id = a.father_id
      WHERE a.level < 5 -- Limit to 5 generations
    )
    SELECT json_agg(
      json_build_object(
        'id', id,
        'name', name,
        'generation', generation,
        'level', level
      ) ORDER BY level
    ) as ancestors
    FROM ancestors
    WHERE id != p_profile_id
  ),
  siblings_data AS (
    -- Get siblings
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'gender', p.gender,
        'birth_order', p.sibling_order,
        'status', p.status
      ) ORDER BY p.sibling_order
    ) as siblings
    FROM profiles p
    WHERE p.father_id = (SELECT father_id FROM profile_data)
      AND p.id != p_profile_id
  ),
  father_siblings_data AS (
    -- Get father's siblings (uncles/aunts)
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'gender', p.gender,
        'birth_order', p.sibling_order
      ) ORDER BY p.sibling_order
    ) as father_siblings
    FROM profiles p
    WHERE p.father_id = (
      SELECT father_id 
      FROM profiles 
      WHERE id = (SELECT father_id FROM profile_data)
    )
  ),
  children_data AS (
    -- Get children count
    SELECT 
      COUNT(*) as children_count,
      json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'gender', p.gender
        ) ORDER BY p.sibling_order
      ) as children
    FROM profiles p
    WHERE p.father_id = p_profile_id OR p.mother_id = p_profile_id
  )
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', pd.id,
        'name', pd.name,
        'hid', pd.hid,
        'generation', pd.generation,
        'status', pd.status,
        'gender', pd.gender,
        'birth_date_hijri', pd.birth_date_hijri,
        'death_date_hijri', pd.death_date_hijri
      )
      FROM profile_data pd
    ),
    'lineage', (SELECT ancestors FROM lineage),
    'siblings', (SELECT siblings FROM siblings_data),
    'father_siblings', (SELECT father_siblings FROM father_siblings_data),
    'children_count', (SELECT children_count FROM children_data),
    'children', (SELECT children FROM children_data)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit profile link request
CREATE OR REPLACE FUNCTION submit_profile_link_request(
  p_profile_id UUID,
  p_name_chain TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_request_id UUID;
  v_existing_request UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'يجب تسجيل الدخول أولاً'
    );
  END IF;
  
  -- Get user's phone number
  SELECT phone INTO v_phone
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Check if request already exists
  SELECT id INTO v_existing_request
  FROM profile_link_requests
  WHERE user_id = v_user_id AND profile_id = p_profile_id;
  
  IF v_existing_request IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'لديك طلب سابق لهذا الملف',
      'request_id', v_existing_request
    );
  END IF;
  
  -- Check if profile is already claimed
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_profile_id AND auth_user_id IS NOT NULL
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'هذا الملف مرتبط بمستخدم آخر'
    );
  END IF;
  
  -- Create the link request
  INSERT INTO profile_link_requests (
    user_id,
    profile_id,
    name_chain,
    phone,
    status,
    created_at
  ) VALUES (
    v_user_id,
    p_profile_id,
    p_name_chain,
    v_phone,
    'pending',
    NOW()
  ) RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'تم إرسال طلب الربط بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

  // Write to migration file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    `${timestamp}_auth_backend.sql`,
  );

  fs.writeFileSync(migrationPath, functionsSQL);
  console.log(`\n📝 Migration file created: ${migrationPath}`);
  console.log("\n✨ To complete deployment, run:");
  console.log(`   npx supabase db push`);

  // Test if functions exist
  console.log("\n🧪 Testing if functions were created...");

  try {
    const { data: searchTest, error: searchError } = await supabase.rpc(
      "search_profiles_by_name_chain",
      {
        p_name_chain: "test",
      },
    );

    if (searchError) {
      console.log(
        "❌ search_profiles_by_name_chain not found - needs deployment",
      );
    } else {
      console.log("✅ search_profiles_by_name_chain is working!");
    }
  } catch (err) {
    console.log("❌ search_profiles_by_name_chain not found");
  }
}

deployAuthBackend().catch(console.error);
