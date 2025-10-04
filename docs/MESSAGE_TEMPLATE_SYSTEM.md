# WhatsApp Message Template System

**Status**: ✅ Deployed and operational
**Version**: 1.0
**Last Updated**: January 2025

## Overview

The Message Template System provides a unified, scalable way to manage all WhatsApp contact messages throughout the app. It features:

- **Registry-based architecture** - Single source of truth for all templates
- **Dynamic variable replacement** - Insert user data like `{name_chain}`, `{phone}` automatically
- **Admin UI** - Visual interface for customizing messages without code changes
- **Type-safe** - Full TypeScript support with compile-time checks
- **Easy to extend** - Add new templates by editing one configuration object

## Architecture

### File Structure

```
src/
├── services/
│   └── messageTemplates/
│       ├── types.ts                    # TypeScript type definitions
│       ├── variables.ts                # Common variable registry
│       ├── templateRegistry.ts         # Single source of truth for templates
│       ├── templateService.ts          # Core business logic
│       └── index.ts                    # Barrel export
├── hooks/
│   └── useMessageTemplate.ts           # React hook for components
└── components/
    └── admin/
        ├── VariableChip.tsx            # UI component for variable tags
        ├── TemplateCard.tsx            # UI component for editing templates
        └── MessageTemplateManager.tsx  # Main admin UI
```

---

## Core Concepts

### 1. Templates

Templates are pre-configured WhatsApp messages with optional dynamic variables.

**Example Template:**
```typescript
{
  id: 'article_suggestion',
  name: 'رسالة اقتراح المقالات',
  description: 'تظهر عند اقتراح مقال من صفحة الأخبار',
  category: 'content',
  defaultMessage: 'السلام عليكم، أنا {name_chain}، أود اقتراح مقال للنشر.',
  icon: 'newspaper-outline',
  storageKey: 'admin_article_suggestion_message',
  variables: ['name_chain', 'phone', 'hid'],
  testable: true,
  order: 2,
}
```

### 2. Variables

Variables are placeholders like `{name_chain}` that get replaced with actual user data at runtime.

**Common Variables:**
- `{name_chain}` - Full ancestry chain (e.g., "محمد بن علي بن عبدالله القفاري")
- `{phone}` - User's phone number
- `{hid}` - Hierarchical ID (e.g., "1.2.3")
- `{location}` - User's location

Variables use Arabic "بن" (ibn) for males, "بنت" (bint) for females.

### 3. Categories

Templates are organized into categories for better UI organization:
- **support** - Help and support messages
- **content** - Content suggestions (articles, news)
- **requests** - User requests (profile links, edits)
- **notifications** - System notifications

---

## How It Works

### Data Flow

```
User clicks button
    ↓
Component calls useMessageTemplate hook
    ↓
Hook calls templateService
    ↓
Service loads custom message from AsyncStorage (or uses default)
    ↓
Service replaces variables with user data
    ↓
Service opens WhatsApp with final message
```

### Variable Replacement Example

**Template:**
```
أنا {name_chain}، رقم جوالي {phone}
```

**User Data:**
```javascript
{
  name: "محمد",
  gender: "male",
  father_name: "علي",
  grandfather_name: "عبدالله",
  family_name: "القفاري",
  phone: "+966501234567"
}
```

**Final Message:**
```
أنا محمد بن علي عبدالله القفاري، رقم جوالي +966501234567
```

---

## Adding a New Template

### Step 1: Add to Registry

Edit `src/services/messageTemplates/templateRegistry.ts`:

```typescript
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // ... existing templates
  {
    id: 'new_template_id',                          // Unique ID (lowercase_with_underscores)
    name: 'عنوان القالب',                           // Arabic display name
    description: 'وصف متى يظهر هذا القالب',          // When/where it's used
    category: 'support',                            // support/content/requests/notifications
    defaultMessage: 'نص الرسالة الافتراضي',         // Default message (can include {variables})
    icon: 'help-circle',                            // Ionicons icon name
    storageKey: 'admin_new_template_key',           // AsyncStorage key (unique!)
    variables: ['name_chain', 'phone'],             // Variables this template uses
    testable: true,                                 // Can be tested with mock data?
    order: 10,                                      // Display order in UI
    testMockData: {                                 // Optional: mock data for testing
      name: 'محمد',
      gender: 'male',
      father_name: 'علي',
      phone: '+966501234567',
    },
  },
];
```

### Step 2: Use in Component

