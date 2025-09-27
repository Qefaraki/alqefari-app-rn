const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Split the migration into smaller executable chunks
const migrationStatements = [
  // 1. Add columns to profiles table
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id)`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claim_status TEXT CHECK (claim_status IN ('unclaimed', 'pending', 'verified', 'rejected'))`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claim_requested_at TIMESTAMPTZ`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claim_verified_by UUID REFERENCES profiles(id)`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT`,

  // 2. Create profile_link_requests table
  `CREATE TABLE IF NOT EXISTS profile_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    profile_id UUID REFERENCES profiles(id) NOT NULL,
    name_chain TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES profiles(id),
    review_notes TEXT,
    whatsapp_contacted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(user_id, profile_id)
  )`,

  // 3. Create notifications table
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('link_request', 'link_approved', 'link_rejected', 'edit_suggestion', 'approval', 'rejection', 'mention')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
  )`,

  // 4. Create activity_log table
  `CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 5. Create whatsapp_templates table
  `CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL,
    template_text TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 6. Insert WhatsApp templates
  `INSERT INTO whatsapp_templates (template_key, template_text, variables, is_active) 
   SELECT 'link_request', 'مرحباً،\n\nتم استلام طلبك لربط ملفك الشخصي في شجرة عائلة القفاري.\n\nالاسم: {name_chain}\nالملف المطلوب: {profile_name}\n\nللتحقق من هويتك، يرجى الرد بمعلومات إضافية تؤكد هويتك.\n\nشكراً لك', ARRAY['name_chain', 'profile_name'], true
   WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_key = 'link_request')`,

  `INSERT INTO whatsapp_templates (template_key, template_text, variables, is_active) 
   SELECT 'link_approved', 'مرحباً {name}،\n\nتم الموافقة على طلبك لربط ملفك الشخصي.\n\nيمكنك الآن الدخول للتطبيق وتعديل معلوماتك الشخصية.\n\nأهلاً بك في شجرة عائلة القفاري!', ARRAY['name'], true
   WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_key = 'link_approved')`,

  `INSERT INTO whatsapp_templates (template_key, template_text, variables, is_active) 
   SELECT 'link_rejected', 'مرحباً،\n\nنأسف لإبلاغك أن طلبك لربط الملف الشخصي لم تتم الموافقة عليه.\n\nالسبب: {reason}\n\nيرجى التواصل معنا لمزيد من المعلومات.', ARRAY['reason'], true
   WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_key = 'link_rejected')`,

  `INSERT INTO whatsapp_templates (template_key, template_text, variables, is_active) 
   SELECT 'general_contact', 'مرحباً،\n\nنود التواصل معك بخصوص شجرة عائلة القفاري.\n\n{message}\n\nشكراً لك', ARRAY['message'], true
   WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE template_key = 'general_contact')`,

  // 7. Create indexes
  `CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_profiles_claim_status ON profiles(claim_status) WHERE claim_status IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS idx_link_requests_user ON profile_link_requests(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read) WHERE read = FALSE`,
  `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC)`,

  // 8. Enable RLS
  `ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY`,
];

