# News Screen Test Report

## Issues Found:

### 1. Date Formatting Not Respecting Settings ❌
- The `useFormattedDate` hook IS being called correctly
- The hook DOES access settings via `useSettings`
- But dates appear to still show in a fixed format

**Potential Issue**: The relative date formatting in the hook might be overriding the user's calendar preference when within 14 days.

### 2. Pagination Still Jumping ❌
- Removed `maintainVisibleContentPosition` but issue persists
- Added scroll position tracking with ref but not restoring it
- Need to actually restore scroll position after new items load

### 3. Carousel Snap Behavior ❌
- Snap interval is set but might be wrong calculation
- Card width calculation might not match actual rendered size
- Need to verify actual rendered dimensions

## Quick Fixes Needed:

1. **Date Fix**: Check if relative dates are bypassing calendar settings
2. **Pagination Fix**: Actually restore scroll position after load
3. **Carousel Fix**: Debug actual card width vs calculated width

## Testing Commands:
```bash
# Run the app
npm run ios

# Check settings
# 1. Go to Settings
# 2. Change calendar to Hijri
# 3. Enable Arabic numerals
# 4. Go to News - dates should reflect these changes
```