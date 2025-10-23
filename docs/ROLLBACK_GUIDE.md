# Emergency Rollback Guide

If Perfect Tree refactor breaks something catastrophically:

## Level 1: Rollback Last Commit (30 seconds)
```bash
git reset --hard HEAD~1
```

## Level 2: Rollback to Phase Start (1 minute)
```bash
# Find phase start commit
git log --oneline | grep "Phase"

# Rollback (replace abc123 with commit hash)
git reset --hard abc123
```

## Level 3: Rollback to Pre-Refactor (2 minutes)
```bash
git checkout v1.0-pre-refactor
# OR
git reset --hard backup/pre-perfect-tree-refactor
```

## Level 4: Restore from Local Backup (10 minutes)
```bash
cd /Users/alqefari/Desktop/
rm -rf AlqefariTreeRN-Expo/
tar -xzf AlqefariTreeRN-Backup-20251023-024500.tar.gz
```

## After Rollback
1. Run `npm install` (in case package.json changed)
2. Run `npx expo prebuild --clean` (if native changed)
3. Test on device to verify functionality
