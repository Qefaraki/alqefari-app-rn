# Perfect Tree Implementation Plan

**Project:** Alqefari Family Tree - Perfect Tree Refactor
**Version:** 1.0
**Date:** January 2025
**Status:** Ready for Execution

---

## ⚠️ CRITICAL: Safety-First Approach

This is a **major architectural refactor** of the core TreeView component (3,817 lines). Every phase includes:

1. **Git Safety Net**: Commit + push before starting
2. **Backup Branch**: Create feature branch per phase
3. **Rollback Plan**: Clear instructions if things break
4. **Testing Checkpoint**: Validate before moving forward
5. **Production Safety**: Feature flags for new code

**Golden Rule:** If anything breaks, we can **always roll back** to the last working commit.

---

## 📊 Current Status Check

### Uncommitted Changes
```
- app.json (modified)
- ios/Alqefari/Info.plist (modified)
- src/components/TreeView.js (modified)
- src/components/admin/ChildListCard.js (modified)
- src/components/admin/QuickAddOverlay.js (modified)
- docs/PERFECT_TREE_SPECIFICATION.md (new)
- docs/SKIA_FEATURE_FEASIBILITY_REPORT.md (new)
- 2 backup files (*.backup-search-fix-*)
```

### Unpushed Commits
- 47 commits ahead of origin/master

### Action Required
**Phase 0** (Pre-Implementation) will handle all of this safely.

---

## 🎯 Implementation Overview

### Total Duration: 12-16 Weeks

| Phase | Duration | Risk Level | Can Rollback? |
|-------|----------|-----------|---------------|
| **Phase 0: Safety & Backup** | 1 day | 🟢 None | N/A |
| **Phase 1: Foundation** | 1 week | 🟢 Low | ✅ Yes |
| **Phase 2: Visual Polish** | 1 week | 🟡 Medium | ✅ Yes |
| **Phase 3: Theme System** | 1 week | 🟢 Low | ✅ Yes |
| **Phase 4: Gesture Refinement** | 3 days | 🟡 Medium | ✅ Yes |
| **Phase 5: Layout Engine** | 1 week | 🔴 High | ✅ Yes (with care) |
| **Phase 6: Highlighting System** | 2 weeks | 🟡 Medium | ✅ Yes |
| **Phase 7: Navigation System** | 2 weeks | 🟡 Medium | ✅ Yes |
| **Phase 8: Export System** | 2 weeks | 🟢 Low | ✅ Yes |
| **Phase 9: Modular Refactor** | 3 weeks | 🔴 High | ✅ Yes (incremental) |
| **Phase 10: Testing & Polish** | 2 weeks | 🟢 Low | N/A |

**Total Phases:** 10 (plus Phase 0)
**Flexibility:** Can pause between phases, rollback anytime

---

## 🔄 Phase Execution Protocol (MANDATORY FOR ALL PHASES)

### Before Each Phase

1. **Planning Session (30-60 mins)**
   - Review phase goals and deliverables
   - Break down into detailed daily tasks
   - Identify potential risks and blockers
   - Create phase-specific testing checklist
   - Commit plan to git

2. **Environment Check (10 mins)**
   - Verify all tests passing
   - Check git status is clean
   - Ensure on correct branch
   - Pull latest changes from remote

### After Each Phase

1. **Solution Audit (30-60 mins)**
   - Run solution-auditor agent
   - Review all code changes for:
     - Architecture violations
     - Performance regressions
     - Edge cases missed
     - Documentation gaps
     - Test coverage
   - Document findings in `docs/audits/PHASE_X_AUDIT.md`

2. **User Testing Pause (Mandatory)**
   - ⏸️ **STOP AND WAIT**
   - User tests all functionality (30-60 mins)
   - User reports any issues/bugs
   - No Phase X+1 work until user approves

3. **Fix Issues (Variable time)**
   - Address audit findings
   - Fix user-reported bugs
   - Re-run audit if changes significant
   - Commit all fixes

4. **Phase Completion**
   - All tests passing ✅
   - Audit findings resolved ✅
   - User approved ✅
   - Only then: Begin next phase planning

### Phase Workflow Summary

```
┌─────────────────────────────────────────────────────┐
│ 1. PLAN PHASE (30-60 mins)                         │
│    - Detailed breakdown                             │
│    - Commit plan                                    │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 2. EXECUTE PHASE (X days)                          │
│    - Daily commits                                  │
│    - Daily testing                                  │
│    - Push to remote                                 │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 3. RUN SOLUTION AUDITOR (30-60 mins)               │
│    - Automated code review                          │
│    - Document findings                              │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 4. ⏸️ PAUSE FOR USER TESTING (30-60 mins)         │
│    - User tests manually                            │
│    - User reports issues                            │
│    - NO PROCEEDING until user approves             │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 5. FIX ISSUES (Variable)                           │
│    - Address audit findings                         │
│    - Fix user-reported bugs                         │
│    - Re-audit if needed                             │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 6. PHASE COMPLETE ✅                                │
│    - Commit phase summary                           │
│    - Tag commit (phase-X-complete)                  │
│    - Ready for next phase                           │
└─────────────────────────────────────────────────────┘
```

**CRITICAL:** No phase begins until previous phase is user-approved.

---

## 🚨 Phase 0: Safety & Backup (DAY 1 - MANDATORY)

**Duration:** 1 day
**Risk:** 🟢 None (safety only)
**Goal:** Ensure everything is backed up and we can always recover

**Note:** Phase 0 is exempt from audit (no code changes), but requires user verification of backups.

### Step 0.1: Commit Current Work (30 mins)

```bash
# Add all modified files
git add app.json
git add ios/Alqefari/Info.plist
git add src/components/TreeView.js
git add src/components/admin/ChildListCard.js
git add src/components/admin/QuickAddOverlay.js

# Add new documentation
git add docs/PERFECT_TREE_SPECIFICATION.md
git add docs/SKIA_FEATURE_FEASIBILITY_REPORT.md

# Remove backup files (not needed in git)
rm src/components/TreeView.js.backup-search-fix-*

# Commit with descriptive message
git commit -m "docs: Add Perfect Tree specification and research

- Add comprehensive 25K-word specification document
- Add Skia feature feasibility research
- Document current TreeView state before refactor
- Update admin components (ChildListCard, QuickAddOverlay)
- Update iOS Info.plist and app.json

This commit represents the last working state before Perfect Tree
refactor begins. All features are functional and tested."

# Verify commit
git log -1 --stat
```

**Expected Output:**
```
commit abc123...
docs: Add Perfect Tree specification and research
...
6 files changed, 15000 insertions(+), 50 deletions(-)
```

### Step 0.2: Push to Remote (10 mins)

```bash
# Push all 47 unpushed commits + new commit
git push origin master

# Verify on GitHub/remote
# → Should see all commits, including latest documentation
```

**⚠️ STOP HERE IF PUSH FAILS**
- Resolve conflicts before proceeding
- Ensure remote is up to date

### Step 0.3: Create Backup Branch (5 mins)

```bash
# Create permanent backup of pre-refactor state
git branch backup/pre-perfect-tree-refactor

# Push backup branch to remote
git push origin backup/pre-perfect-tree-refactor

# Verify backup exists
git branch -a | grep backup
```

**Expected Output:**
```
backup/pre-perfect-tree-refactor
remotes/origin/backup/pre-perfect-tree-refactor
```

**Purpose:** If anything goes catastrophically wrong during refactor, we can:
```bash
git reset --hard backup/pre-perfect-tree-refactor
```

### Step 0.4: Create Development Branch (5 mins)

```bash
# Create feature branch for Perfect Tree work
git checkout -b feature/perfect-tree-implementation

# Push to remote
git push -u origin feature/perfect-tree-implementation

# Verify on correct branch
git branch --show-current
```

**Expected Output:**
```
feature/perfect-tree-implementation
```

**Strategy:** All Perfect Tree work happens on this branch. Master remains stable.

### Step 0.5: Tag Current State (5 mins)

```bash
# Create version tag
git tag -a v1.0-pre-refactor -m "Pre-Perfect Tree Refactor State

This tag marks the last commit before beginning the Perfect Tree
refactor project. All features are functional:
- Tree rendering with 56 nodes
- Search and highlighting
- Admin features (QuickAdd, MarriageEditor)
- Activity log with undo
- OTA updates configured

Use this tag to rollback if needed:
git checkout v1.0-pre-refactor"

# Push tag to remote
git push origin v1.0-pre-refactor

# Verify tag exists
git tag -l | grep pre-refactor
```

**Expected Output:**
```
v1.0-pre-refactor
```

### Step 0.6: Local Backup (10 mins)

```bash
# Create timestamped backup of entire project
cd /Users/alqefari/Desktop/
tar -czf AlqefariTreeRN-Backup-$(date +%Y%m%d-%H%M%S).tar.gz AlqefariTreeRN-Expo/

# Verify backup size (should be ~500MB)
ls -lh AlqefariTreeRN-Backup-*.tar.gz

# Move to safe location (external drive recommended)
# Optional: Upload to iCloud/Dropbox
```

**Purpose:** Ultimate safety net - entire project backed up locally.

### Step 0.7: Document Rollback Procedures (15 mins)

Create file: `docs/ROLLBACK_GUIDE.md`