```typescript
import { useMessageTemplate } from '../../../hooks/useMessageTemplate';

function MyComponent() {
  const { openWhatsApp } = useMessageTemplate();
  const { profile } = useAuth();

  const handleClick = async () => {
    await openWhatsApp('new_template_id', profile);
  };

  return <Button onPress={handleClick}>اتصل بنا</Button>;
}
```

**That's it!** The UI auto-generates in MessageTemplateManager, saving/loading works automatically, and admins can customize it.

---

## Using Templates in Code

### React Hook API

```typescript
import { useMessageTemplate } from '../../../hooks/useMessageTemplate';

const {
  getMessage,           // Get template message (custom or default)
  getMessageWithData,  // Get message with variables replaced
  openWhatsApp,        // Open WhatsApp directly
  saveMessage,         // Save custom message
  resetTemplate,       // Reset to default
  isCustomized,        // Check if customized
} = useMessageTemplate();
```

### Common Patterns

#### 1. Simple Message (No Variables)

```typescript
const handleHelp = async () => {
  await openWhatsApp('onboarding_help');
  // Opens WhatsApp with message (no user data needed)
};
```

#### 2. Message with User Data

```typescript
const { profile } = useAuth();

const handleSuggestArticle = async () => {
  if (!profile) {
    Alert.alert('خطأ', 'يجب تسجيل الدخول');
    return;
  }

  await openWhatsApp('article_suggestion', profile);
  // Variables like {name_chain} and {phone} replaced automatically
};
```

#### 3. Get Message Without Opening WhatsApp

```typescript
const message = await getMessageWithData('article_suggestion', profile);
console.log(message); // "السلام عليكم، أنا محمد بن علي..."
```

#### 4. Check if Admin Customized a Template

```typescript
const customized = await isCustomized('article_suggestion');
if (customized) {
  console.log('Admin has customized this message');
}
```

---

## Admin UI

### Accessing the Template Manager

1. Open Admin Dashboard
2. Tap "قوالب الرسائل" (Message Templates)
3. Templates grouped by category
4. Tap any template to edit

### Template Card Features

Each template card shows:
- **Name & Description** - What the template is for
- **Current Message** - Editable text field
- **Variable Chips** - Tap to insert variables like `{name_chain}`
- **Actions**:
  - **حفظ** (Save) - Save customized message
  - **اختبار** (Test) - Open WhatsApp with mock data
  - **إعادة تعيين** (Reset) - Restore default message

### Variable Chips

Click variable chips to insert them into your message:
- `{name_chain}` - Full ancestry chain
- `{phone}` - Phone number
- `{hid}` - Hierarchical ID
- `{location}` - User location

Variables are automatically replaced when the message is sent.

---

## Service API Reference

### `templateService.getTemplateMessage(templateId)`

Get the current message for a template (custom or default).

```typescript
const message = await templateService.getTemplateMessage('onboarding_help');
// Returns: "مرحباً، أحتاج مساعدة في استخدام التطبيق"
```

### `templateService.setTemplateMessage(templateId, message)`

Save a custom message for a template.

```typescript
await templateService.setTemplateMessage(
  'onboarding_help',
  'رسالة مخصصة جديدة'
);
```

### `templateService.replaceVariables(message, userData)`

Replace all variables in a message with user data.

```typescript
const message = "أنا {name_chain}، جوالي {phone}";
const userData = {
  name: 'محمد',
  gender: 'male',
  father_name: 'علي',
  phone: '+966501234567',
};

const result = await templateService.replaceVariables(message, userData);
// Returns: "أنا محمد بن علي القفاري، جوالي +966501234567"
```

### `templateService.getMessageWithData(templateId, userData)`

Get template message with variables replaced (combines getTemplateMessage + replaceVariables).

```typescript
const message = await templateService.getMessageWithData(
  'article_suggestion',
  profile
);
```

### `templateService.resetTemplate(templateId)`

Reset template to default message.

```typescript
await templateService.resetTemplate('article_suggestion');
```

### `templateService.getAllTemplatesWithValues()`

Get all templates with their current messages (used by admin UI).

```typescript
const templates = await templateService.getAllTemplatesWithValues();
// Returns array of TemplateWithValue objects
```

### `templateService.clearAllCustomTemplates()`

Reset all templates to defaults (admin feature).

```typescript
await templateService.clearAllCustomTemplates();
```

---

## Current Templates

### Support Category

