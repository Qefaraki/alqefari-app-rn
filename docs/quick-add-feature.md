# Quick Add Children Feature Documentation

## Overview

The Quick Add Children feature provides a revolutionary way to add children to the family tree with minimal taps and maximum efficiency. It uses a long-press gesture to activate an overlay that shows a live preview of siblings with drag-to-reorder capability.

## How to Use

### Activation

1. **Enable Admin Mode** - Toggle the admin switch in the top bar
2. **Long Press Any Node** - Hold for 0.5 seconds on any person
3. **Feel the Haptic** - Medium impact feedback confirms activation

### Adding Children

1. **Type Name** - Input field auto-focuses with keyboard
2. **See Live Preview** - Ghost node updates in real-time as you type
3. **Select Gender** - Toggle between male/female (defaults to male)
4. **Add More** - Tap "إضافة آخر" or press Return to add another child
5. **Save All** - Tap "حفظ الكل" to save all children at once

### Reordering Siblings

1. **See All Siblings** - Existing children appear horizontally
2. **Drag to Reorder** - Press and drag any child to new position
3. **Visual Feedback** - Number badges show order (1, 2, 3...)
4. **Magnetic Snapping** - Children snap into place smoothly
5. **New Children First** - New children default to youngest (leftmost)

## Technical Implementation

### Components

#### QuickAddOverlay (`src/components/admin/QuickAddOverlay.js`)

- Main overlay component with blur background
- Manages state for all children (new and existing)
- Handles drag-and-drop reordering
- Integrates with Supabase for saving

#### TreeView Integration

- Long-press gesture handler added to node tap detection
- Triggers overlay with parent node context
- Passes existing siblings for complete view

### Key Features

#### Live Preview

- Ghost node with dashed border shows where child will appear
- Updates name in real-time as user types
- Opacity changes to indicate completion state

#### Drag to Reorder

- `GestureDetector` with `Pan` gesture for dragging
- Spring animations for smooth movement
- Z-index management for dragged items
- Haptic feedback on pickup and drop

#### Bulk Operations

- Uses `admin_bulk_create_children` RPC when available
- Falls back to individual creates if needed
- Updates sibling orders in single transaction

### Performance Optimizations

1. **Native Overlays** - Input components are native, not Skia canvas
2. **Batch Updates** - All children saved in one RPC call
3. **Lazy Loading** - Only visible siblings rendered
4. **Debounced Updates** - Ghost node updates throttled

### Design System

#### Visual Elements

- **Glass Morphism** - Consistent with app design
- **Spring Physics** - Natural animations
- **Arabic RTL** - Full right-to-left support
- **SF Symbols** - Native iOS icons

#### Touch Targets

- Minimum 44pt for all interactive elements
- Clear visual states (hover, active, disabled)
- Generous hit areas for drag handles

## Database Schema

### Required RPCs

```sql
-- Bulk create children with automatic ordering
admin_bulk_create_children(
  p_parent_id UUID,
  p_children JSONB
) RETURNS SETOF profiles
```

### Sibling Order Management

- New children get sequential orders
- Existing siblings maintain relative order
- Reordering updates all affected siblings

## Error Handling

1. **Validation**
   - Name required (min 2 characters)
   - Duplicate name warning (non-blocking)
   - Gender selection required

2. **Network Failures**
   - Falls back to individual creates
   - Shows clear error messages
   - Preserves entered data

3. **Concurrent Edits**
   - Version checking on updates
   - Conflict resolution prompts
   - Automatic retry logic

## Accessibility

- VoiceOver support with descriptive labels
- Keyboard navigation (Tab/Shift+Tab)
- High contrast mode compatible
- RTL language support

## Future Enhancements

1. **Voice Input** - Dictate names directly
2. **Templates** - Common patterns (3 sons, 2 daughters)
3. **Smart Suggestions** - AI-powered name recommendations
4. **Batch Import** - Paste multiple names from clipboard
5. **Photo Upload** - Add photos while creating

## Metrics

### Performance Targets

- Long-press response: < 100ms
- Overlay appearance: < 200ms
- Drag feedback: 60fps
- Save operation: < 2s for 10 children

### User Experience

- Single child: 2 taps + typing (was 5+ taps)
- 5 children: < 30 seconds total
- Reordering: Single drag gesture
- Error recovery: 1 tap

## Testing Checklist

- [ ] Long-press activates on all nodes
- [ ] Haptic feedback works
- [ ] Ghost node updates live
- [ ] Drag to reorder smooth
- [ ] Number badges update
- [ ] Save creates all children
- [ ] Sibling orders correct
- [ ] Error messages clear
- [ ] Keyboard navigation works
- [ ] RTL layout correct

## Support

For issues or questions about this feature:

1. Check the error console for specific messages
2. Verify admin role is enabled
3. Ensure latest migrations are applied
4. Report bugs with reproduction steps
