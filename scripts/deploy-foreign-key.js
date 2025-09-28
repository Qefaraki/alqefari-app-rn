require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployForeignKey() {
  console.log('Deploying foreign key constraint...');

  // First, check if the constraint already exists
  const { data: existingConstraints, error: checkError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'profile_link_requests_profile_id_fkey'
      AND table_name = 'profile_link_requests'
    `
  });

  if (checkError) {
    console.error('Error checking existing constraint:', checkError);
    // If the RPC doesn't exist, try a different approach
  }

  const sqlQuery = `
    -- Add foreign key constraint for profile_link_requests.profile_id
    -- This constraint is required for PostgREST to properly join tables using the ! syntax
    -- The constraint name must be profile_link_requests_profile_id_fkey for the existing queries to work

    ALTER TABLE profile_link_requests
    ADD CONSTRAINT profile_link_requests_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_profile_link_requests_profile_id
    ON profile_link_requests(profile_id);
  `;

  // Try to execute through RPC
  const { data, error } = await supabase.rpc('execute_sql', { query: sqlQuery });

  if (error) {
    // If RPC doesn't exist, provide instructions to run manually
    console.log('\n⚠️  Could not execute automatically. Please run the following SQL in your Supabase Dashboard:');
    console.log('\n' + '='.repeat(80));
    console.log(sqlQuery);
    console.log('='.repeat(80) + '\n');
    console.log('Navigate to: SQL Editor in your Supabase Dashboard');
    console.log('Paste the above SQL and click "Run"');
    return false;
  }

  console.log('✅ Foreign key constraint deployed successfully!');
  return true;
}

deployForeignKey().then(success => {
  if (!success) {
    console.log('\n⚠️  Manual deployment required - see instructions above');
  }
  process.exit(success ? 0 : 1);
});