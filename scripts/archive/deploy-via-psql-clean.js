const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get database URL from environment
let DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database URL found in environment');
  process.exit(1);
}

// Clean the URL - remove the 'supa' parameter that psql doesn't understand
DATABASE_URL = DATABASE_URL.replace('&supa=base-pooler.x', '');

// Read the migration file
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20250927114554_profile_link_improvements_fixed.sql');
const sqlContent = fs.readFileSync(migrationFile, 'utf8');

// Write SQL to temp file
const tempFile = '/tmp/migration.sql';
fs.writeFileSync(tempFile, sqlContent);

console.log('🚀 Deploying migration via psql...');
console.log('📄 Migration file:', migrationFile);
console.log('🔗 Database URL:', DATABASE_URL.substring(0, 50) + '...');

try {
  // Execute using psql command
  const command = `psql "${DATABASE_URL}" -f ${tempFile}`;

  console.log('⚡ Executing SQL...');
  const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  console.log('✅ Migration executed successfully!');
  console.log('Output:', output.substring(0, 500)); // Show first 500 chars

  // Clean up temp file
  fs.unlinkSync(tempFile);

} catch (error) {
  console.error('❌ Error executing migration');

  // Parse the error to show relevant info
  const errorStr = error.toString();
  if (errorStr.includes('already exists')) {
    console.log('⚠️ Some objects already exist (this might be okay if partially deployed)');
  } else if (errorStr.includes('does not exist')) {
    console.log('⚠️ Some dependencies missing');
  } else {
    console.log('Error details:', errorStr.substring(0, 1000));
  }

  // Don't exit with error if it's just "already exists" errors
  if (!errorStr.includes('already exists')) {
    process.exit(1);
  }
}

console.log('\n🔍 Verifying deployment...');

// Verify the deployment by checking if tables exist
const checkCommand = `psql "${DATABASE_URL}" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('admin_messages', 'profile_link_requests', 'notifications');" -t`;

try {
  const tables = execSync(checkCommand, { encoding: 'utf8' });
  console.log('📊 Found tables:', tables.trim().split('\n').filter(t => t.trim()).join(', '));
} catch (error) {
  console.log('Could not verify tables');
}

console.log('✨ Done!');