```markdown
# Emergency Rollback Guide

If Perfect Tree refactor breaks something catastrophically:

## Level 1: Rollback Last Commit (30 seconds)
\`\`\`bash
git reset --hard HEAD~1
\`\`\`

## Level 2: Rollback to Phase Start (1 minute)
\`\`\`bash
# Find phase start commit
git log --oneline | grep "Phase"

# Rollback (replace abc123 with commit hash)
git reset --hard abc123
\`\`\`

## Level 3: Rollback to Pre-Refactor (2 minutes)
\`\`\`bash
git checkout v1.0-pre-refactor
# OR
git reset --hard backup/pre-perfect-tree-refactor
\`\`\`

## Level 4: Restore from Local Backup (10 minutes)
\`\`\`bash
cd /Users/alqefari/Desktop/
rm -rf AlqefariTreeRN-Expo/
tar -xzf AlqefariTreeRN-Backup-YYYYMMDD-HHMMSS.tar.gz
\`\`\`

## After Rollback
1. Run \`npm install\` (in case package.json changed)
2. Run \`npx expo prebuild --clean\` (if native changed)
3. Test on device to verify functionality
\`\`\`
```

### Step 0.8: Create Testing Checklist (15 mins)

Create file: `docs/TESTING_CHECKLIST.md`

```markdown
# Perfect Tree Testing Checklist

Test after EVERY phase to ensure nothing broke.

## Core Functionality (5 minutes)
- [ ] App launches without crash
- [ ] Tree renders with all 56 nodes
- [ ] Search works and highlights paths
- [ ] Can pan, zoom, pinch smoothly
- [ ] Tapping node opens ProfileSheet
- [ ] Photos load correctly

## Admin Features (3 minutes)
- [ ] Admin mode toggle works
- [ ] QuickAdd overlay opens (double-tap for admins)
- [ ] Can add child profile
- [ ] Changes save to Supabase

## Performance (2 minutes)
- [ ] No visible lag when panning
- [ ] Frame rate feels smooth (60fps)
- [ ] Memory usage normal (check Xcode Instruments)

## Edge Cases (2 minutes)
- [ ] RTL layout looks correct
- [ ] Arabic text renders properly
- [ ] Dark mode works (if implemented)
- [ ] Works on iPhone XR (minimum device)

**Total Time:** ~12 minutes per test
**Frequency:** After every phase commit
\`\`\`
```

### Step 0.9: Verify Development Environment (10 mins)

```bash
# Check all dependencies are installed
npm install

# Verify Expo SDK version
npx expo --version  # Should be 54+

# Check Skia version
npm list @shopify/react-native-skia  # Should be 2.2.12

# Test app launches
npm start

# Test on simulator/device
npm run ios  # OR npm run android
```

**Expected:** App launches, tree renders, no errors in console.

### Step 0.10: Phase 0 Completion Checkpoint

**Checklist:**
- ✅ All changes committed
- ✅ All commits pushed to remote
- ✅ Backup branch created (`backup/pre-perfect-tree-refactor`)
- ✅ Development branch created (`feature/perfect-tree-implementation`)
- ✅ Version tag created (`v1.0-pre-refactor`)
- ✅ Local backup created (`.tar.gz` file)
- ✅ Rollback guide documented
- ✅ Testing checklist created
- ✅ App verified working

**Commit Phase 0 Completion:**
```bash
git add docs/ROLLBACK_GUIDE.md
git add docs/TESTING_CHECKLIST.md

git commit -m "docs: Add rollback guide and testing checklist for Phase 0

Phase 0 (Safety & Backup) Complete:
- All changes committed and pushed
- Backup branch: backup/pre-perfect-tree-refactor
- Version tag: v1.0-pre-refactor
- Local backup created
- Emergency procedures documented

Ready to begin Phase 1 (Foundation)."

git push origin feature/perfect-tree-implementation
```

**Status:** 🟢 **SAFE TO PROCEED**

---

## 🏗️ Phase 1: Foundation (WEEK 1)

**Duration:** 5 days + planning + audit
**Risk:** 🟢 Low (infrastructure only, no behavior changes)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Set up modular structure, extract utilities, create types

---

### 📋 Phase 1 Planning Session (MUST DO BEFORE STARTING)

**When:** Before Day 1 begins
**Duration:** 30-60 mins
**Output:** `docs/phase-plans/PHASE_1_PLAN.md`

**User to Claude:** "Let's plan Phase 1 in detail"

**Claude will:**
1. Review Phase 1 goals from this document
2. Break down into hour-by-hour tasks
3. Create detailed file structure
4. Identify dependencies and risks
5. Create phase-specific testing checklist
6. Output complete plan to `docs/phase-plans/PHASE_1_PLAN.md`

**User then:**
- Reviews plan
- Asks questions or requests adjustments
- Approves plan

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_1_PLAN.md
git commit -m "plan: Phase 1 (Foundation) detailed plan

Breaks down Phase 1 into 5 days of tasks:
- Day 1: Module structure
- Day 2: Constants & utilities
- Day 3: TypeScript types
- Day 4: Update TreeView imports
- Day 5: Documentation

Ready to begin execution."
git push
```

---

### Pre-Phase Checklist
- ✅ Phase 0 completed
- ✅ Phase 1 plan created and committed
- ✅ On `feature/perfect-tree-implementation` branch
- ✅ App working (ran testing checklist)

### Day 1: Create Module Structure (4 hours)

**Task:** Create folder structure for modular architecture

```bash
# Create all folders
mkdir -p src/components/TreeView/rendering
mkdir -p src/components/TreeView/gestures
mkdir -p src/components/TreeView/viewport
mkdir -p src/components/TreeView/layout
mkdir -p src/components/TreeView/navigation
mkdir -p src/components/TreeView/highlighting
mkdir -p src/components/TreeView/export
mkdir -p src/components/TreeView/state
mkdir -p src/components/TreeView/ui-controls
mkdir -p src/components/TreeView/hooks
mkdir -p src/components/TreeView/utils
mkdir -p src/components/TreeView/types
```

**Commit:**
```bash
git add src/components/TreeView/

git commit -m "refactor(tree): Create modular folder structure (Phase 1 - Day 1)

Created 12 feature-based folders for TreeView modularization:
- rendering/ (8 planned modules)
- gestures/ (4 modules)
- viewport/ (4 modules)
- layout/ (5 modules)
- navigation/ (5 modules)
- highlighting/ (4 modules)
- export/ (5 modules)
- state/ (4 modules)
- ui-controls/ (5 modules)
- hooks/ (5 modules)
- utils/ (5 modules)
- types/ (5 modules)

No functionality changed. TreeView.js still monolithic.
Phase 1 - Day 1 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Run testing checklist (12 mins) - Should pass 100%

### Day 2: Extract Constants & Utilities (6 hours)

**Task 2.1: Extract Constants (2 hours)**

Create `src/components/TreeView/utils/constants.ts`:

```typescript
// File: src/components/TreeView/utils/constants.ts

/**
 * TreeView Constants
 * Centralized configuration for tree visualization
 */

// Viewport Culling Margins
export const VIEWPORT_MARGIN_X = 3000; // Covers ~30 siblings + gesture buffer
export const VIEWPORT_MARGIN_Y = 1200; // Covers ~10 generations + gesture buffer

// Node Dimensions
export const NODE_WIDTH_WITH_PHOTO = 85;
export const NODE_WIDTH_TEXT_ONLY = 60;
export const NODE_HEIGHT_WITH_PHOTO = 90;
export const NODE_HEIGHT_TEXT_ONLY = 35;
export const PHOTO_SIZE = 60;

// Visual Styling
export const LINE_COLOR = '#D1BBA340'; // Camel Hair Beige 40%
export const LINE_WIDTH = 2;
export const CORNER_RADIUS = 8;
export const SHADOW_OPACITY = 0.05; // Updated from 0.08 (2024 trend)
export const SHADOW_RADIUS = 8;

// Layout Spacing
export const DEFAULT_SIBLING_GAP = 120;
export const DEFAULT_GENERATION_GAP = 180;
export const MIN_SIBLING_GAP = 80;
export const MAX_SIBLING_GAP = 200;
export const MIN_GENERATION_GAP = 120;
export const MAX_GENERATION_GAP = 240;

// Performance
export const MAX_TREE_SIZE = 10000; // Frontend limit
export const WARNING_THRESHOLD = 7500; // 75% of max
export const CRITICAL_THRESHOLD = 9500; // 95% of max

// LOD Thresholds
export const LOD_T1_THRESHOLD = 0.48; // Full cards
export const LOD_T2_THRESHOLD = 0.24; // Text pills
// Below LOD_T2_THRESHOLD = Aggregation chips (T3)

// Image Buckets
export const IMAGE_BUCKETS = [40, 60, 80, 120, 256] as const;
export const DEFAULT_IMAGE_BUCKET = 80;
export const BUCKET_HYSTERESIS = 0.15; // ±15%

// Animation Durations (ms)
export const ANIMATION_DURATION_SHORT = 200;
export const ANIMATION_DURATION_MEDIUM = 400;
export const ANIMATION_DURATION_LONG = 600;

// Gesture Thresholds
export const GESTURE_ACTIVE_OFFSET = 5; // px before activation
export const GESTURE_DECELERATION = 0.998; // iOS default
export const GESTURE_RUBBER_BAND_FACTOR = 0.6;

// Zoom Limits
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;
export const DEFAULT_ZOOM = 1.0;
```

**Task 2.2: Extract Color Utilities (2 hours)**

Create `src/components/TreeView/utils/colorUtils.ts`:

