#!/usr/bin/env node
/**
 * Fix test file signatures to match updated fixture methods
 * Removes actorId parameter from audit log fixture calls
 */

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '__tests__/rpc');
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));

testFiles.forEach(file => {
  const filePath = path.join(testsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix createProfileUpdateLog - remove 2nd parameter (actorId)
  // Pattern: createProfileUpdateLog(profileId, actorId, oldData, newData)
  // Becomes: createProfileUpdateLog(profileId, oldData, newData)
  const profileUpdatePattern = /(createProfileUpdateLog\([^,]+,)\s*[^,]+,(\s*\{[^}]+\},\s*\{[^}]+\})/gs;
  if (content.match(profileUpdatePattern)) {
    content = content.replace(profileUpdatePattern, '$1$2');
    modified = true;
  }

  // Fix createOldAuditLog - remove 3rd parameter (actorId)
  // Pattern: createOldAuditLog(actionType, profileId, actorId, daysOld)
  // Becomes: createOldAuditLog(actionType, profileId, daysOld)
  const oldAuditPattern = /(createOldAuditLog\([^,]+,\s*[^,]+,)\s*[^,]+,(\s*\d+)/gs;
  if (content.match(oldAuditPattern)) {
    content = content.replace(oldAuditPattern, '$1$2');
    modified = true;
  }

  // Fix createUndoneAuditLog - remove 3rd parameter (actorId)
  // Pattern: createUndoneAuditLog(actionType, profileId, actorId, oldData)
  // Becomes: createUndoneAuditLog(actionType, profileId, oldData)
  const undonePattern = /(createUndoneAuditLog\([^,]+,\s*[^,]+,)\s*[^,]+,(\s*\{)/gs;
  if (content.match(undonePattern)) {
    content = content.replace(undonePattern, '$1$2');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${file}`);
  } else {
    console.log(`⏭️  Skipped ${file} (no changes needed)`);
  }
});

console.log('\n✅ All test files processed!');
