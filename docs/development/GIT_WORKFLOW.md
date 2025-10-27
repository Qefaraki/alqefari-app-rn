# Git Workflow & Best Practices

## Commit Frequently

### CRITICAL: Always Save Your Work

```bash
# After EVERY feature/fix - commit immediately
git add -A
git commit -m "type: Clear description of changes"

# Commit types:
# feat: New feature
# fix: Bug fix
# docs: Documentation updates
# style: UI/styling changes
# refactor: Code restructuring
# test: Test additions/changes
```

## Git Best Practices

1. **Commit frequently** - After each working feature
2. **Never lose work** - Commit before switching tasks
3. **Clear messages** - Describe WHAT and WHY
4. **Update docs** - If you change functionality, update docs
5. **Check status** - `git status` before and after changes

## Documentation Updates

When you change code, update:
- `CLAUDE.md` - For design/system changes
- `README.md` - For major features
- Component comments - For complex logic

## Commit Message Examples

### Good Commit Messages
```bash
feat(auth): Add phone number validation
fix(tree): Resolve photo update freeze (O(n²)→O(1))
docs(migration): Update workflow with verification steps
refactor(tree): Extract node constants to separate file
```

### Bad Commit Messages
```bash
fix stuff
update
wip
changes
```

## Branch Naming

```bash
# Feature branches
feature/phone-change-system
feature/munasib-dashboard

# Fix branches
fix/tree-photo-freeze
fix/otp-rate-limit

# Refactor branches
refactor/treeview-phase1
refactor/progressive-loading

# Doc branches
docs/api-documentation
docs/migration-guide
```

## Related Documentation

- [Multi-Agent Workflow](./MULTI_AGENT_WORKFLOW.md) - Multi-agent git strategy
- [Migration Workflow](./MIGRATION_WORKFLOW_DETAILED.md) - Database migration commits