```typescript
// File: src/components/TreeView/utils/colorUtils.ts

/**
 * Color utility functions for TreeView
 */

/**
 * Convert hex color to RGBA string
 * @param hex - Hex color (e.g., '#A13333')
 * @param alpha - Alpha value 0-1
 * @returns RGBA string (e.g., 'rgba(161, 51, 51, 0.5)')
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Dim color by percentage (for dark mode photos)
 * @param factor - Dimming factor (0.85 = 15% darker)
 * @returns ColorMatrix array for Skia
 */
export function createDimMatrix(factor: number = 0.85): number[] {
  return [
    factor, 0,      0,      0, 0,
    0,      factor, 0,      0, 0,
    0,      0,      factor, 0, 0,
    0,      0,      0,      1, 0,
  ];
}

/**
 * Convert color to grayscale (for deceased photos)
 * @returns ColorMatrix array for Skia
 */
export function createGrayscaleMatrix(): number[] {
  // Luminosity method (preserves brightness)
  const r = 0.2126;
  const g = 0.7152;
  const b = 0.0722;

  return [
    r, g, b, 0, 0,
    r, g, b, 0, 0,
    r, g, b, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Interpolate between two hex colors
 * @param color1 - Start color
 * @param color2 - End color
 * @param progress - 0 to 1
 * @returns Interpolated hex color
 */
export function interpolateColor(
  color1: string,
  color2: string,
  progress: number
): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

**Task 2.3: Extract Performance Monitor (2 hours)**

Create `src/components/TreeView/utils/performanceMonitor.ts`:

```typescript
// File: src/components/TreeView/utils/performanceMonitor.ts

/**
 * Performance monitoring utilities for TreeView
 */

