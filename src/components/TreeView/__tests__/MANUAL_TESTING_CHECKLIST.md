# Branch Tree Modal - Manual Testing Checklist

## Overview
This checklist verifies the auto-highlight and initial focus features added in commit 579b4f676 and enhanced in commit e8cc0bab4.

**Test Device**: iPhone (physical device or simulator)
**Test Environment**: Production build with OTA updates
**Test Duration**: ~10 minutes

---

## Pre-Testing Setup

- [ ] Install latest app build on test device
- [ ] Ensure app has network connectivity
- [ ] Log in with test account
- [ ] Verify tree data is loaded (home screen shows tree)

---

## Test Case 1: Basic Branch Tree Modal Load

**Objective**: Verify modal opens without crashes

**Steps**:
1. Navigate to main tree view
2. Open search (tap search icon)
3. Search for any profile by name
4. Tap "هذا أنا؟" button on search result

**Expected Results**:
- [ ] Branch tree modal opens smoothly
- [ ] No console errors in dev tools
- [ ] No red screen crashes
- [ ] Modal shows tree structure

**Pass/Fail**: ___________

---

## Test Case 2: Auto-Highlight Feature

**Objective**: Verify ancestry path highlighting with ANCESTRY_COLORS

**Steps**:
1. Follow Test Case 1 steps to open branch tree modal
2. Observe the tree visualization
3. Look for colored path from root to selected profile

**Expected Results**:
- [ ] Multi-colored path visible (not golden glow)
- [ ] Path uses ANCESTRY_COLORS gradient (crimson → orange → gold → sage → teal)
- [ ] Path fades in smoothly after ~600ms
- [ ] Path opacity reaches ~65%
- [ ] No flickering or animation glitches

**Pass/Fail**: ___________

---

## Test Case 3: Initial Focus Navigation

**Objective**: Verify camera auto-centers on selected profile

**Steps**:
1. Follow Test Case 1 steps to open branch tree modal
2. Observe camera position when modal opens
3. Check if selected profile is centered on screen

**Expected Results**:
- [ ] Camera focuses on selected profile within 300ms
- [ ] Selected profile is centered in viewport
- [ ] Camera movement is smooth (spring animation)
- [ ] No jarring jumps or stuttering
- [ ] Final position is stable (no drift)

**Pass/Fail**: ___________

---

## Test Case 4: Gestures (Read-Only Mode)

**Objective**: Verify pan/pinch gestures work, but node taps disabled

**Steps**:
1. Open branch tree modal
2. Try panning (dragging) the tree
3. Try pinching to zoom in/out
4. Try tapping on a node

**Expected Results**:
- [ ] Pan gesture works smoothly
- [ ] Pinch zoom works smoothly
- [ ] Node taps do NOTHING (no profile sheet opens)
- [ ] No zoom buttons visible
- [ ] Navigation button visible (smaller, 40x40)

**Pass/Fail**: ___________

---

## Test Case 5: Navigate to Root Button

**Objective**: Verify navigation button is smaller and moves to target

**Steps**:
1. Open branch tree modal
2. Look for navigation button (bottom-left)
3. Tap the navigation button

**Expected Results**:
- [ ] Button is visible (40x40, bottom: 60)
- [ ] Button is smaller than main tree version
- [ ] Tapping button centers camera on selected profile
- [ ] Animation is smooth
- [ ] Highlight path remains visible after navigation

**Pass/Fail**: ___________

---

## Test Case 6: Modal Close/Reopen

**Objective**: Verify no memory leaks or stale animations

**Steps**:
1. Open branch tree modal
2. Close modal immediately (before 600ms)
3. Reopen modal
4. Close after full animation (after 1 second)
5. Reopen modal again

**Expected Results**:
- [ ] No console warnings about memory leaks
- [ ] No orphaned animations on reopen
- [ ] Highlight path animates correctly on each open
- [ ] No visual artifacts or leftover UI elements

**Pass/Fail**: ___________

---

## Test Case 7: Empty Tree Handling

**Objective**: Verify graceful handling of edge cases

**Steps**:
1. Search for profile with no ancestors
2. Open branch tree modal
3. Verify behavior

**Expected Results**:
- [ ] Modal opens without crash
- [ ] No highlight path shown (no ancestors to highlight)
- [ ] Camera focuses on single node
- [ ] No console errors

**Pass/Fail**: ___________

---

## Test Case 8: Multiple Profiles Test

**Objective**: Verify features work across different profiles

**Steps**:
1. Search for profile A → open modal → verify highlight
2. Close modal
3. Search for profile B → open modal → verify highlight
4. Close modal
5. Search for profile C → open modal → verify highlight

**Expected Results**:
- [ ] All 3 profiles show correct ancestry paths
- [ ] No cross-contamination (profile A's path doesn't appear for profile B)
- [ ] Camera centers correctly for each profile
- [ ] Animations reset properly between openings

**Pass/Fail**: ___________

---

## Test Case 9: Performance Check

**Objective**: Verify no performance degradation

**Steps**:
1. Open branch tree modal 10 times in succession
2. Monitor app responsiveness and memory usage

**Expected Results**:
- [ ] No slowdown after multiple opens
- [ ] Memory usage stable (no leaks)
- [ ] Animations remain smooth
- [ ] No console warnings about performance

**Pass/Fail**: ___________

---

## Test Case 10: Main Tree Unaffected

**Objective**: Verify main tree still works correctly

**Steps**:
1. Close branch tree modal
2. Return to main tree view
3. Test main tree features (tap nodes, search, navigate)

**Expected Results**:
- [ ] Main tree gestures work normally
- [ ] Node taps open profile sheets
- [ ] Search navigation works
- [ ] Zoom buttons visible and functional
- [ ] No side effects from branch tree modal

**Pass/Fail**: ___________

---

## Overall Test Results

**Total Tests**: 10
**Passed**: _____
**Failed**: _____
**Pass Rate**: _____%

**Critical Issues Found**: _____________________________

**Minor Issues Found**: _____________________________

**Tested By**: _____________________________
**Date**: _____________________________
**App Version**: _____________________________
**Device**: _____________________________

---

## Notes

Additional observations or issues:

_____________________________________________________________

_____________________________________________________________

_____________________________________________________________

---

## Sign-Off

- [ ] All critical tests passed
- [ ] No regressions in main tree
- [ ] Performance is acceptable
- [ ] Ready for production deployment

**Approved By**: _____________________________
**Date**: _____________________________
