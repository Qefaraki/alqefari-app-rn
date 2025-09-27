#!/usr/bin/env node

/**
 * Script to deploy the super admin migration (006)
 * This copies the migration SQL to your clipboard for manual deployment
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const migrationPath = path.join(__dirname, '..', 'migrations', '006_super_admin_permissions.sql');

// Read the migration file
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Copy to clipboard based on OS
const copyToClipboard = (text) => {
  const platform = process.platform;

  let command;
  if (platform === 'darwin') {
    command = 'pbcopy';
  } else if (platform === 'linux') {
    command = 'xclip -selection clipboard';
  } else if (platform === 'win32') {
    command = 'clip';
  } else {
    console.error('❌ Unsupported platform for clipboard operation');
    console.log('\n📄 Migration SQL (copy manually):');
    console.log('=====================================');
    console.log(text);
    return;
  }

  const child = exec(command);
  child.stdin.write(text);
  child.stdin.end();

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ Migration 006 SQL copied to clipboard!');
      console.log('\n📋 Next steps:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Open SQL Editor');
      console.log('3. Paste (Cmd+V or Ctrl+V) the SQL');
      console.log('4. Click "Run" to deploy');
      console.log('\n⚠️  Important: This migration:');
      console.log('   • Adds super_admin role');
      console.log('   • Creates permission management functions');
      console.log('   • Renames search function to avoid collision');
      console.log('\n🔍 After deployment, verify with:');
      console.log('   SELECT proname FROM pg_proc WHERE proname LIKE \'%super_admin%\';');
    } else {
      console.error('❌ Failed to copy to clipboard');
      console.log('\n📄 Migration SQL (copy manually):');
      console.log('=====================================');
      console.log(text);
    }
  });
};

console.log('🚀 Preparing Super Admin Migration (006)...\n');
copyToClipboard(migrationSQL);