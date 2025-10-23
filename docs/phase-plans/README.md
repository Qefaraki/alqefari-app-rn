# Phase Plans

This directory contains detailed low-level plans created BEFORE each phase begins.

## Purpose

Before starting any phase, Claude will:
1. Review phase goals from IMPLEMENTATION_PLAN.md
2. Create detailed daily breakdown
3. Identify risks and dependencies
4. Create phase-specific testing checklist
5. Commit plan for user review

## Structure

Each plan is named: `PHASE_X_PLAN.md`

Example:
```
PHASE_1_PLAN.md   # Detailed Foundation phase plan
PHASE_2_PLAN.md   # Detailed Visual polish phase plan
PHASE_3_PLAN.md   # Detailed Theme system phase plan
```

## Plan Template

Each plan includes:
- **Goals**: What this phase achieves
- **Daily Breakdown**: Hour-by-hour tasks
- **Files to Create**: Exact file paths and purposes
- **Files to Modify**: What changes and why
- **Testing Checklist**: Phase-specific tests
- **Rollback Strategy**: How to undo if needed
- **Estimated Duration**: Realistic time estimate

## Workflow

1. Claude creates detailed plan
2. User reviews plan (asks questions, adjusts)
3. Plan committed to git
4. Phase execution begins
5. Follow plan daily
6. Track deviations in plan document
