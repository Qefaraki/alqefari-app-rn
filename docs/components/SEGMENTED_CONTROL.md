# SegmentedControl Component

**Status**: ✅ Complete - Standard tab component for content filtering

**Location**: `src/components/ui/SegmentedControl.js`

**Purpose**: Clean, minimal pill-style segmented control matching iOS design patterns. Used for 2-4 option filtering across admin screens and user-facing features.

## Quick Usage

```javascript
import SegmentedControl from '../components/ui/SegmentedControl';

const options = [
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'approved', label: 'مقبولة' },
  { id: 'rejected', label: 'مرفوضة' },
];

const MyScreen = () => {
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <SegmentedControl
      options={options}
      value={activeTab}
      onChange={setActiveTab}
    />
  );
};
```

## API

```typescript
interface SegmentOption {
  id: string;          // Unique identifier
  label: string;       // Display text (Arabic)
}

interface SegmentedControlProps {
  options: SegmentOption[];           // Array of 2-4 options
  value: string;                      // Currently active option ID
  onChange: (id: string) => void;     // Callback when option changes
  style?: ViewStyle;                  // Optional container styling
}
```

## Design Details

**Visual Design**:
- **Container**: Camel Hair Beige 40% background (#D1BBA3 with 40% opacity)
- **Active pill**: White background with subtle shadow (0.06 opacity)
- **Inactive text**: 500 weight, Text Muted color
- **Active text**: 600 weight, Sadu Night color
- **Border radius**: 10px container, 8px individual segments
- **Animation**: Instant change (no animation delay)

**Sizing**:
- **Touch targets**: 44px minimum (iOS standard)
- **Text size**: 13pt
- **Font**: SF Arabic
- **Container padding**: 2px
- **Segment padding**: 8px vertical, 8px horizontal

**Spacing**:
- **Container border radius**: 10px
- **Segment border radius**: 8px
- **Shadow**: 0.06 opacity on active pill

## Current Usage

- ✅ **PermissionManager** - Role filter (الكل / مشرف / منسق)
- ✅ **SuggestionReviewManager** - Status filter (قيد المراجعة / مقبولة / مرفوضة)
- ✅ **ProfileConnectionManagerV2** - Link request filter (في الانتظار / موافق عليها / مرفوضة)
- ✅ **AdminMessagesManager** - Tab filter (طلبات الربط / الرسائل)
- ✅ **ApprovalInbox** - Tab filter (واردة / مرسلة)
- ✅ **MySuggestions** - Tab filter (معلقة / موافق عليها / مرفوضة)
- ✅ **TabsHost** - Profile editor tabs (General / Family / Contact / Details)

## RTL Support

✅ Full native RTL support - no special handling needed