interface PerformanceMetrics {
  layoutTime: number;
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
  fps: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    layoutTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    fps: 60,
  };

  /**
   * Log layout calculation time
   */
  logLayoutTime(duration: number, nodeCount: number) {
    this.metrics.layoutTime = duration;
    this.metrics.nodeCount = nodeCount;

    if (duration > 200) {
      console.warn(`[TreeView] ⚠️ Slow layout: ${duration}ms for ${nodeCount} nodes`);
    } else {
      console.log(`[TreeView] ✅ Layout: ${duration}ms for ${nodeCount} nodes`);
    }
  }

  /**
   * Log render time (frame time)
   */
  logRenderTime(duration: number) {
    this.metrics.renderTime = duration;

    const fps = 1000 / duration;
    this.metrics.fps = Math.round(fps);

    if (duration > 16.67) { // 60fps = 16.67ms per frame
      console.warn(`[TreeView] ⚠️ Frame drop: ${duration.toFixed(2)}ms (${fps.toFixed(1)} fps)`);
    }
  }

  /**
   * Log memory usage
   */
  logMemory(bytes: number) {
    const mb = bytes / 1024 / 1024;
    this.metrics.memoryUsage = mb;

    if (mb > 25) {
      console.warn(`[TreeView] ⚠️ High memory: ${mb.toFixed(1)}MB`);
    } else {
      console.log(`[TreeView] ✅ Memory: ${mb.toFixed(1)}MB`);
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Log all metrics as a summary
   */
  logSummary() {
    console.log('[TreeView] 📊 Performance Summary:', {
      layout: `${this.metrics.layoutTime}ms`,
      render: `${this.metrics.renderTime.toFixed(2)}ms`,
      memory: `${this.metrics.memoryUsage.toFixed(1)}MB`,
      nodes: this.metrics.nodeCount,
      fps: this.metrics.fps,
    });
  }
}

export default new PerformanceMonitor();
```

**Commit Day 2:**
```bash
git add src/components/TreeView/utils/

git commit -m "refactor(tree): Extract constants and utility functions (Phase 1 - Day 2)

Extracted from TreeView.js:
- constants.ts: All hardcoded values centralized
- colorUtils.ts: hexToRgba, grayscale, dim matrices
- performanceMonitor.ts: Logging and metrics

No functionality changed. TreeView.js still uses inline values.
Next: Update TreeView.js to import from utils.

Phase 1 - Day 2 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Run testing checklist - Should pass 100%

### Day 3: Create TypeScript Types (6 hours)

**Task 3.1: Core Types (2 hours)**

Create `src/components/TreeView/types/node.ts`:

```typescript
// File: src/components/TreeView/types/node.ts

/**
 * Node and Profile types for TreeView
 */

// Core Profile (from Supabase)
export interface Profile {
  id: string;
  hid: string | null;
  name: string;
  father_id: string | null;
  mother_id: string | null;
  generation: number;
  sibling_order: number | null;
  photo_url: string | null;
  deceased: boolean;
  birth_date: string | null;
  death_date: string | null;
  // ... (add other Supabase fields as needed)
}

// Layout Node (after d3-hierarchy calculation)
export interface LayoutNode extends Profile {
  x: number;
  y: number;
  depth: number;
  width: number;
  height: number;
  children?: LayoutNode[];
  parent?: LayoutNode;
}

// Rendered Node (with LOD info)
export interface RenderedNode extends LayoutNode {
  lodLevel: 'T1' | 'T2' | 'T3';
  imageBucket: number;
  opacity: number;
  isVisible: boolean;
}
```

Create `src/components/TreeView/types/viewport.ts`:

```typescript
// File: src/components/TreeView/types/viewport.ts

/**
 * Viewport and camera types
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Transform {
  translateX: number;
  translateY: number;
  scale: number;
}

export interface Camera extends Transform {
  targetX?: number;
  targetY?: number;
  targetScale?: number;
  isAnimating: boolean;
}
```

Create `src/components/TreeView/types/theme.ts`:

```typescript
// File: src/components/TreeView/types/theme.ts

/**
 * Theme and design token types
 */

export interface ColorTokens {
  // Backgrounds
  canvas: string;
  card: string;
  elevated: string;

  // Text
  primary: string;
  secondary: string;
  tertiary: string;
  onPrimary: string;

  // Actions
  actionPrimary: string;
  actionSecondary: string;

  // Tree-specific
  nodeFill: string;
  nodeStroke: string;
  nodeStrokeSelected: string;
  lineConnection: string;
  lineHighlight: string;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface TypographyToken {
  size: number;
  weight: string;
  lineHeight: number;
}

export interface TypographyTokens {
  largeTitle: TypographyToken;
  title1: TypographyToken;
  body: TypographyToken;
  footnote: TypographyToken;
  caption: TypographyToken;
}

export interface ThemeTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
}

export type ThemeMode = 'light' | 'dark' | 'auto';
```

**Task 3.2: Index Exports (1 hour)**

Create `src/components/TreeView/types/index.ts`:

```typescript
// File: src/components/TreeView/types/index.ts

/**
 * TreeView TypeScript type definitions
 * Central export point for all types
 */

export * from './node';
export * from './viewport';
export * from './theme';
export * from './gesture';
export * from './highlight';
```

**Commit Day 3:**
```bash
git add src/components/TreeView/types/

git commit -m "refactor(tree): Create TypeScript type definitions (Phase 1 - Day 3)

Created comprehensive type system:
- node.ts: Profile, LayoutNode, RenderedNode
- viewport.ts: Point, Rect, Bounds, Camera, Transform
- theme.ts: ThemeTokens, ColorTokens, SpacingTokens
- index.ts: Central export point

No functionality changed. Types ready for migration.
Phase 1 - Day 3 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** TypeScript compilation should pass (no errors)

### Day 4: Update TreeView.js Imports (4 hours)

**Task:** Replace inline constants with imports

```javascript
// File: src/components/TreeView.js (TOP OF FILE)

// ADD THESE IMPORTS:
import {
  VIEWPORT_MARGIN_X,
  VIEWPORT_MARGIN_Y,
  NODE_WIDTH_WITH_PHOTO,
  NODE_WIDTH_TEXT_ONLY,
  NODE_HEIGHT_WITH_PHOTO,
  NODE_HEIGHT_TEXT_ONLY,
  PHOTO_SIZE,
  LINE_COLOR,
  LINE_WIDTH,
  SHADOW_OPACITY,
  DEFAULT_SIBLING_GAP,
  DEFAULT_GENERATION_GAP,
  LOD_T1_THRESHOLD,
  LOD_T2_THRESHOLD,
} from './TreeView/utils/constants';

import { hexToRgba, createGrayscaleMatrix, createDimMatrix } from './TreeView/utils/colorUtils';
import performanceMonitor from './TreeView/utils/performanceMonitor';

// REMOVE OLD CONSTANTS (lines 90-100):
// const VIEWPORT_MARGIN_X = 3000; // DELETE
// const VIEWPORT_MARGIN_Y = 1200; // DELETE
// ... (delete all constants now imported)

// UPDATE USAGES:
// Find: hexToRgba('#A13333', 0.5)
// Replace: hexToRgba(tokens.colors.najdiCrimson, 0.5)

// Add performance logging:
// After layout calculation:
performanceMonitor.logLayoutTime(duration, nodes.length);
```

**Commit Day 4:**
```bash
git add src/components/TreeView.js

git commit -m "refactor(tree): Migrate TreeView to use constants and utils (Phase 1 - Day 4)

Updated TreeView.js:
- Import all constants from utils/constants
- Import color utilities from utils/colorUtils
- Import performanceMonitor for logging
- Remove inline constant definitions (90-100 lines removed)
- Add performance logging after layout calculation

Functionality unchanged. All tests should pass.
Phase 1 - Day 4 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Run full testing checklist (12 mins) - MUST PASS 100%

### Day 5: Documentation & Phase 1 Completion (2 hours)

**Task 5.1: Update CLAUDE.md**

Add to `CLAUDE.md`:

```markdown
## 🏗 Modular Architecture (Phase 1 Complete)

TreeView has been refactored into a modular architecture:

### File Structure
\`\`\`
src/components/TreeView/
├── TreeView.js (main orchestrator, 3,600 lines)
├── utils/
│   ├── constants.ts (all hardcoded values)
│   ├── colorUtils.ts (color transformations)
│   ├── performanceMonitor.ts (logging)
│   └── index.ts (exports)
├── types/
│   ├── node.ts (Profile, LayoutNode types)
│   ├── viewport.ts (Camera, Bounds types)
│   ├── theme.ts (ThemeTokens types)
│   └── index.ts (exports)
└── [8 more folders for future phases]
\`\`\`

### Usage
\`\`\`typescript
import { VIEWPORT_MARGIN_X, LINE_COLOR } from './TreeView/utils/constants';
import { hexToRgba, createGrayscaleMatrix } from './TreeView/utils/colorUtils';
import type { LayoutNode, Camera } from './TreeView/types';
\`\`\`
```

**Task 5.2: Phase 1 Summary**

Create `docs/PHASE_1_SUMMARY.md`:

```markdown
# Phase 1: Foundation - Completion Report

**Status:** ✅ Complete
**Duration:** 5 days
**Risk Level:** 🟢 Low
**Rollback Status:** Not needed (all tests passing)

## Accomplishments

### Infrastructure
- ✅ Created 12 modular folders
- ✅ Extracted 3 utility modules (constants, colorUtils, performanceMonitor)
- ✅ Created 5 TypeScript type definitions
- ✅ Migrated TreeView.js to use imports

### Code Quality
- **Lines Removed:** 100 (inline constants)
- **Lines Added:** 350 (utilities + types)
- **Net Change:** +250 lines (more maintainable)
- **TypeScript Coverage:** 15% (types only, no migration yet)

### Testing
- **Tests Run:** 5 (after each day)
- **Pass Rate:** 100%
- **Regressions:** 0
- **Performance:** No change (as expected)

## Files Changed
- `src/components/TreeView.js` (modified)
- `src/components/TreeView/utils/constants.ts` (created)
- `src/components/TreeView/utils/colorUtils.ts` (created)
- `src/components/TreeView/utils/performanceMonitor.ts` (created)
- `src/components/TreeView/types/` (5 files created)

## Next Phase
Phase 2: Visual Polish (curved lines, subtle shadows, photo dimming)
```

**Final Commit:**
```bash
git add docs/PHASE_1_SUMMARY.md
git add CLAUDE.md

git commit -m "docs: Phase 1 (Foundation) complete

✅ Modular folder structure created
✅ Constants extracted to utils/constants.ts
✅ Color utilities created
✅ Performance monitoring added
✅ TypeScript types defined
✅ TreeView.js migrated to use imports
✅ All tests passing (100%)

Next: Phase 2 (Visual Polish)

Phase 1 Complete."

git push origin feature/perfect-tree-implementation
```

**Phase 1 Checkpoint:**
- ✅ All code committed and pushed
- ✅ Testing checklist passed 100%
- ✅ Documentation updated
- ✅ Can rollback if needed (`git reset --hard` to phase start)

---

### 🔍 Phase 1 Solution Audit (MANDATORY - DO NOT SKIP)

**When:** After Day 5 completion, before Phase 2 planning
**Duration:** 30-60 mins
**Output:** `docs/audits/PHASE_1_AUDIT.md`

**User to Claude:** "Run solution auditor for Phase 1"

**Claude will:**
1. Launch solution-auditor agent
2. Review all Phase 1 changes:
   - `src/components/TreeView/` (new folders)
   - `src/components/TreeView/utils/` (3 files created)
   - `src/components/TreeView/types/` (5 files created)
   - `src/components/TreeView.js` (imports updated)
3. Check for:
   - ❌ Architecture violations
   - ❌ Performance regressions
   - ❌ Missing error handling
   - ❌ Incomplete TypeScript types
   - ❌ Documentation gaps
4. Create audit report with findings

**Commit audit:**
```bash
git add docs/audits/PHASE_1_AUDIT.md
git commit -m "audit: Phase 1 (Foundation) solution audit

Solution auditor reviewed Phase 1 changes:
- Findings: [X issues found / No issues]
- Status: [✅ Pass / ⚠️ Minor issues / 🔴 Major issues]

See audit report for details."
git push
```

---

### ⏸️ Phase 1 User Testing (MANDATORY PAUSE)

**⚠️ STOP HERE. DO NOT PROCEED TO PHASE 2 PLANNING.**

**User Actions:**
1. **Read audit report** (`docs/audits/PHASE_1_AUDIT.md`)
2. **Pull latest code** (`git pull`)
3. **Run app on device** (`npm run ios` or `npm run android`)
4. **Test all functionality:**
   - App launches without crash
   - Tree renders correctly (all 56 nodes)
   - Search works
   - Pan/zoom works
   - Performance feels same (no lag)
   - Admin features work (QuickAdd, etc.)
5. **Report issues** to Claude:
   - "Found bug: [description]"
   - "Performance regression: [details]"
   - "Looks good, approve Phase 1"

**Duration:** 30-60 mins (user testing time)

---

### 🔧 Phase 1 Issue Resolution (IF NEEDED)

**If audit or user found issues:**

```bash
# Create issue fix branch
git checkout -b fix/phase-1-issues

# Claude fixes issues based on audit + user feedback
# ... make changes ...

# Commit fixes
git add .
git commit -m "fix(phase-1): Address audit findings and user issues

Fixed:
- Issue #1: [description]
- Issue #2: [description]

All tests passing. Ready for re-audit."
git push

# Merge back to feature branch
git checkout feature/perfect-tree-implementation
git merge fix/phase-1-issues
git push
```

**Re-run audit if changes significant:**
- User to Claude: "Re-audit Phase 1 fixes"
- Claude runs solution-auditor again
- Repeat until clean

---

### ✅ Phase 1 Completion Sign-Off

**Required before Phase 2:**
- ✅ Solution audit passed (no major issues)
- ✅ User tested and approved
- ✅ All issues fixed
- ✅ Code committed and pushed

**Tag completion:**
```bash
git tag -a phase-1-complete -m "Phase 1 (Foundation) Complete

✅ Modular folder structure created
✅ Constants and utilities extracted
✅ TypeScript types defined
✅ TreeView.js migrated to imports
✅ Solution audit passed
✅ User testing passed

Safe to proceed to Phase 2 (Visual Polish)."

git push origin phase-1-complete
```

**Status:** 🟢 **READY FOR PHASE 2 PLANNING**

---

## 🎨 Phase 2: Visual Polish (WEEK 2)

**Duration:** 5 days
**Risk:** 🟡 Medium (visual changes, could affect rendering)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Curved Bézier lines, subtle shadows, grayscale photos

### Pre-Phase Checklist
- ✅ Phase 1 completed
- ✅ All tests passing
- ✅ On `feature/perfect-tree-implementation` branch

### Day 1: Curved Bézier Connection Lines (6 hours)

**Task:** Replace straight lines with smooth S-curves

Create `src/components/TreeView/utils/pathCalculation.ts`:

```typescript
// File: src/components/TreeView/utils/pathCalculation.ts

import { Skia } from '@shopify/react-native-skia';
import type { Point } from '../types';

/**
 * Calculate smooth cubic Bézier curve for parent-child connection
 * Creates natural S-curve commonly used in tree visualizations
 *
 * @param source - Parent node position
 * @param target - Child node position
 * @returns Skia Path object with smooth curve
 */
export function calculateCubicBezierPath(
  source: Point,
  target: Point
): any {
  const path = Skia.Path.Make();

  // Start at parent bottom center
  path.moveTo(source.x, source.y);

  // Control points at 50% vertical distance (creates S-curve)
  const midY = source.y + (target.y - source.y) * 0.5;

  const controlPoint1 = {
    x: source.x,
    y: midY
  };

  const controlPoint2 = {
    x: target.x,
    y: midY
  };

  // Cubic Bézier curve to child top center
  path.cubicTo(
    controlPoint1.x, controlPoint1.y,
    controlPoint2.x, controlPoint2.y,
    target.x, target.y
  );

  return path;
}

/**
 * Calculate path for horizontal tree orientation
 */
export function calculateHorizontalBezierPath(
  source: Point,
  target: Point
): any {
  const path = Skia.Path.Make();

  path.moveTo(source.x, source.y);

  // Control points at 50% horizontal distance
  const midX = source.x + (target.x - source.x) * 0.5;

  path.cubicTo(
    midX, source.y,
    midX, target.y,
    target.x, target.y
  );

  return path;
}
```

**Update TreeView.js** (around line 1200-1300):

```javascript
// OLD (straight lines):
<Line
  p1={vec(parentX, parentY)}
  p2={vec(childX, childY)}
  color={LINE_COLOR}
  strokeWidth={LINE_WIDTH}
/>

// NEW (curved Bézier):
import { calculateCubicBezierPath } from './TreeView/utils/pathCalculation';

const connectionPath = useMemo(() =>
  calculateCubicBezierPath(
    { x: parentX, y: parentY },
    { x: childX, y: childY }
  ),
  [parentX, parentY, childX, childY]
);

<Path
  path={connectionPath}
  color={LINE_COLOR}
  style="stroke"
  strokeWidth={LINE_WIDTH}
/>
```

**Commit Day 1:**
```bash
git add src/components/TreeView/utils/pathCalculation.ts
git add src/components/TreeView.js

git commit -m "feat(tree): Replace straight lines with curved Bézier paths (Phase 2 - Day 1)

Implemented smooth S-curves for parent-child connections:
- Created pathCalculation.ts with cubic Bézier algorithm
- Control points at 50% vertical distance (industry standard)
- Updated TreeView.js to use Path component instead of Line
- Memoized path calculation for performance

Visual upgrade: Tree now looks more organic and polished.
All tests passing.

Phase 2 - Day 1 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Visual inspection - Lines should curve smoothly. Performance should be same.

### Day 2: Subtle Shadow Refinement (2 hours)

**Task:** Reduce shadow opacity from 0.08 to 0.05

**Update constants:**

```typescript
// File: src/components/TreeView/utils/constants.ts

// OLD:
export const SHADOW_OPACITY = 0.08;

// NEW:
export const SHADOW_OPACITY = 0.05; // 2024 design trend: more subtle
export const SHADOW_RADIUS = 8;
export const SHADOW_OFFSET_Y = 2;
```

**Update TreeView.js** (node rendering):

```javascript
// Find BoxShadow usage (~line 800)
<BoxShadow
  dx={0}
  dy={SHADOW_OFFSET_Y}
  blur={SHADOW_RADIUS}
  color={hexToRgba('#000', SHADOW_OPACITY)} // Now 0.05 instead of 0.08
/>
```

**Commit Day 2:**
```bash
git add src/components/TreeView/utils/constants.ts
git add src/components/TreeView.js

git commit -m "style(tree): Reduce shadow opacity for modern look (Phase 2 - Day 2)

Updated shadow system:
- Opacity: 0.08 → 0.05 (38% reduction)
- Follows 2024 design trend: subtle elevation
- Matches Material Design 3 and iOS guidelines

Visual result: Cleaner, less heavy appearance.
All tests passing.

Phase 2 - Day 2 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Visual inspection - Shadows should be noticeably more subtle.

### Day 3-4: Photo Grayscale for Deceased (8 hours)

**Task 3.1: Create Photo Renderer Module (4 hours)**

Create `src/components/TreeView/rendering/PhotoRenderer.tsx`:

```typescript
// File: src/components/TreeView/rendering/PhotoRenderer.tsx

import React, { useMemo } from 'react';
import { Image as SkiaImage, ColorMatrix, Circle, Mask } from '@shopify/react-native-skia';
import { useBatchedSkiaImage } from '../hooks/useBatchedSkiaImage';
import { createGrayscaleMatrix, createDimMatrix } from '../utils/colorUtils';
import type { Profile } from '../types';

interface PhotoRendererProps {
  node: Profile;
  x: number;
  y: number;
  size: number;
  theme: 'light' | 'dark';
}

export const PhotoRenderer: React.FC<PhotoRendererProps> = ({
  node,
  x,
  y,
  size,
  theme,
}) => {
  const image = useBatchedSkiaImage(node.photo_url, size, 'visible');

  // Apply grayscale for deceased
  const colorMatrix = useMemo(() => {
    if (node.deceased) {
      return createGrayscaleMatrix();
    }
    if (theme === 'dark') {
      return createDimMatrix(0.85); // 15% dimmer
    }
    return null;
  }, [node.deceased, theme]);

  if (!image) return null;

  const radius = size / 2;

  return (
    <Mask
      mask={
        <Circle cx={x + radius} cy={y + radius} r={radius} color="white" />
      }
    >
      <SkiaImage
        image={image}
        x={x}
        y={y}
        width={size}
        height={size}
        fit="cover"
      >
        {colorMatrix && <ColorMatrix matrix={colorMatrix} />}
      </SkiaImage>
    </Mask>
  );
};
```

**Task 3.2: Add Deceased Indicator (2 hours)**

Update PhotoRenderer to optionally show "الله يرحمه":

```typescript
// Add to PhotoRenderer.tsx

import { Text as SkiaText, Paragraph } from '@shopify/react-native-skia';

// Add optional prop:
interface PhotoRendererProps {
  // ... existing props
  showDeceasedLabel?: boolean; // From settings
}

// After photo rendering:
{node.deceased && showDeceasedLabel && (
  <Paragraph
    paragraph={createParagraph(
      'الله يرحمه',
      11, // font size
      '#6B7280' // gray color
    )}
    x={x}
    y={y + size + 4} // Below photo
    width={size}
  />
)}
```

**Task 3.3: Integrate PhotoRenderer (2 hours)**

Update TreeView.js to use PhotoRenderer:

```javascript
// Import
import { PhotoRenderer } from './TreeView/rendering/PhotoRenderer';

// Replace inline photo rendering with:
<PhotoRenderer
  node={node}
  x={photoX}
  y={photoY}
  size={PHOTO_SIZE}
  theme={activeTheme}
  showDeceasedLabel={settings.showDeceasedLabel} // From settings context
/>
```

**Commit Day 3-4:**
```bash
git add src/components/TreeView/rendering/PhotoRenderer.tsx
git add src/components/TreeView.js

git commit -m "feat(tree): Add grayscale photos and deceased indicators (Phase 2 - Day 3-4)

Implemented deceased profile treatment:
- Created PhotoRenderer component
- Auto-apply grayscale to deceased photos (ColorMatrix)
- Optional 'الله يرحمه' label below photo (user setting)
- Dark mode: Dim all photos by 15% (existing functionality)

Extracted photo rendering logic from TreeView.js (first modular component!).
All tests passing.

Phase 2 - Day 3-4 complete."

git push origin feature/perfect-tree-implementation
```

**Test:** Check deceased profiles show grayscale. Test dark mode dimming.

### Day 5: Phase 2 Summary & Documentation (2 hours)

**Commit:**
```bash
git add docs/PHASE_2_SUMMARY.md

git commit -m "docs: Phase 2 (Visual Polish) complete

✅ Curved Bézier connection lines
✅ Subtle shadow refinement (0.08 → 0.05)
✅ Grayscale photos for deceased
✅ Optional deceased label ('الله يرحمه')
✅ Photo rendering extracted to PhotoRenderer component
✅ All tests passing (100%)

Next: Phase 3 (Theme System)

Phase 2 Complete."

git push origin feature/perfect-tree-implementation
```

---

### 📋 Phase 2 Planning Session (MUST DO BEFORE STARTING)

**When:** Before Day 1 begins
**Duration:** 30-60 mins
**Output:** `docs/phase-plans/PHASE_2_PLAN.md`

**User to Claude:** "Let's plan Phase 2 in detail"

**Claude will:**
1. Review Phase 2 goals (curved lines, shadows, photos)
2. Break down into hour-by-hour tasks
3. Create detailed implementation steps
4. Identify visual design risks
5. Create phase-specific testing checklist
6. Output complete plan to `docs/phase-plans/PHASE_2_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_2_PLAN.md
git commit -m "plan: Phase 2 (Visual Polish) detailed plan"
git push
```

---

### 🔍 Phase 2 Solution Audit (MANDATORY - DO NOT SKIP)

**When:** After Day 5 completion, before Phase 3 planning
**Duration:** 30-60 mins
**Output:** `docs/audits/PHASE_2_AUDIT.md`

**User to Claude:** "Run solution auditor for Phase 2"

**Claude will:**
1. Launch solution-auditor agent
2. Review all Phase 2 changes:
   - `src/components/TreeView/utils/pathCalculation.ts` (curved lines)
   - `src/components/TreeView/rendering/PhotoRenderer.tsx` (photos)
   - `src/components/TreeView/utils/constants.ts` (shadow update)
   - `src/components/TreeView.js` (integrations)
3. Check for:
   - ❌ Visual regression bugs
   - ❌ Performance impact of Bézier curves
   - ❌ Memory leaks from photo rendering
   - ❌ Dark mode compatibility
   - ❌ RTL layout issues
4. Create audit report with findings

**Commit audit:**
```bash
git add docs/audits/PHASE_2_AUDIT.md
git commit -m "audit: Phase 2 (Visual Polish) solution audit"
git push
```

---

### ⏸️ Phase 2 User Testing (MANDATORY PAUSE)

**⚠️ STOP HERE. DO NOT PROCEED TO PHASE 3 PLANNING.**

**User Actions:**
1. **Read audit report** (`docs/audits/PHASE_2_AUDIT.md`)
2. **Pull latest code** (`git pull`)
3. **Test visual changes:**
   - Curved lines look smooth (not jaggy)
   - Shadows are subtle (not too dark)
   - Deceased photos show grayscale
   - Deceased label appears (if enabled in settings)
   - Dark mode photos are dimmed
   - Performance still 60fps (no lag)
4. **Report issues or approve:**
   - "Found bug: [description]"
   - "Visual issue: [details]"
   - "Looks great, approve Phase 2"

**Duration:** 30-60 mins (user testing time)

---

### 🔧 Phase 2 Issue Resolution (IF NEEDED)

**If audit or user found issues:**

```bash
# Create issue fix branch
git checkout -b fix/phase-2-issues

# Claude fixes issues
# ... make changes ...

# Commit fixes
git add .
git commit -m "fix(phase-2): Address visual issues and audit findings"
git push

# Merge back
git checkout feature/perfect-tree-implementation
git merge fix/phase-2-issues
git push
```

**Re-run audit if changes significant.**

---

### ✅ Phase 2 Completion Sign-Off

**Required before Phase 3:**
- ✅ Solution audit passed (no major issues)
- ✅ User tested and approved
- ✅ All visual bugs fixed
- ✅ Performance still 60fps
- ✅ Code committed and pushed

**Tag completion:**
```bash
git tag -a phase-2-complete -m "Phase 2 (Visual Polish) Complete

✅ Curved Bézier connection lines
✅ Subtle shadow refinement (0.08 → 0.05)
✅ Grayscale photos for deceased
✅ PhotoRenderer component extracted
✅ Solution audit passed
✅ User testing passed

Safe to proceed to Phase 3 (Theme System)."

git push origin phase-2-complete
```

**Status:** 🟢 **READY FOR PHASE 3 PLANNING**

---

## ⏸️ PAUSE POINT: Review Before Continuing

**Before Phase 3, ask yourself:**

1. ✅ Are all Phase 1-2 changes working correctly?
2. ✅ Have you tested on a real device (not just simulator)?
3. ✅ Is performance still 60fps?
4. ✅ Do you want to continue immediately or take a break?

**Option to Merge to Master:**

If you want to ship these improvements now:

```bash
# Create pull request
git push origin feature/perfect-tree-implementation

# On GitHub:
# 1. Create PR: feature/perfect-tree-implementation → master
# 2. Review changes (should be ~15 files modified)
# 3. Merge PR
# 4. Delete feature branch
# 5. Create new branch for Phase 3+
```

**Or Continue on Same Branch:**

Proceed to Phase 3 planning when ready.

---

## 🎨 Phase 3: Theme System (WEEK 3)

**Duration:** 5 days + planning + audit
**Risk:** 🟢 Low (additive feature, doesn't break existing)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Light/dark theme toggle with design tokens

---

### 📋 Phase 3 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 3 in detail"

**Output:** `docs/phase-plans/PHASE_3_PLAN.md`

**Claude will create:** Detailed plan for theme system implementation (token architecture, MMKV persistence, theme toggle UI, dark mode colors)

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_3_PLAN.md
git commit -m "plan: Phase 3 (Theme System) detailed plan"
git push
```

---

### Pre-Phase Checklist
- ✅ Phase 2 completed and tagged
- ✅ All tests passing
- ✅ On `feature/perfect-tree-implementation` branch

### High-Level Tasks (Detailed in phase plan)

**Day 1-2:** Design Token System
- Create `src/components/TreeView/theme/tokens.ts` (reference tokens)
- Create `src/components/TreeView/theme/semantic.ts` (semantic mappings)
- Create `src/components/TreeView/theme/ThemeContext.tsx`

**Day 3:** MMKV Persistence
- Install `react-native-mmkv` if not present
- Create `src/components/TreeView/theme/themeStorage.ts`
- Persist user's theme preference

**Day 4:** Theme Toggle UI
- Add toggle to tree controls (sun/moon icon)
- Animate theme transition (fade effect)
- Update all color references to use tokens

**Day 5:** Documentation & testing
- Update CLAUDE.md with theme system docs
- Create Phase 3 summary
- Test on device (light/dark switching)

**Commit Phase 3:**
```bash
git commit -m "feat(tree): Complete theme system with light/dark modes (Phase 3)

✅ Design token architecture (3-tier)
✅ MMKV persistence of theme preference
✅ Theme toggle UI in tree controls
✅ All colors now use semantic tokens
✅ Smooth theme transition animations

All tests passing.
Phase 3 Complete."
git push origin feature/perfect-tree-implementation
```

---

### 🔍 Phase 3 Solution Audit (MANDATORY)

**User to Claude:** "Run solution auditor for Phase 3"

**Output:** `docs/audits/PHASE_3_AUDIT.md`

**Audit checks:**
- Theme token architecture follows best practices
- Dark mode colors have sufficient contrast (WCAG AA)
- Theme persistence works across app restarts
- No hardcoded colors remaining
- Performance impact of theme switching

---

### ⏸️ Phase 3 User Testing (MANDATORY PAUSE)

**User tests:**
- Toggle between light/dark themes
- Verify tree colors look good in both modes
- Restart app - theme preference persists
- Check deceased photos dim correctly in dark mode
- Verify 60fps performance unchanged

---

### ✅ Phase 3 Completion Sign-Off

```bash
git tag -a phase-3-complete -m "Phase 3 (Theme System) Complete"
git push origin phase-3-complete
```

**Status:** 🟢 **READY FOR PHASE 4 PLANNING**

---

## 🤏 Phase 4: Gesture Refinement (WEEK 4 - FIRST 3 DAYS)

**Duration:** 3 days + planning + audit
**Risk:** 🟡 Medium (touches core interaction, could break gestures)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Rubber banding, momentum decay, boundary awareness

---

### 📋 Phase 4 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 4 in detail"

**Output:** `docs/phase-plans/PHASE_4_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_4_PLAN.md
git commit -m "plan: Phase 4 (Gesture Refinement) detailed plan"
git push
```

---

### High-Level Tasks

**Day 1:** Rubber Banding
- Create `src/components/TreeView/gestures/RubberBanding.ts`
- Apply 0.6 resistance factor at boundaries
- Test on device (feels like iOS)

**Day 2:** Momentum Decay
- Update pan gesture handler with `deceleration: 0.998`
- Add spring physics to animations (`withSpring`)
- Test smooth scrolling

**Day 3:** Boundary Awareness
- Calculate tree bounds dynamically
- Prevent panning beyond tree edges
- Add subtle bounce animation at edges

**Commit Phase 4:**
```bash
git commit -m "feat(tree): Refine gestures with iOS-quality physics (Phase 4)

✅ Rubber banding at boundaries (0.6 factor)
✅ Momentum decay (0.998 deceleration)
✅ Boundary awareness (no infinite panning)
✅ Spring physics for smooth animations

Gestures now feel native iOS quality.
Phase 4 Complete."
git push
```

---

### 🔍 Phase 4 Solution Audit (MANDATORY)

**Audit checks:**
- Gesture handling doesn't interfere with node taps
- Rubber banding feels natural (not too stiff/loose)
- Momentum decay is smooth (no abrupt stops)
- Performance still 60fps during fast panning

---

### ⏸️ Phase 4 User Testing (MANDATORY PAUSE)

**Critical:** Test on **real device** (gestures don't work well in simulator)

**User tests:**
- Fast pan - should decelerate smoothly
- Pan to edge - should rubber band and bounce back
- Pinch zoom while panning - should feel coordinated
- Verify no accidental node taps during fast pan

---

### ✅ Phase 4 Completion Sign-Off

```bash
git tag -a phase-4-complete -m "Phase 4 (Gesture Refinement) Complete"
git push origin phase-4-complete
```

**Status:** 🟢 **READY FOR PHASE 5 PLANNING**

---

## 📐 Phase 5: Layout Engine (WEEK 4-5)

**Duration:** 5 days + planning + audit
**Risk:** 🔴 High (replaces core layout algorithm)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Van der Ploeg algorithm for 20-30% more compact trees

---

### 📋 Phase 5 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 5 in detail"

**Output:** `docs/phase-plans/PHASE_5_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_5_PLAN.md
git commit -m "plan: Phase 5 (Layout Engine) detailed plan"
git push
```

---

### ⚠️ High-Risk Phase - Extra Caution

**Why risky:**
- Replaces d3.hierarchy layout algorithm
- Affects every node's position
- Could break existing saved tree views
- Performance regression risk

**Mitigation:**
- Feature flag: `USE_VAN_DER_PLOEG_LAYOUT` (default false)
- Parallel implementation (old algorithm stays functional)
- Extensive testing before making default
- Easy rollback plan

---

### High-Level Tasks

**Day 1-2:** Implement Van der Ploeg Algorithm
- Create `src/components/TreeView/layout/VanDerPloegLayout.ts`
- Port algorithm from academic paper (2013)
- Handle variable node widths (photos vs text-only)
- Unit tests for layout correctness

**Day 3:** Integration with TreeView
- Add feature flag to constants
- Wire up layout engine selection
- Compare old vs new layouts side-by-side

**Day 4:** Testing & Tuning
- Test with 56 nodes (current tree)
- Test with 1000 nodes (stress test)
- Measure compactness improvement
- Ensure no visual bugs

**Day 5:** Documentation & Migration
- Document algorithm choice in CLAUDE.md
- Create migration guide if layout changes
- Make new algorithm default (if tests pass)

**Commit Phase 5:**
```bash
git commit -m "feat(tree): Implement Van der Ploeg layout algorithm (Phase 5)

✅ Van der Ploeg's O(n) layout algorithm (2013)
✅ Handles variable node widths
✅ 20-30% more compact than Reingold-Tilford
✅ Feature flag for safety (USE_VAN_DER_PLOEG_LAYOUT)
✅ Extensive testing (56 nodes + 1000 node stress test)

Tree is now more compact and efficient.
Phase 5 Complete."
git push
```

---

### 🔍 Phase 5 Solution Audit (MANDATORY)

**Critical audit checks:**
- Layout algorithm correctness (no overlapping nodes)
- Performance: O(n) time complexity verified
- Memory usage doesn't increase significantly
- Rollback plan tested and works
- Feature flag functions correctly

---

### ⏸️ Phase 5 User Testing (MANDATORY PAUSE - EXTENDED)

**⚠️ CRITICAL PHASE - EXTENDED TESTING REQUIRED**

**User tests (minimum 2 hours):**
- Visual inspection: No overlapping nodes
- Compare old vs new layout screenshots
- Check all 56 nodes visible and correctly positioned
- Test with different zoom levels
- Test search highlighting (paths still work)
- Verify admin features (QuickAdd, edit) still work
- Performance test: No lag, still 60fps

**If ANY issues found:**
- Immediately disable feature flag: `USE_VAN_DER_PLOEG_LAYOUT = false`
- Document issues for Phase 5 Issue Resolution
- Do NOT proceed to Phase 6

---

### 🔧 Phase 5 Issue Resolution (LIKELY NEEDED)

**Given high risk, expect issues:**

```bash
git checkout -b fix/phase-5-layout-bugs

# Fix layout bugs
# ... changes ...

git commit -m "fix(phase-5): Fix layout algorithm edge cases

Fixed:
- Overlapping nodes for X scenario
- Performance regression when Y
- Boundary calculation error

Re-tested, all tests passing."

git checkout feature/perfect-tree-implementation
git merge fix/phase-5-layout-bugs
git push
```

**Re-audit after fixes.**

---

### ✅ Phase 5 Completion Sign-Off

**Extra requirements due to high risk:**
- ✅ Layout correctness verified visually
- ✅ Performance benchmarks show no regression
- ✅ Rollback tested and works
- ✅ User approved after extended testing

```bash
git tag -a phase-5-complete -m "Phase 5 (Layout Engine) Complete"
git push origin phase-5-complete
```

**Status:** 🟢 **READY FOR PHASE 6 PLANNING**

---

## 🎨 Phase 6: Highlighting System (WEEK 6-7)

**Duration:** 10 days + planning + audit
**Risk:** 🟡 Medium (new feature, doesn't break existing)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Flexible highlighting architecture (any line, any color, any effect)

---

### 📋 Phase 6 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 6 in detail"

**Output:** `docs/phase-plans/PHASE_6_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_6_PLAN.md
git commit -m "plan: Phase 6 (Highlighting System) detailed plan"
git push
```

---

### High-Level Tasks

**Day 1-3:** Core Highlighting Architecture
- Create `src/components/TreeView/highlighting/HighlightEngine.ts`
- Create `src/components/TreeView/highlighting/types.ts`
- Support multiple simultaneous highlights (1000+ paths)
- Path data structure: `{ nodes: string[], color: string, width: number, effect: string }`

**Day 4-5:** Visual Effects
- Create `src/components/TreeView/highlighting/effects/GlowEffect.ts`
- Create `src/components/TreeView/highlighting/effects/PulseEffect.ts`
- Create `src/components/TreeView/highlighting/effects/DashedEffect.ts`
- Skia shader support for GPU-accelerated effects

**Day 6-7:** UI Controls
- Create highlight palette UI
- Color picker for custom highlight colors
- Effect selector (solid, glow, pulse, dashed)
- Width slider (1-8px)

**Day 8:** Integration with Search
- Update search to use new highlight system
- Highlight entire path from root to searched node
- Use Honor Gold (#D4AF37) for search paths

**Day 9-10:** Testing & Polish
- Test 1000+ simultaneous highlights
- Performance testing (should be 60fps)
- Documentation

**Commit Phase 6:**
```bash
git commit -m "feat(tree): Complete flexible highlighting system (Phase 6)

✅ Highlight engine supporting 1000+ paths
✅ Multiple visual effects (glow, pulse, dashed)
✅ Color picker for custom highlights
✅ Width and effect controls
✅ GPU-accelerated Skia shaders
✅ Integrated with search functionality

Highlighting is now world-class flexible.
Phase 6 Complete."
git push
```

---

### 🔍 Phase 6 Solution Audit (MANDATORY)

**Audit checks:**
- Highlight rendering performance (60fps with 100+ paths)
- Memory usage with 1000+ simultaneous highlights
- Color picker accessibility (WCAG compliant)
- Effect shaders work on older devices (iPhone XR)

---

### ⏸️ Phase 6 User Testing (MANDATORY PAUSE)

**User tests:**
- Create 10+ custom highlights with different colors
- Test glow, pulse, dashed effects
- Search for node - path highlights correctly
- Test performance with many highlights
- Verify highlights visible in both light/dark themes

---

### ✅ Phase 6 Completion Sign-Off

```bash
git tag -a phase-6-complete -m "Phase 6 (Highlighting System) Complete"
git push origin phase-6-complete
```

**Status:** 🟢 **READY FOR PHASE 7 PLANNING**

---

## 🧭 Phase 7: Navigation System (WEEK 8-9)

**Duration:** 10 days + planning + audit
**Risk:** 🟡 Medium (complex UI, many moving parts)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Minimap, focus modes, smooth animations, breadcrumbs

---

### 📋 Phase 7 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 7 in detail"

**Output:** `docs/phase-plans/PHASE_7_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_7_PLAN.md
git commit -m "plan: Phase 7 (Navigation System) detailed plan"
git push
```

---

### High-Level Tasks

**Day 1-3:** Minimap Component
- Create `src/components/TreeView/navigation/Minimap.tsx`
- Render simplified tree overview (no photos, just boxes)
- Show viewport indicator (current view rectangle)
- Tap-to-navigate functionality

**Day 4-5:** Focus Modes
- Create `src/components/TreeView/navigation/FocusManager.ts`
- Focus on node: Center and zoom to specific node
- Focus on branch: Show entire subtree
- Focus on generation: Show specific generation level

**Day 6-7:** Smooth Animations
- Create `src/components/TreeView/navigation/CameraAnimations.ts`
- Use Reanimated 3 for smooth camera transitions
- Easing functions (ease-in-out, spring)
- Animated pan, zoom, and rotation

**Day 8:** Breadcrumbs
- Create breadcrumb UI showing path to current node
- Tap breadcrumb to navigate up tree
- Integrate with search

**Day 9-10:** Testing & Polish
- Test all navigation modes
- Performance testing (animations at 60fps)
- Documentation

**Commit Phase 7:**
```bash
git commit -m "feat(tree): Complete navigation system with minimap (Phase 7)

✅ Interactive minimap with viewport indicator
✅ Focus modes (node, branch, generation)
✅ Smooth camera animations (Reanimated 3)
✅ Breadcrumb navigation
✅ Tap-to-navigate from minimap

Navigation is now intuitive and smooth.
Phase 7 Complete."
git push
```

---

### 🔍 Phase 7 Solution Audit (MANDATORY)

**Audit checks:**
- Minimap rendering performance (low priority render)
- Animation smoothness (60fps during transitions)
- Focus mode edge cases (nodes at tree boundary)
- Accessibility of navigation controls

---

### ⏸️ Phase 7 User Testing (MANDATORY PAUSE)

**User tests:**
- Use minimap to navigate large tree
- Test focus on node/branch/generation
- Verify animations are smooth (not jarring)
- Test breadcrumb navigation
- Check minimap updates when tree changes

---

### ✅ Phase 7 Completion Sign-Off

```bash
git tag -a phase-7-complete -m "Phase 7 (Navigation System) Complete"
git push origin phase-7-complete
```

**Status:** 🟢 **READY FOR PHASE 8 PLANNING**

---

## 📄 Phase 8: Export System (WEEK 10-11)

**Duration:** 10 days + planning + audit
**Risk:** 🟢 Low (additive feature)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** PDF and PNG export with progressive tiling for large trees

---

### 📋 Phase 8 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 8 in detail"

**Output:** `docs/phase-plans/PHASE_8_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_8_PLAN.md
git commit -m "plan: Phase 8 (Export System) detailed plan"
git push
```

---

### High-Level Tasks

**Day 1-3:** PNG Export (Simple)
- Use `react-native-view-shot` to capture current viewport
- Save to device photo library
- Share via native share sheet

**Day 4-7:** PDF Export (Complex)
- Create `src/components/TreeView/export/PDFExporter.ts`
- Progressive tiling: Render 2000px × 2000px tiles
- 100px overlap for seamless stitching
- Assemble tiles into single PDF using `react-native-pdf-lib`

**Day 8:** Export UI
- Create export menu (PDF, PNG, settings)
- Quality selector (low, medium, high)
- Include/exclude photos option
- Loading indicator during export

**Day 9-10:** Testing & Optimization
- Test export with 56 nodes (current tree)
- Test with 1000+ nodes (stress test)
- Optimize tile rendering for speed
- Documentation

**Commit Phase 8:**
```bash
git commit -m "feat(tree): Complete export system (PDF/PNG) (Phase 8)

✅ PNG export (current viewport)
✅ PDF export with progressive tiling
✅ Handles 10,000+ nodes efficiently
✅ Quality selector (low/medium/high)
✅ Include/exclude photos option
✅ Native share sheet integration

Tree can now be exported for printing/sharing.
Phase 8 Complete."
git push
```

---

### 🔍 Phase 8 Solution Audit (MANDATORY)

**Audit checks:**
- Export quality matches screen rendering
- PDF tile stitching is seamless (no gaps/overlaps)
- Memory usage during large exports (doesn't crash)
- Export speed is reasonable (<30s for 1000 nodes)

---

### ⏸️ Phase 8 User Testing (MANDATORY PAUSE)

**User tests:**
- Export tree as PNG - opens in Photos app
- Export tree as PDF - opens in Files app
- Share exported PDF via WhatsApp
- Verify export quality is high
- Test with/without photos option

---

### ✅ Phase 8 Completion Sign-Off

```bash
git tag -a phase-8-complete -m "Phase 8 (Export System) Complete"
git push origin phase-8-complete
```

**Status:** 🟢 **READY FOR PHASE 9 PLANNING**

---

## 🔧 Phase 9: Modular Refactor (WEEK 12-14)

**Duration:** 15 days + planning + audit
**Risk:** 🔴 High (complete restructure of TreeView.js)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Break 3,817-line TreeView.js into 35 focused modules

---

### 📋 Phase 9 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 9 in detail"

**Output:** `docs/phase-plans/PHASE_9_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_9_PLAN.md
git commit -m "plan: Phase 9 (Modular Refactor) detailed plan"
git push
```

---

### ⚠️ Highest Risk Phase - Maximum Caution

**Why extremely risky:**
- Touches every part of TreeView.js
- Could break existing functionality
- Refactoring 3,817 lines into 35 files
- Highest chance of introducing bugs

**Mitigation Strategy:**
- **Incremental approach:** One module per day
- **Test after EVERY module extraction**
- **No big-bang rewrite**
- **Keep TreeView.js functional throughout**
- **Daily commits with rollback points**

---

### High-Level Tasks (Detailed in phase plan)

**Week 1 (Day 1-5):** Extract Rendering Modules
- Day 1: `NodeRenderer.tsx`
- Day 2: `ConnectionRenderer.tsx`
- Day 3: `PhotoRenderer.tsx` (already done in Phase 2, refine)
- Day 4: `TextRenderer.tsx`
- Day 5: `ShadowRenderer.tsx`

**Week 2 (Day 6-10):** Extract Logic Modules
- Day 6: `LayoutEngine.ts`
- Day 7: `ViewportCulling.ts`
- Day 8: `SpatialIndexing.ts`
- Day 9: `LODManager.ts`
- Day 10: `ImageBucketing.ts`

**Week 3 (Day 11-15):** Extract State & Integration
- Day 11: `TreeStore.ts` (Zustand)
- Day 12: `GestureHandlers.ts`
- Day 13: `TreeControls.tsx` (UI)
- Day 14: Integration & testing
- Day 15: Final TreeView.js cleanup (should be <500 lines)

**Each day follows strict protocol:**
1. Extract module
2. Test immediately (run full testing checklist)
3. Commit if tests pass
4. If tests fail, rollback and fix
5. Do NOT proceed to next module until current one works

**Commit Phase 9:**
```bash
git commit -m "refactor(tree): Complete modular refactor (Phase 9)

✅ TreeView.js: 3,817 lines → 450 lines
✅ 35 focused modules created
✅ Rendering layer separated
✅ Layout engine isolated
✅ State management with Zustand
✅ All functionality preserved
✅ All tests passing

TreeView is now maintainable and extensible.
Phase 9 Complete."
git push
```

---

### 🔍 Phase 9 Solution Audit (MANDATORY)

**Critical audit checks:**
- Module boundaries are logical and clean
- No circular dependencies between modules
- Each module has single responsibility
- Import graph is acyclic
- Performance unchanged (60fps maintained)
- All features still work

---

### ⏸️ Phase 9 User Testing (MANDATORY PAUSE - EXTENDED)

**⚠️ EXTENDED TESTING - Minimum 3 hours**

**User must test EVERYTHING:**
- Tree rendering (all 56 nodes)
- Pan, zoom, pinch gestures
- Search and highlighting
- Admin mode (QuickAdd, edit)
- Theme switching
- Navigation (minimap, focus modes)
- Export (PDF, PNG)
- Performance (60fps)
- No regressions anywhere

**If ANY feature broken:**
- STOP Phase 9 immediately
- Create detailed bug report
- Fix before completing phase

---

### 🔧 Phase 9 Issue Resolution (EXPECT ISSUES)

**Phase 9 will likely have bugs. This is normal for large refactors.**

```bash
git checkout -b fix/phase-9-refactor-bugs

# Fix bugs found during testing
# ... extensive changes ...

git commit -m "fix(phase-9): Fix refactor regressions

Fixed 10+ issues from modular refactor:
- Bug #1: [description]
- Bug #2: [description]
... (list all fixes)

All features now working. Re-tested everything."

git checkout feature/perfect-tree-implementation
git merge fix/phase-9-refactor-bugs
git push
```

**Re-audit and re-test after fixes.**

---

### ✅ Phase 9 Completion Sign-Off

**Extra requirements:**
- ✅ ALL features tested and working
- ✅ No performance regressions
- ✅ Module architecture clean
- ✅ Extended user testing passed
- ✅ Bug fix cycle completed

```bash
git tag -a phase-9-complete -m "Phase 9 (Modular Refactor) Complete"
git push origin phase-9-complete
```

**Status:** 🟢 **READY FOR PHASE 10 PLANNING**

---

## ✅ Phase 10: Testing & Polish (WEEK 15-16)

**Duration:** 10 days + planning
**Risk:** 🟢 Low (no new features, only polish)
**Branch:** `feature/perfect-tree-implementation`
**Goal:** Production readiness, performance optimization, final polish

---

### 📋 Phase 10 Planning Session (MUST DO BEFORE STARTING)

**User to Claude:** "Let's plan Phase 10 in detail"

**Output:** `docs/phase-plans/PHASE_10_PLAN.md`

**Commit plan:**
```bash
git add docs/phase-plans/PHASE_10_PLAN.md
git commit -m "plan: Phase 10 (Testing & Polish) detailed plan"
git push
```

---

### High-Level Tasks

**Day 1-2:** Performance Benchmarking
- Measure layout time (target: <200ms for 1000 nodes)
- Measure render time (target: 60fps)
- Memory profiling (target: <20MB for tree data)
- Identify and fix bottlenecks

**Day 3-4:** Edge Case Testing
- Test with 10,000 nodes (stress test)
- Test with 1 node (minimum tree)
- Test with very wide tree (50+ siblings)
- Test with very deep tree (20+ generations)
- Fix any crashes or visual bugs

**Day 5-6:** Accessibility
- VoiceOver support for tree navigation
- High contrast mode compatibility
- Font scaling (dynamic type)
- Color blind friendly palette option

**Day 7:** Documentation
- Update CLAUDE.md with all new features
- Create user guide for new features
- Document architecture decisions
- Create troubleshooting guide

**Day 8-9:** Final Polish
- Smooth all animations
- Fine-tune gesture parameters
- Perfect RTL layout
- Visual consistency check

**Day 10:** Final Testing & Sign-Off
- Run complete testing checklist (3+ hours)
- Test on multiple devices (iPhone XR, iPhone 15 Pro)
- Test with real family data (not just test data)
- Performance profiling one final time

**Commit Phase 10:**
```bash
git commit -m "polish(tree): Complete final testing and polish (Phase 10)

✅ Performance benchmarks met (60fps, <200ms layout)
✅ Edge case testing complete (1-10,000 nodes)
✅ Accessibility improvements (VoiceOver, high contrast)
✅ Documentation updated
✅ Final visual polish
✅ Multi-device testing passed

Perfect Tree implementation is production-ready.
Phase 10 Complete."
git push
```

---

### 🔍 Phase 10 Final Audit (MANDATORY)

**Comprehensive final audit:**
- Performance benchmarks documented
- All features working across devices
- No known bugs
- Documentation complete
- Code quality high
- Ready for production

**Output:** `docs/audits/PHASE_10_FINAL_AUDIT.md`

---

### ⏸️ Phase 10 User Testing (FINAL ACCEPTANCE)

**Final acceptance testing - Minimum 4 hours**

**User tests everything one final time:**
- Complete feature checklist (all 40+ features)
- Performance testing
- Device compatibility
- Real-world usage scenarios
- Production readiness assessment

**User decision:**
- ✅ "Approve for production"
- ⚠️ "Minor issues found, fix before shipping"
- 🔴 "Major issues, more work needed"

---

### ✅ Phase 10 Completion Sign-Off

**Final requirements:**
- ✅ All 10 phases completed
- ✅ All audits passed
- ✅ User accepted for production
- ✅ Performance targets met
- ✅ Documentation complete

**Create final release:**
```bash
git tag -a v2.0.0-perfect-tree -m "Perfect Tree v2.0.0

Complete reimplementation of family tree visualization:

✅ Modular architecture (35 modules)
✅ Curved Bézier connections
✅ Light/dark theme system
✅ Flexible highlighting (1000+ paths)
✅ Advanced navigation (minimap, focus modes)
✅ PDF/PNG export
✅ iOS-quality gestures
✅ 60fps at 10,000 nodes

Phases completed:
- Phase 0: Safety & Backup
- Phase 1: Foundation
- Phase 2: Visual Polish
- Phase 3: Theme System
- Phase 4: Gesture Refinement
- Phase 5: Layout Engine
- Phase 6: Highlighting System
- Phase 7: Navigation System
- Phase 8: Export System
- Phase 9: Modular Refactor
- Phase 10: Testing & Polish

Ready for production."

git push origin v2.0.0-perfect-tree
```

**Merge to master:**
```bash
# Final merge to production
git checkout master
git merge feature/perfect-tree-implementation
git push origin master

# Celebrate! 🎉
```

---

## 📊 Implementation Summary

### Completed Phases (Detailed)
- ✅ **Phase 0:** Safety & Backup (1 day) - Git safety, backups, rollback procedures
- ✅ **Phase 1:** Foundation (5 days) - Modular structure, constants, types
- ✅ **Phase 2:** Visual Polish (5 days) - Curved lines, shadows, photos

### Remaining Phases (Framework Defined)
- ⏸️ **Phase 3:** Theme System (5 days) - Light/dark themes, design tokens
- ⏸️ **Phase 4:** Gesture Refinement (3 days) - Rubber banding, momentum
- ⏸️ **Phase 5:** Layout Engine (5 days) - Van der Ploeg algorithm [HIGH RISK]
- ⏸️ **Phase 6:** Highlighting System (10 days) - Flexible highlighting
- ⏸️ **Phase 7:** Navigation System (10 days) - Minimap, focus modes
- ⏸️ **Phase 8:** Export System (10 days) - PDF, PNG export
- ⏸️ **Phase 9:** Modular Refactor (15 days) - 35 focused modules [HIGHEST RISK]
- ⏸️ **Phase 10:** Testing & Polish (10 days) - Production readiness

### Total Timeline
- **Minimum:** 77 days (11 weeks) - If everything goes perfectly
- **Realistic:** 85-95 days (12-14 weeks) - Including issue resolution
- **Safe estimate:** 100+ days (16 weeks) - Buffer for unexpected issues

---

## 🎯 Next Steps

**Immediate actions:**

1. **Execute Phase 0** (Safety & Backup) - MANDATORY before anything else
2. **Execute Phase 1** (Foundation) - Low risk, high value
3. **Execute Phase 2** (Visual Polish) - Visible improvements
4. **Review progress** - Decide whether to continue or merge

**After Phase 2, you have options:**

A. **Continue with Phase 3+** (Full implementation)
B. **Merge to master** (Ship visual improvements)
C. **Pause & iterate** (Get user feedback first)

---

**Ready to begin Phase 0?** Let me know and I'll guide you through each step! 🚀
