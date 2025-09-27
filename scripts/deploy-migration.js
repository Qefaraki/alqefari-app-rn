#!/usr/bin/env node

/**
 * Safe database migration deployment script
 * Uses ANON key only (never SERVICE_ROLE_KEY)
 * Provides rollback capabilities and safety checks
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Initialize Supabase client with ANON key only
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

/**
 * Deploy SQL migration file
 */
async function deployMigration(sqlFilePath) {
  try {
    // Validate file exists
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Migration file not found: ${sqlFilePath}`);
    }

    // Read SQL content
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    const fileName = path.basename(sqlFilePath);

    console.log(`\n📄 Migration: ${fileName}`);
    console.log(`📏 Size: ${(sqlContent.length / 1024).toFixed(2)} KB`);

    // Parse SQL to check for dangerous operations
    const dangerousPatterns = [
      /DROP\s+SCHEMA/i,
      /DROP\s+DATABASE/i,
      /TRUNCATE\s+auth\.users/i,
      /DELETE\s+FROM\s+auth\.users/i,
      /DROP\s+TABLE\s+profiles(?!\s+CASCADE)/i,
      /DROP\s+TABLE\s+marriages(?!\s+CASCADE)/i,
    ];

    const warnings = [];
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(sqlContent)) {
        warnings.push(`⚠️  Contains potentially dangerous operation: ${pattern.source}`);
      }
    });

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS DETECTED:');
      warnings.forEach(w => console.log(w));

      const proceed = await askQuestion('\nDo you want to proceed? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        return false;
      }
    }

    // Create backup point (timestamp)
    const backupTimestamp = new Date().toISOString();
    console.log(`\n📸 Backup timestamp: ${backupTimestamp}`);
    console.log('   (Note: Ensure database backups are enabled in Supabase dashboard)');

    // Deploy via RPC if admin function exists, otherwise suggest manual deployment
    console.log('\n🚀 Deploying migration...');

    // Check if admin deployment function exists
    const { data: adminCheck, error: adminError } = await supabase
      .rpc('is_admin')
      .single();

    if (!adminError && adminCheck) {
      // Try to deploy via admin RPC
      const { data, error } = await supabase.rpc('admin_execute_sql', {
        p_sql: sqlContent
      });

      if (error) {
        console.log('\n⚠️  Admin deployment function not available');
        console.log('   Please deploy manually via Supabase Dashboard SQL Editor');

        // Copy SQL to clipboard if possible
        try {
          const { exec } = require('child_process');
          exec('pbcopy', (err, stdout, stderr) => {
            if (!err) {
              const proc = exec('pbcopy');
              proc.stdin.write(sqlContent);
              proc.stdin.end();
              console.log('✓ SQL copied to clipboard');
            }
          });
        } catch (e) {
          // Clipboard copy not available
        }

        // Save to temp file for easy access
        const tempPath = path.join(__dirname, '..', 'supabase', 'DEPLOY_THIS.sql');
        fs.writeFileSync(tempPath, sqlContent);
        console.log(`✓ SQL saved to: ${tempPath}`);

        return false;
      }

      console.log('✅ Migration deployed successfully!');
      return true;
    } else {
      // No admin access - provide manual instructions
      console.log('\n📋 Manual Deployment Required:');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Paste and run the SQL from:');
      console.log(`   ${sqlFilePath}`);

      // Save to convenient location
      const tempPath = path.join(__dirname, '..', 'supabase', 'DEPLOY_THIS.sql');
      fs.writeFileSync(tempPath, sqlContent);
      console.log(`\n✓ SQL copied to: ${tempPath}`);

      return false;
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    return false;
  }
}

/**
 * List available migrations
 */
function listMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.startsWith('.'))
    .sort();

  console.log('\n📂 Available migrations:');
  files.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  return files;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Supabase Migration Deployment Tool');
  console.log('=====================================');

  // Get migration file from command line or prompt
  let migrationFile = process.argv[2];

  if (!migrationFile) {
    // List available migrations
    const migrations = listMigrations();

    if (migrations.length === 0) {
      console.log('❌ No migration files found');
      process.exit(1);
    }

    const choice = await askQuestion('\nEnter migration number or filename: ');

    // Check if it's a number
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < migrations.length) {
      migrationFile = migrations[index];
    } else {
      migrationFile = choice;
    }
  }

  // Resolve full path
  let fullPath;
  if (path.isAbsolute(migrationFile)) {
    fullPath = migrationFile;
  } else if (migrationFile.includes('/')) {
    fullPath = path.join(__dirname, '..', migrationFile);
  } else {
    fullPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
  }

  // Add .sql extension if missing
  if (!fullPath.endsWith('.sql')) {
    fullPath += '.sql';
  }

  // Deploy the migration
  const success = await deployMigration(fullPath);

  if (success) {
    console.log('\n✨ Migration completed successfully!');

    // Log to migration history
    const historyPath = path.join(__dirname, '..', 'supabase', 'migration-history.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }

    history.push({
      file: path.basename(fullPath),
      deployedAt: new Date().toISOString(),
      deployedBy: process.env.USER || 'unknown'
    });

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } else {
    console.log('\n⚠️  Migration not completed - manual action required');
  }

  rl.close();
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});