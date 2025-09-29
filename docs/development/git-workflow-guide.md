# Git Workflow Guide for Alqefari App

This guide explains how to use Git and GitHub effectively for our project.

## What is Git?

Git is a version control system that tracks changes to your code over time. Think of it as a sophisticated "save game" system that:
- Saves snapshots of your code (commits)
- Lets you go back to any previous version
- Allows multiple people to work on the same code
- Helps merge different versions together

## What is GitHub?

GitHub is a website that hosts your Git repository online, providing:
- Cloud backup of your code
- Collaboration features (pull requests, issues)
- Web interface to view your code
- Social features (follow, star, fork)

## Basic Git Commands

### 1. Check Status
```bash
git status
```
Shows:
- Which branch you're on
- What files have changed
- What's ready to commit

### 2. View Branches
```bash
git branch        # Local branches
git branch -a     # All branches (local + remote)
```

### 3. Switch Branches
```bash
git checkout branch-name
```

### 4. Save Your Work (Commit)
```bash
git add .                          # Stage all changes
git commit -m "Your message here"  # Save with description
```

### 5. Push to GitHub
```bash
git push origin branch-name
```

### 6. Pull Latest Changes
```bash
git pull origin branch-name
```

## Our Branching Strategy

### Main Branches
- **master**: The main stable branch (production-ready code)
- **develop**: Active development branch (optional)

### Feature Branches
- **feat/**: New features (e.g., `feat/user-profile`)
- **fix/**: Bug fixes (e.g., `fix/login-error`)
- **chore/**: Maintenance tasks (e.g., `chore/update-deps`)
- **revert/**: Reverting changes (e.g., `revert/feature-name`)

## Typical Workflow

### 1. Starting New Work
```bash
# Make sure you're on master
git checkout master

# Get latest changes
git pull origin master

# Create new branch
git checkout -b feat/new-feature-name

# Work on your feature...
```

### 2. Saving Your Work
```bash
# Check what changed
git status

# Add files
git add .

# Commit with clear message
git commit -m "feat: Add user profile photo upload"

# Push to GitHub
git push origin feat/new-feature-name
```

### 3. Creating a Pull Request (PR)

1. Go to GitHub: https://github.com/Qefaraki/alqefari-app-rn
2. Click "Pull requests" tab
3. Click "New pull request"
4. Select your branch to merge into master
5. Add title and description
6. Click "Create pull request"

### 4. After PR is Merged
```bash
# Switch back to master
git checkout master

# Get the latest changes
git pull origin master

# Delete your old branch locally
git branch -d feat/new-feature-name
```

## Commit Message Format

Use clear, descriptive commit messages:

```
type: Short description (50 chars or less)

Longer explanation if needed (wrap at 72 chars)

- Bullet points for multiple changes
- Another change
```

Types:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting)
- **refactor**: Code changes that don't fix bugs or add features
- **test**: Adding or fixing tests
- **chore**: Maintenance tasks

Examples:
```
feat: Add photo upload to profile editor
fix: Resolve zoom jumping on physical devices
docs: Update setup instructions
refactor: Extract LOD logic into separate hook
```

## Common Scenarios

### Scenario 1: Made changes but on wrong branch
```bash
git stash                     # Save changes temporarily
git checkout correct-branch   # Switch to right branch
git stash pop                # Apply saved changes
```

### Scenario 2: Want to undo last commit
```bash
git reset --soft HEAD~1  # Undo commit but keep changes
# or
git reset --hard HEAD~1  # Undo commit and discard changes
```

### Scenario 3: Update your branch with latest master
```bash
git checkout master
git pull origin master
git checkout your-branch
git merge master
```

### Scenario 4: See what changed
```bash
git diff                    # Unstaged changes
git diff --staged          # Staged changes
git log --oneline -10      # Last 10 commits
```

## GitHub Features

### Issues
- Report bugs or request features
- Discuss implementation details
- Track progress

### Pull Requests (PRs)
- Code review before merging
- Discussion about changes
- Automated tests can run
- Protects master branch

### Projects
- Kanban boards for task management
- Track progress across issues and PRs

## Best Practices

1. **Commit Often**: Small, focused commits are better than large ones
2. **Pull Before Push**: Always get latest changes before pushing
3. **Clear Messages**: Write descriptive commit messages
4. **One Feature Per Branch**: Keep branches focused
5. **Test Before Push**: Make sure code works
6. **Review PRs**: Check your code on GitHub after pushing

## Troubleshooting

### "Your branch is behind"
```bash
git pull origin branch-name
```

### "Merge conflicts"
1. Open conflicted files
2. Look for `<<<<<<<` markers
3. Choose which version to keep
4. Remove conflict markers
5. Commit the resolution

### "Permission denied"
Make sure you're logged in to GitHub:
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## Quick Reference

| Action | Command |
|--------|---------|
| See changes | `git status` |
| Switch branch | `git checkout branch-name` |
| Create branch | `git checkout -b new-branch` |
| Save changes | `git add . && git commit -m "message"` |
| Upload | `git push origin branch-name` |
| Download | `git pull origin branch-name` |
| See history | `git log --oneline` |
| Undo changes | `git checkout -- filename` |

## Our Repository

- **GitHub URL**: https://github.com/Qefaraki/alqefari-app-rn
- **Clone Command**: `git clone https://github.com/Qefaraki/alqefari-app-rn.git`

Remember: Git is a tool to help you, not to complicate things. Start simple and learn more commands as you need them!