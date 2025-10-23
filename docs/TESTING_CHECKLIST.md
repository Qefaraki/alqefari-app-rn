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
