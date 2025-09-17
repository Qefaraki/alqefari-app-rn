# 🚀 End-of-Session Protocol for Multi-Agent Development

## ⚠️ CRITICAL: When User Says "Ending for today" or Similar

### 1️⃣ IMMEDIATE AUDIT (Do First!)

```bash
# Check current status
git status
git diff --stat
git log --oneline -5

# Count commits ahead of master
git rev-list --count origin/master..HEAD
```

**If > 20 commits → MUST MERGE TODAY**

### 2️⃣ CODE CLEANUP CHECKLIST

```bash
# Remove debug code
grep -r "console.log" src/ --exclude-dir=node_modules | grep -v "// Production log"

# Find TODOs
grep -r "TODO\|FIXME\|XXX" src/

# Check for merge conflicts
grep -r "<<<<<<< HEAD" --exclude-dir={node_modules,.git,ios,android}

# Find temporary files
find . -name "*.backup" -o -name "*.old" -o -name "*.tmp" | grep -v node_modules
```

### 3️⃣ SAFETY VERIFICATION

```bash
# Test critical functions
npm run lint

# Check for sensitive data
grep -r "supabase" .env  # Should exist
grep -r "supabase" src/  # Should NOT have keys

# Verify file sizes (nothing huge accidentally added)
find . -type f -size +5M | grep -v node_modules | grep -v .git
```

### 4️⃣ SMART COMMIT STRATEGY

```bash
# If work is complete and tested:
git add -A
git commit -m "feat: [Session Summary] - $(date +%Y%m%d)

✅ Completed:
- Feature X with Y functionality
- Fixed Z issue
- Added A component

📋 Files changed: $(git diff --stat HEAD^ | tail -1)"
```

### 5️⃣ MERGE DECISION TREE

```
Question 1: Is the feature complete and tested?
├─ YES → Continue to Question 2
└─ NO → Push branch, document progress, END

Question 2: Are there < 20 commits?
├─ YES → Continue to Question 3
└─ NO → Must merge today (skip to SAFE MERGE)

Question 3: Does it touch critical files?
├─ YES → Create PR for review, END
└─ NO → Proceed to SAFE MERGE
```

### 6️⃣ SAFE MERGE PROCEDURE

```bash
# STEP 1: Create safety tag
git tag backup-$(date +%Y%m%d-%H%M%S)
git push origin --tags

# STEP 2: Test merge
git checkout master
git pull origin master
git merge --no-commit --no-ff feature/current-branch

# STEP 3: Verify
git status
git diff --stat

# STEP 4: Decision point
read -p "Does everything look correct? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "merge: [Feature name] after [session context]"
    git push origin master

    # Clean up
    git branch -d feature/current-branch
    git push origin --delete feature/current-branch
else
    git merge --abort
    echo "Merge aborted - pushing branch for review"
    git checkout feature/current-branch
    git push origin feature/current-branch
fi
```

### 7️⃣ POST-MERGE VERIFICATION

```bash
# Verify deployment
echo "Checking if app still builds..."
npm start -- --reset-cache

# Quick smoke test checklist:
# [ ] App launches
# [ ] Can navigate to main screens
# [ ] No console errors
# [ ] Database connections work
```

### 8️⃣ DOCUMENTATION UPDATE

Create session summary:

```markdown
## Session: [Date]

**Agent**: Claude/Cursor/Other
**Branch**: feature/xxx
**Duration**: X hours

### Completed:

- ✅ Feature/Fix description
- ✅ What was tested

### Pending:

- ⚠️ Known issues
- 📝 TODO items

### Files Modified:

- src/xxx (added feature Y)
- scripts/xxx (fixed Z)

### Database Changes:

- None / Migration XXX

### Breaking Changes:

- None / List here
```

## 🔴 EMERGENCY PROCEDURES

### If Merge Goes Wrong:

```bash
# Option 1: Revert the merge
git revert -m 1 HEAD
git push origin master

# Option 2: Reset to backup tag
git reset --hard backup-YYYYMMDD-HHMMSS
git push origin master --force-with-lease

# Option 3: Restore from GitHub
git fetch origin
git reset --hard origin/master
```

### If Unsure About Anything:

```bash
# Create a safety branch
git checkout -b safety-net-$(date +%Y%m%d)
git push origin safety-net-$(date +%Y%m%d)

# Ask user:
echo "Created safety branch. Please review:"
echo "- Current changes: git diff master..HEAD"
echo "- Commits: git log master..HEAD"
echo "Should we proceed with merge?"
```

## 📊 Branch Lifespan Guidelines

| Change Type   | Max Lifespan | Commits | Action               |
| ------------- | ------------ | ------- | -------------------- |
| Hotfix        | Same day     | 1-3     | Merge immediately    |
| Bug fix       | 1 day        | 1-5     | Merge end of day     |
| Small feature | 2-3 days     | 5-15    | Merge when complete  |
| Large feature | 1 week       | 15-30   | Create PR for review |
| Refactor      | 3 days       | 10-20   | Merge with testing   |

## ⚡ Quick Commands

```bash
# Alias these for efficiency
alias gs='git status'
alias glog='git log --oneline -10'
alias gdiff='git diff --stat'
alias gcount='git rev-list --count origin/master..HEAD'
alias gsafe='git tag backup-$(date +%Y%m%d-%H%M%S) && git push origin --tags'
```

## 🎯 Golden Rules

1. **Never force push to master** (except emergencies)
2. **Always create backup tag** before risky operations
3. **Merge daily** if possible (avoid drift)
4. **Document decisions** in commit messages
5. **Test before merge** (at minimum: npm run lint)
6. **Communicate status** to user before major actions

---

**Remember**: It's better to merge small working increments than to let branches diverge for weeks!
