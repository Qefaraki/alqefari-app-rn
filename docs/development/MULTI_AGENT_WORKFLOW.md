# Multi-Agent Git Workflow

## CRITICAL: End-of-Session Protocol

When user says "ending for today" or similar, IMMEDIATELY:
1. Check commit count: `git rev-list --count origin/master..HEAD`
2. If > 20 commits → MUST merge today to prevent divergence
3. Run full audit from `END_OF_SESSION_PROTOCOL.md`

## Branch Strategy

### One Branch Per Session/Feature

**Not per agent** - all agents in a session work on the same branch

**Rationale**:
- Prevents branch explosion
- Easier to track progress
- Simpler merge process
- Clear feature boundaries

**Example**:
```bash
# Good: One branch for feature
feature/phone-change-system

# Bad: Multiple branches for same feature
feature/phone-change-agent1
feature/phone-change-agent2
feature/phone-change-agent3
```

### Daily Merges

**Prevent divergence** by merging to master daily

**Schedule**:
- End of session: Check commit count
- > 20 commits: Mandatory merge before ending
- < 20 commits: Optional merge, but recommended

### Descriptive Commits

**Include agent context** in commit messages

**Format**:
```bash
feat(claude): Add phone number validation
fix(claude): Resolve tree photo freeze
docs(claude): Update migration workflow
```

**Benefits**:
- Track which agent made changes
- Debug issues by agent context
- Understand multi-agent collaboration

### Maximum 20 Commits

**Hard limit** before mandatory merge

**Why 20?**
- Prevents merge conflicts
- Ensures regular integration
- Reduces code review burden
- Maintains clean git history

**Enforcement**:
- Check at end of session
- Alert if approaching limit
- Force merge if exceeded

## Multi-Agent Collaboration

### Communication Between Agents

1. **Use commit messages** for async communication
2. **Update CLAUDE.md** for persistent changes
3. **Create docs** for detailed explanations
4. **Use branch names** for feature context

### Conflict Resolution

1. **Agent 1** starts feature on branch
2. **Agent 2** checks branch status before working
3. If conflicts arise:
   - Pull latest changes
   - Resolve conflicts locally
   - Test after merge
   - Commit resolution with note

### Handoff Protocol

When switching between agents:
1. **Commit all work** (never leave uncommitted changes)
2. **Update CLAUDE.md** with progress notes
3. **Create TODO list** in commit message
4. **Push to remote** for next agent

## Related Documentation

- [End of Session Protocol](./END_OF_SESSION_PROTOCOL.md) - Full audit checklist
- [Git Workflow](./GIT_WORKFLOW.md) - General git best practices