**1. Onboarding Help** (`onboarding_help`)
- **Where**: Onboarding screen "تحتاج مساعدة؟" button
- **Variables**: None
- **Default**: "مرحباً، أحتاج مساعدة في استخدام تطبيق شجرة عائلة القفاري"
- **Code**: `src/screens/onboarding/OnboardingScreen.js:595`

**3. Contact Admin** (`contact_admin`)
- **Where**: General admin contact button
- **Variables**: `{name_chain}`, `{phone}`
- **Default**: "السلام عليكم، أنا {name_chain}، رقم جوالي {phone}"

**5. Report Issue** (`report_issue`)
- **Where**: Bug report feature
- **Variables**: `{name_chain}`, `{phone}`
- **Default**: "السلام عليكم، أنا {name_chain}، أود الإبلاغ عن مشكلة في التطبيق"

### Content Category

**2. Article Suggestion** (`article_suggestion`)
- **Where**: News screen article viewer
- **Variables**: `{name_chain}`, `{phone}`
- **Default**: "السلام عليكم، أنا {name_chain}، أود اقتراح مقال للنشر"
- **Code**: `src/components/ArticleViewer/components/ArticleActions.tsx:56`

### Requests Category

**4. Profile Link Request** (`profile_link_request`)
- **Where**: User requests to link family member
- **Variables**: `{name_chain}`, `{phone}`, `{hid}`
- **Default**: "السلام عليكم، أنا {name_chain}، أطلب ربط ملف شخصي جديد"

---

## Variable System Deep Dive

### How Variables Are Replaced

The `replaceVariables` function in `templateService.ts` handles variable replacement:

```typescript
export async function replaceVariables(
  message: string,
  userData?: any
): Promise<string> {
  if (!userData) return message;

  let processedMessage = message;

  // Name Chain - uses buildNameChain utility
  if (processedMessage.includes('{name_chain}')) {
    const nameChain = userData?.full_chain || buildNameChain(userData) || 'غير محدد';
    processedMessage = processedMessage.replace(/{name_chain}/g, nameChain);
  }

  // Phone
  if (processedMessage.includes('{phone}')) {
    const phone = userData?.phone || 'غير محدد';
    processedMessage = processedMessage.replace(/{phone}/g, phone);
  }

  // ... more variables

  return processedMessage;
}
```

### Name Chain Construction

Name chains use the existing `buildNameChain()` utility from `src/utils/nameChain.js`:

```javascript
buildNameChain({
  name: 'محمد',
  gender: 'male',
  father_name: 'علي',
  grandfather_name: 'عبدالله',
  family_name: 'القفاري',
})
// Returns: "محمد بن علي عبدالله القفاري"

buildNameChain({
  name: 'فاطمة',
  gender: 'female',
  father_name: 'علي',
  family_name: 'القفاري',
})
// Returns: "فاطمة بنت علي القفاري"
```

### Adding New Variables

**Step 1:** Add to `COMMON_VARIABLES` in `variables.ts`:

```typescript
export const COMMON_VARIABLES: TemplateVariable[] = [
  // ... existing variables
  {
    key: '{new_variable}',
    label: 'متغير جديد',
    description: 'وصف المتغير',
    source: 'profile.field_name',
    example: 'قيمة مثال',
    required: false,
  },
];
```

**Step 2:** Add replacement logic in `templateService.ts`:

```typescript
if (processedMessage.includes('{new_variable}')) {
  const value = userData?.field_name || 'قيمة افتراضية';
  processedMessage = processedMessage.replace(/{new_variable}/g, value);
}
```

**Step 3:** Add to template's `variables` array:

```typescript
{
  id: 'my_template',
  variables: ['name_chain', 'phone', 'new_variable'],
  // ...
}
```

---

## Storage & Persistence

### Storage Keys

Each template has a unique `storageKey` used for AsyncStorage:

```typescript
{
  id: 'article_suggestion',
  storageKey: 'admin_article_suggestion_message',
  // ...
}
```

**Important**: All storage keys must be unique! Use prefix `admin_` for consistency.

### Data Format

Messages are stored as plain strings in AsyncStorage:

```javascript
await AsyncStorage.setItem(
  'admin_article_suggestion_message',
  'نص الرسالة المخصصة'
);
```

### Migration from Old System

Old keys are automatically supported for backward compatibility:
- `admin_default_message` (deprecated - use templates instead)
- `admin_onboarding_help_message` (migrated to `onboarding_help` template)
- `admin_article_suggestion_message` (migrated to `article_suggestion` template)

---

## Testing Templates

