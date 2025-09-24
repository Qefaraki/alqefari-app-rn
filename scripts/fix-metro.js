#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Fixing Metro bundler issues...\n');

// 1. Kill all running processes
console.log('1️⃣  Killing all running Expo/Metro processes...');
try {
  execSync('pkill -f "expo start" || true', { stdio: 'inherit' });
  execSync('pkill -f "node.*metro" || true', { stdio: 'inherit' });
  execSync('pkill -f "react-native" || true', { stdio: 'inherit' });
  execSync('lsof -i :8081 | grep LISTEN | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true', { shell: true });
  execSync('lsof -i :19000 | grep LISTEN | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true', { shell: true });
  execSync('lsof -i :19001 | grep LISTEN | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true', { shell: true });
} catch (e) {
  // Ignore errors
}

// 2. Clear all caches
console.log('2️⃣  Clearing all caches...');
const cacheDirectories = [
  'node_modules/.cache',
  '.expo',
  '.metro',
  'ios/build',
  'ios/Pods',
];

cacheDirectories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`   Removing ${dir}...`);
    execSync(`rm -rf "${fullPath}"`, { stdio: 'inherit' });
  }
});

// Clear temp directories
try {
  execSync('rm -rf $TMPDIR/metro-* 2>/dev/null || true', { shell: true });
  execSync('rm -rf $TMPDIR/haste-* 2>/dev/null || true', { shell: true });
  execSync('rm -rf $TMPDIR/react-* 2>/dev/null || true', { shell: true });
} catch (e) {
  // Ignore errors
}

// 3. Reset Watchman
console.log('3️⃣  Resetting Watchman...');
try {
  execSync(`watchman watch-del '${process.cwd()}'`, { stdio: 'inherit' });
  execSync(`watchman watch-project '${process.cwd()}'`, { stdio: 'inherit' });
} catch (e) {
  console.log('   Watchman reset failed (might not be installed)');
}

// 4. Apply patches
console.log('4️⃣  Applying patches...');
execSync('npx patch-package', { stdio: 'inherit' });

// 5. Reinstall iOS Pods if needed
if (fs.existsSync('ios')) {
  console.log('5️⃣  Reinstalling iOS Pods...');
  try {
    execSync('cd ios && pod install', { stdio: 'inherit' });
  } catch (e) {
    console.log('   Pod install failed (CocoaPods might not be installed)');
  }
}

console.log('\n✅ All fixes applied!\n');
console.log('You can now run:');
console.log('  npm start');
console.log('\nOr for a clean start:');
console.log('  npm run start:clean');