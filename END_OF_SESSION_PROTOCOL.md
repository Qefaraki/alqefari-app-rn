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

## 🚫 CRITICAL RULE: AI AGENTS CANNOT MERGE TO MASTER

**AI agents are NEVER allowed to:**

- Push directly to master branch
- Merge branches into master
- Force push to any branch
- Delete the master branch

**AI agents MUST always:**

- Create Pull Requests (PRs) only
- Push to feature branches
- Wait for human approval

```
Question 1: Is the feature complete and tested?
├─ YES → Continue to Question 2
└─ NO → Push branch, create draft PR, END

Question 2: Are there < 20 commits?
├─ YES → Continue to Question 3
└─ NO → Must create PR today (skip to CREATE PR)

Question 3: Does it touch critical files?
├─ YES → Create PR with "needs-review" label, END
└─ NO → Create PR with "ready-to-merge" label
```

### 6️⃣ CREATE PULL REQUEST PROCEDURE

```bash
# STEP 1: Push feature branch
git push origin feature/current-branch

# STEP 2: Create PR via GitHub CLI or provide link
gh pr create \
  --title "feat: [Summary of changes]" \
  --body "## Changes Made
- Feature X added
- Bug Y fixed
- Component Z updated

## Testing Done
- [ ] npm run lint passes
- [ ] Manual testing completed
- [ ] No console errors

## Commits: $(git rev-list --count origin/master..HEAD)
## Files Changed: $(git diff --stat origin/master | tail -1)

**Created by**: AI Agent (Claude/Cursor/etc)
**Session Date**: $(date +%Y-%m-%d)" \
  --base master \
  --head feature/current-branch

# STEP 3: Provide user with PR link
echo "
=====================================
📢 PULL REQUEST CREATED
=====================================
Branch: feature/current-branch
Commits: $(git rev-list --count origin/master..HEAD)

Please review at:
https://github.com/[username]/[repo]/pull/new/feature/current-branch

The branch is ready for your review and merge.
====================================="
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

### If User Accidentally Asks Agent to Merge:

```bash
# STOP IMMEDIATELY and inform user:
echo "
⚠️ WARNING: AI agents cannot merge to master
=========================================
I am not authorized to merge branches.
Please review the PR I've created instead.

To merge yourself:
1. Review the PR on GitHub
2. Click 'Merge pull request' if satisfied
3. Or use: gh pr merge [PR-NUMBER]
"
```

### If Something Goes Wrong:

```bash
# Create safety branch and inform user
git checkout -b emergency-backup-$(date +%Y%m%d-%H%M%S)
git push origin emergency-backup-$(date +%Y%m%d-%H%M%S)

echo "
Created emergency backup branch.
User should review and fix manually.
"
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

## 🎯 Golden Rules for AI Agents

1. **NEVER push to master branch** - Only feature branches
2. **NEVER merge branches** - Only create PRs
3. **NEVER force push anything** - Ever
4. **ALWAYS create PRs** for user review
5. **ALWAYS document in PR** what was changed and why
6. **ALWAYS push feature branch** before ending session
7. **ALWAYS inform user** about PR creation

## ⛔ Forbidden Commands for AI Agents

These commands must NEVER be executed by AI agents:

```bash
# ❌ FORBIDDEN - Never do these:
git push origin master
git push --force
git merge master
git checkout master && git merge feature/branch
git reset --hard origin/master
git push --force-with-lease

# ✅ ALLOWED - Only these:
git push origin feature/branch-name
gh pr create
git commit
git add
```

---

**Remember**: It's better to merge small working increments than to let branches diverge for weeks!