### From Admin UI

1. Open MessageTemplateManager
2. Find template card
3. Click "اختبار" button
4. WhatsApp opens with mock data

### Mock Data

Each template can specify `testMockData`:

```typescript
{
  id: 'article_suggestion',
  testMockData: {
    name: 'محمد',
    gender: 'male',
    father_name: 'علي',
    grandfather_name: 'عبدالله',
    family_name: 'القفاري',
    phone: '+966501234567',
  },
}
```

This data is used when testing to ensure variables work correctly.

### Programmatic Testing

```typescript
import templateService from './services/messageTemplates';

// Test variable replacement
const message = await templateService.replaceVariables(
  'أنا {name_chain}، جوالي {phone}',
  {
    name: 'محمد',
    gender: 'male',
    father_name: 'علي',
    phone: '+966501234567',
  }
);

console.log(message);
// Expected: "أنا محمد بن علي القفاري، جوالي +966501234567"
```

---

## Troubleshooting

### Issue: Template not showing in admin UI

**Cause**: Template not added to registry or missing required fields

**Fix**:
1. Check `MESSAGE_TEMPLATES` array in `templateRegistry.ts`
2. Ensure template has all required fields
3. Verify `order` is set for proper sorting

### Issue: Variables not replaced

**Cause**: User data missing required fields

**Fix**:
1. Check `userData` object has fields like `name`, `father_name`, etc.
2. Verify `buildNameChain()` is working for name chains
3. Add fallback values: `userData?.phone || 'غير محدد'`

### Issue: Custom message not loading

**Cause**: Storage key mismatch or AsyncStorage issue

**Fix**:
1. Verify `storageKey` matches between template and storage
2. Check AsyncStorage: `AsyncStorage.getItem('admin_template_key')`
3. Try resetting template to default

### Issue: Button doesn't open WhatsApp

**Cause**: adminContactService configuration issue

**Fix**:
1. Check WhatsApp number is set: Admin Dashboard → WhatsApp Settings
2. Verify phone number format: `+966501234567`
3. Check device has WhatsApp installed

---

## Best Practices

### 1. Always Use the Hook

```typescript
// ✅ Good
const { openWhatsApp } = useMessageTemplate();
await openWhatsApp('template_id', profile);

// ❌ Bad
import templateService from './services/messageTemplates';
const message = await templateService.getTemplateMessage('template_id');
// ... manual WhatsApp opening
```

### 2. Check User Data Before Sending

```typescript
// ✅ Good
if (!profile) {
  Alert.alert('خطأ', 'يجب تسجيل الدخول');
  return;
}
await openWhatsApp('template_id', profile);

// ❌ Bad
await openWhatsApp('template_id', profile); // profile might be null!
```

### 3. Use Descriptive Template IDs

```typescript
// ✅ Good
id: 'article_suggestion'
id: 'onboarding_help'
id: 'profile_link_request'

// ❌ Bad
id: 'msg1'
id: 'template_a'
id: 'help'
```

### 4. Provide Test Mock Data

```typescript
// ✅ Good
{
  id: 'my_template',
  testMockData: {
    name: 'محمد',
    gender: 'male',
    father_name: 'علي',
    phone: '+966501234567',
  },
}

// ❌ Bad
{
  id: 'my_template',
  testable: true,
  // No testMockData - how will admin test it?
}
```

### 5. Keep Messages Concise

```typescript
// ✅ Good
"السلام عليكم، أنا {name_chain}، أود اقتراح مقال"

// ❌ Bad
"السلام عليكم ورحمة الله وبركاته، تحية طيبة وبعد، أنا {name_chain}..."
// Too long, WhatsApp has character limits
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Multi-language Support** - English translations
2. **Template Categories** - User-defined categories
3. **Version History** - Track message changes over time
4. **A/B Testing** - Test different message variations
5. **Analytics** - Track which templates are used most
6. **Template Sharing** - Export/import templates between admins
7. **Rich Variables** - Date formatting, currency, calculations

---

## Reference Links

- **Registry**: `src/services/messageTemplates/templateRegistry.ts`
- **Service**: `src/services/messageTemplates/templateService.ts`
- **Hook**: `src/hooks/useMessageTemplate.ts`
- **Admin UI**: `src/components/admin/MessageTemplateManager.tsx`
- **Name Chain Utility**: `src/utils/nameChain.js`

---

_This system ensures scalable, maintainable WhatsApp messaging throughout the Alqefari Family Tree app._