async function deployMigration() {
  console.log("🚀 Deploying phone authentication migration...\n");

  let successCount = 0;
  let errorCount = 0;

  // Test connection first
  const { data: testData, error: testError } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  if (testError) {
    console.error("❌ Cannot connect to database:", testError.message);
    return;
  }

  console.log("✅ Connected to database\n");

  // Execute each statement
  for (let i = 0; i < migrationStatements.length; i++) {
    const statement = migrationStatements[i];
    const preview = statement.substring(0, 60).replace(/\n/g, " ") + "...";

    console.log(`[${i + 1}/${migrationStatements.length}] ${preview}`);

    // For table creation and alterations, we need to check if they exist
    if (
      statement.includes("CREATE TABLE") ||
      statement.includes("ALTER TABLE")
    ) {
      // These need to be run via SQL editor since we can't execute DDL directly
      console.log("  ⚠️  DDL statement - needs manual execution");
      errorCount++;
    } else if (statement.includes("INSERT INTO")) {
      // Try to execute inserts via a workaround
      console.log("  ⚠️  INSERT statement - needs manual execution");
      errorCount++;
    } else if (statement.includes("CREATE INDEX")) {
      console.log("  ⚠️  INDEX statement - needs manual execution");
      errorCount++;
    } else {
      console.log("  ⚠️  Statement needs manual execution");
      errorCount++;
    }
  }

  console.log("\n📋 Migration Summary:");
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ⚠️  Need manual execution: ${errorCount}`);

  // Save full migration for manual execution
  const fullMigration = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "038_phone_auth_system.sql",
    ),
    "utf8",
  );

  const outputPath = path.join(__dirname, "..", "PHONE_AUTH_MIGRATION.sql");
  fs.writeFileSync(outputPath, fullMigration);

  console.log("\n📝 Full migration saved to: PHONE_AUTH_MIGRATION.sql");
  console.log("\n🎯 Next steps:");
  console.log("1. Go to Supabase SQL Editor:");
  console.log(
    "   https://supabase.com/dashboard/project/ezkioroyhzpavyn/editor",
  );
  console.log("2. Paste and run the SQL from PHONE_AUTH_MIGRATION.sql");
  console.log("3. Enable Phone Auth in Authentication > Providers");

  // Test if functions exist
  console.log("\n🔍 Testing if functions need to be created...");

  const { data: searchTest, error: searchError } = await supabase
    .rpc("search_profiles_by_name_chain", {
      p_name_chain: "test",
    })
    .catch((err) => ({ error: err }));

  if (searchError?.message?.includes("Could not find")) {
    console.log("  ❌ Functions need to be created - include in SQL editor");

    // Add functions to the migration file
    const functionsSQL = `
-- Function to search profiles by name chain
CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(
  p_name_chain TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  father_name TEXT,
  grandfather_name TEXT,
  hid TEXT,
  generation INT,
  has_auth BOOLEAN,
  match_score INT
) AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces
  v_names := string_to_array(trim(p_name_chain), ' ');
  v_first_name := v_names[1];
  v_father_name := v_names[2];
  v_grandfather_name := v_names[3];
  
  RETURN QUERY
  WITH matches AS (
    SELECT 
      p.id,
      p.name,
      f.name as father_name,
      gf.name as grandfather_name,
      p.hid,
      p.generation,
      p.auth_user_id IS NOT NULL as has_auth,
      -- Calculate match score
      CASE WHEN lower(p.name) = lower(v_first_name) THEN 40 ELSE 0 END +
      CASE WHEN f.name IS NOT NULL AND lower(f.name) = lower(v_father_name) THEN 30 ELSE 0 END +
      CASE WHEN gf.name IS NOT NULL AND lower(gf.name) = lower(v_grandfather_name) THEN 20 ELSE 0 END +
      CASE WHEN p.auth_user_id IS NULL THEN 10 ELSE 0 END as match_score
    FROM profiles p
    LEFT JOIN profiles f ON p.father_id = f.id
    LEFT JOIN profiles gf ON f.father_id = gf.id
    WHERE 
      p.deleted_at IS NULL
      AND (
        lower(p.name) LIKE lower(v_first_name) || '%'
        OR (v_father_name IS NOT NULL AND lower(f.name) LIKE lower(v_father_name) || '%')
        OR (v_grandfather_name IS NOT NULL AND lower(gf.name) LIKE lower(v_grandfather_name) || '%')
      )
  )
  SELECT * FROM matches
  WHERE match_score > 0
  ORDER BY match_score DESC, generation ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain TO anon, authenticated;
`;

    fs.writeFileSync(outputPath, fullMigration + "\n\n" + functionsSQL);
    console.log("  ✅ Functions added to migration file");
  } else {
    console.log("  ✅ Functions may already exist or need manual creation");
  }
}

deployMigration().catch(console.error);
