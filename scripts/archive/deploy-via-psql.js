const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get database URL from environment
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No database URL found in environment');
  process.exit(1);
}

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
  console.log('Output:', output);

  // Clean up temp file
  fs.unlinkSync(tempFile);

} catch (error) {
  console.error('❌ Error executing migration:', error.message);
  if (error.stdout) {
    console.log('stdout:', error.stdout.toString());
  }
  if (error.stderr) {
    console.log('stderr:', error.stderr.toString());
  }
  process.exit(1);
}

console.log('✨ Done!');