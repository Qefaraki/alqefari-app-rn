# Broadcast Notification System - Technical Documentation

**Status**: ✅ Production Ready
**Version**: 1.0
**Last Updated**: January 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [RPC Functions](#rpc-functions)
5. [Push Notification Flow](#push-notification-flow)
6. [Security & Permissions](#security--permissions)
7. [Audit Logging](#audit-logging)
8. [Client Integration](#client-integration)
9. [Testing & Monitoring](#testing--monitoring)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

The Broadcast Notification System allows super admins to send targeted notifications to multiple users simultaneously. The system supports:

- **Recipient Targeting**: By role, gender, or all authenticated users
- **Priority Levels**: Normal, high, urgent
- **Dual Delivery**: In-app notifications + iOS/Android push notifications
- **Statistics Tracking**: Delivery counts, read rates, engagement metrics
- **History Management**: Full audit trail of all broadcasts

### Key Features

- ✅ **Targeted Broadcasting**: Filter by user role or gender
- ✅ **Batch Performance**: Single RPC call creates all notifications
- ✅ **Push Integration**: Automatic iOS/Android push delivery
- ✅ **Read Tracking**: Real-time statistics on notification engagement
- ✅ **Audit Trail**: Detailed logging with broadcast metadata
- ✅ **Permission Control**: Super admin only access

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│ Super Admin │
│   (Client)  │
└──────┬──────┘
       │ 1. createBroadcast(title, body, criteria, priority)
       ▼
┌──────────────────────────────────────────────────────────┐
│              Supabase RPC Function                       │
│        create_broadcast_notification()                   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Verify super_admin role                      │   │
│  │ 2. Validate inputs (title, body, criteria)      │   │
│  │ 3. Acquire advisory lock (prevent concurrent)   │   │
│  │ 4. Get recipients via get_broadcast_recipients()│   │
│  │ 5. Create broadcast_messages record             │   │
│  │ 6. BATCH INSERT all notification rows           │   │
│  │ 7. Return success with statistics               │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────┘
                   │ 2. Returns { broadcast_id, recipient_count }
                   ▼
┌──────────────────────────────────────────────────────────┐
│              Client-Side Push Helper                     │
│        sendBroadcastPushNotifications()                  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Call get_broadcast_recipients(criteria)      │   │
│  │ 2. Extract user_ids from recipients             │   │
│  │ 3. Invoke Edge Function: send-push-notification │   │
│  │    Payload: { userIds, title, body, data }      │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────┘
                   │ 3. Edge Function invoked
                   ▼
┌──────────────────────────────────────────────────────────┐
│         Supabase Edge Function (Deno)                    │
│           send-push-notification                         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Fetch push_tokens for user_ids               │   │
│  │ 2. Validate token format (ExponentPushToken[])  │   │
│  │ 3. Create Expo push messages                    │   │
│  │ 4. Send to Expo API in batches (max 100)        │   │
│  │ 5. Update push_sent column in notifications     │   │
│  │ 6. Deactivate invalid tokens (DeviceNotReg)     │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────┘
                   │ 4. Push notifications delivered
                   ▼
┌──────────────────────────────────────────────────────────┐
│              User's Device                               │
│         (iOS / Android)                                  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ - Receives system push notification ("ding")    │   │
│  │ - Notification appears in system tray            │   │
│  │ - Badge count updated                            │   │
│  │ - User taps → navigates to NotificationCenter   │   │
│  │ - Marks as read → updates statistics            │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Components

1. **Database Tables**: `broadcast_messages`, `notifications`, `push_tokens`
2. **RPC Functions**: `create_broadcast_notification`, `get_broadcast_recipients`, `get_broadcast_history`
3. **Edge Function**: `send-push-notification` (Deno)
4. **Client Services**: `broadcastNotifications.ts`, `notifications.js`
5. **UI Component**: `AdminBroadcastManager.tsx`

---

## Database Schema

### Table: `broadcast_messages`

Stores metadata for each broadcast (not individual recipients).

```sql
CREATE TABLE public.broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) >= 3 AND length(title) <= 200),
  body TEXT NOT NULL CHECK (length(body) >= 10 AND length(body) <= 1000),
  sent_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Targeting criteria (stored for history/audit)
  target_criteria JSONB NOT NULL,
  -- Example: { "type": "role", "values": ["super_admin", "admin"] }
  --          { "type": "gender", "values": ["male"] }
  --          { "type": "all" }

  -- Statistics (updated by triggers)
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0 AND total_recipients <= 1000),
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_broadcast_messages_sent_by ON broadcast_messages(sent_by, sent_at DESC);
CREATE INDEX idx_broadcast_messages_sent_at ON broadcast_messages(sent_at DESC);
```

**RLS Policies:**
- Super admins can SELECT, INSERT, UPDATE (view/create broadcasts)
- Regular users have NO access (hidden from them)

---

### Table: `notifications` (Extended)

Existing table extended with broadcast-specific columns.

```sql
ALTER TABLE public.notifications
  ADD COLUMN broadcast_id UUID REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  ADD COLUMN recipient_metadata JSONB DEFAULT '{}',
  ADD COLUMN priority TEXT CHECK (priority IN ('normal', 'high', 'urgent')) DEFAULT 'normal';

-- Add broadcast type to existing constraint
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('profile_link_approved', 'profile_link_rejected',
                  'new_profile_link_request', 'profile_updated',
                  'admin_message', 'system_message', 'admin_broadcast'));
```

**Key Columns for Broadcasts:**
- `broadcast_id`: Links to parent broadcast
- `recipient_metadata`: Stores { profile_id, name, hid } for audit
- `priority`: Inherited from broadcast (for filtering/sorting)
- `push_sent`: Boolean tracking if push was delivered
- `push_sent_at`: Timestamp of push delivery
- `push_error`: Error message if push failed

**Index:**
```sql
CREATE INDEX idx_notifications_broadcast_id ON notifications(broadcast_id)
  WHERE broadcast_id IS NOT NULL;
```

---

### Table: `push_tokens`

Stores Expo push tokens for each authenticated user.

```sql
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, token)
);

CREATE INDEX idx_push_tokens_user_active ON push_tokens(user_id, is_active)
  WHERE is_active = true;
```

**Token Management:**
- Tokens are upserted when user opens the app (`notifications.js:initialize()`)
- Invalid tokens are deactivated by Edge Function (`DeviceNotRegistered` error)
- Users can have multiple tokens (multiple devices)

---

## RPC Functions

### 1. `create_broadcast_notification()`

**Purpose**: Creates a broadcast and sends notifications to all matching recipients.

**Signature:**
```sql
create_broadcast_notification(
  p_title TEXT,
  p_body TEXT,
  p_criteria JSONB,
  p_priority TEXT DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
```

**Parameters:**
- `p_title`: Notification title (3-200 characters)
- `p_body`: Notification body (10-1000 characters)
- `p_criteria`: JSONB targeting criteria (see [Targeting Criteria](#targeting-criteria))
- `p_priority`: `'normal'`, `'high'`, or `'urgent'`
- `p_expires_at`: Optional expiration date (default: 90 days)

**Returns:**
```json
{
  "success": true,
  "broadcast_id": "uuid",
  "total_recipients": 42,
  "delivered_count": 42,
  "sent_at": "2025-01-14T12:00:00Z",
  "message": "Broadcast sent successfully to 42 users"
}
```

**Logic Flow:**

1. **Authentication & Authorization**
   ```sql
   v_sender_auth_id := auth.uid();
   IF NOT verify_super_admin(v_sender_auth_id) THEN
     RAISE EXCEPTION 'Access denied: only super admins can create broadcasts';
   END IF;
   ```

2. **Input Validation**
   - Title: 3-200 characters
   - Body: 10-1000 characters
   - Priority: Must be `normal`, `high`, or `urgent`

3. **Concurrency Control**
   ```sql
   IF NOT pg_try_advisory_xact_lock(hashtext('broadcast_creation')) THEN
     RAISE EXCEPTION 'Another broadcast is currently being sent';
   END IF;
   ```
   - Advisory lock prevents overlapping broadcasts
   - Lock is automatically released at transaction end

4. **Recipient Calculation**
   ```sql
   SELECT COUNT(*) INTO v_recipient_count
   FROM get_broadcast_recipients(p_criteria);

   IF v_recipient_count = 0 THEN
     RAISE EXCEPTION 'No recipients match the specified criteria';
   END IF;

   IF v_recipient_count > 1000 THEN
     RAISE EXCEPTION 'Broadcast too large: % recipients. Maximum allowed is 1000.', v_recipient_count;
   END IF;
   ```

5. **Broadcast Record Creation**
   ```sql
   INSERT INTO broadcast_messages (title, body, sent_by, target_criteria, total_recipients, priority, expires_at)
   VALUES (p_title, p_body, v_sender_profile_id, p_criteria, v_recipient_count, p_priority,
           COALESCE(p_expires_at, NOW() + INTERVAL '90 days'))
   RETURNING id INTO v_broadcast_id;
   ```

6. **Batch Notification Creation** (Critical Performance Optimization)
   ```sql
   -- SINGLE INSERT creates all notifications at once (not a loop!)
   INSERT INTO notifications (user_id, type, title, body, data, broadcast_id, recipient_metadata, priority, expires_at)
   SELECT
     r.user_id,
     'admin_broadcast',
     p_title,
     p_body,
     jsonb_build_object('broadcast_id', v_broadcast_id, 'sent_by_profile_id', v_sender_profile_id, 'criteria', p_criteria),
     v_broadcast_id,
     jsonb_build_object('profile_id', r.profile_id, 'name', r.name, 'hid', r.hid),
     p_priority,
     COALESCE(p_expires_at, NOW() + INTERVAL '90 days')
   FROM get_broadcast_recipients(p_criteria) r;

   GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
   ```

   **Why Batch Insert?**
   - ✅ Single database round-trip (not N queries)
   - ✅ Transactional atomicity (all or nothing)
   - ✅ Massive performance gain for large recipient lists

7. **Statistics Update**
   ```sql
   UPDATE broadcast_messages
   SET delivered_count = v_inserted_count, updated_at = NOW()
   WHERE id = v_broadcast_id;
   ```

**Error Handling:**
```sql
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Broadcast creation failed: %', SQLERRM;
END;
```

---

### 2. `get_broadcast_recipients()`

**Purpose**: Returns list of users matching targeting criteria (for preview and actual sending).

**Signature:**
```sql
get_broadcast_recipients(
  p_criteria JSONB
) RETURNS TABLE (
  user_id UUID,
  profile_id UUID,
  name TEXT,
  phone TEXT,
  hid TEXT
)
```

**Targeting Criteria**

| Type | Values | SQL Filter | Example |
|------|--------|------------|---------|
| `all` | (none) | `deleted_at IS NULL AND user_id IS NOT NULL` | Send to all authenticated users |
| `role` | `['super_admin', 'admin', 'moderator', 'user']` | `role = ANY(ARRAY[...])` | Send to admins only |
| `gender` | `['male', 'female']` | `gender = ANY(ARRAY[...])` | Send to males only |
| `custom` | `[uuid1, uuid2, ...]` | `id = ANY(ARRAY[...]::UUID[])` | Send to specific profiles |

**Example Criteria:**

```javascript
// All users
{ type: 'all' }

// Super admins only
{ type: 'role', values: ['super_admin'] }

// All admins and moderators
{ type: 'role', values: ['super_admin', 'admin', 'moderator'] }

// Female users only
{ type: 'gender', values: ['female'] }

// Specific profiles
{ type: 'custom', values: ['uuid1', 'uuid2', 'uuid3'] }
```

**Critical Filters:**

```sql
WHERE p.deleted_at IS NULL          -- Exclude soft-deleted profiles
  AND p.user_id IS NOT NULL         -- MUST have auth account (can receive notifications)
  AND [additional filter based on type]
```

**Why `user_id IS NOT NULL` is Critical:**

- Notifications are sent to `auth.users` (the authentication table)
- Profiles without `user_id` are "unlinked" (no auth account exists)
- Trying to send to `user_id = NULL` would fail the foreign key constraint
- This is **by design** - only authenticated users can receive notifications

**Performance:**

```sql
CREATE INDEX idx_profiles_broadcast_targeting
  ON profiles(role, gender, current_residence, deleted_at, user_id)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;
```

This composite index is optimal for all targeting query patterns.

---

### 3. `get_broadcast_history()`

**Purpose**: Returns paginated list of past broadcasts with statistics.

**Signature:**
```sql
get_broadcast_history(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  sender_name TEXT,
  sender_id UUID,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER,
  delivered_count INTEGER,
  read_count INTEGER,
  read_percentage NUMERIC,
  target_criteria JSONB,
  priority TEXT
)
```

**SQL Logic:**

```sql
SELECT
  bm.id,
  bm.title,
  bm.body,
  p.name as sender_name,
  bm.sent_by as sender_id,
  bm.sent_at,
  bm.total_recipients,
  bm.delivered_count,
  COUNT(n.id) FILTER (WHERE n.is_read = true)::INTEGER as read_count,
  CASE
    WHEN bm.total_recipients > 0
    THEN ROUND((COUNT(n.id) FILTER (WHERE n.is_read = true)::NUMERIC / bm.total_recipients) * 100, 1)
    ELSE 0
  END as read_percentage,
  bm.target_criteria,
  bm.priority
FROM broadcast_messages bm
LEFT JOIN profiles p ON p.id = bm.sent_by
LEFT JOIN notifications n ON n.broadcast_id = bm.id
GROUP BY bm.id, p.name, ...
ORDER BY bm.sent_at DESC
LIMIT p_limit
OFFSET p_offset;
```

**Features:**
- ✅ Real-time read statistics via aggregate
- ✅ Percentage calculation with rounding
- ✅ Sender name join
- ✅ Ordered by most recent
- ✅ Paginated (default 50 per page)

---

### 4. `get_broadcast_statistics()`

**Purpose**: Returns detailed statistics for a specific broadcast.

**Signature:**
```sql
get_broadcast_statistics(
  p_broadcast_id UUID
) RETURNS TABLE (
  broadcast_id UUID,
  total_recipients INTEGER,
  delivered_count INTEGER,
  read_count INTEGER,
  read_percentage NUMERIC,
  unread_count INTEGER,
  sent_at TIMESTAMPTZ,
  title TEXT,
  body TEXT
)
```

**Use Cases:**
- View detailed engagement metrics
- Monitor broadcast performance
- Audit trail verification

---

## Push Notification Flow

### Overview

The broadcast system uses a **two-phase delivery model**:

1. **Phase 1 (Database)**: RPC function creates notification rows (in-app notifications)
2. **Phase 2 (Push)**: Client calls helper function to trigger iOS/Android push

This separation ensures:
- ✅ Database notifications always succeed (fallback)
- ✅ Push failures don't block broadcast creation
- ✅ Non-blocking architecture (better UX)

---

### Phase 1: Database Notification Creation

**File**: `supabase/migrations/20251014150000_broadcast_notifications.sql`

```sql
-- RPC creates notification rows
INSERT INTO notifications (user_id, type, title, body, data, broadcast_id, ...)
SELECT r.user_id, 'admin_broadcast', p_title, p_body, ...
FROM get_broadcast_recipients(p_criteria) r;
```

**Result**:
- Each recipient gets a row in `notifications` table
- `push_sent = false` initially
- Visible in `NotificationCenter` component immediately

---

### Phase 2: Push Notification Delivery

#### Step 1: Client Helper Function

**File**: `src/services/notifications.js`

```javascript
export async function sendBroadcastPushNotifications(broadcastId, criteria, title, body) {
  // 1. Get recipients with user_ids
  const { data: recipients } = await supabase.rpc('get_broadcast_recipients', {
    p_criteria: criteria
  });

  // 2. Extract user_ids (filter out nulls)
  const userIds = recipients.map(r => r.user_id).filter(Boolean);

  // 3. Invoke Edge Function with array of user IDs
  const { data: result } = await supabase.functions.invoke("send-push-notification", {
    body: {
      userIds,  // Array: ['uuid1', 'uuid2', 'uuid3', ...]
      title,
      body,
      data: {
        type: NotificationTypes.ADMIN_BROADCAST,
        broadcast_id: broadcastId
      },
      priority: 'high',
      sound: 'default'
    },
  });

  return result;
}
```

**Called From**: `AdminBroadcastManager.tsx` after successful broadcast creation

```typescript
if (data) {
  // Send push notifications (non-blocking)
  try {
    await sendBroadcastPushNotifications(
      data.broadcast_id,
      criteria,
      title.trim(),
      body.trim()
    );
  } catch (pushError) {
    // Non-critical - database notifications already sent
    console.error('Push notification error:', pushError);
  }
}
```

---

#### Step 2: Edge Function Processing

**File**: `supabase/functions/send-push-notification/index.ts`

```typescript
interface NotificationPayload {
  userId?: string      // Single user
  userIds?: string[]   // Array of users (for broadcasts)
  title: string
  body: string
  data?: Record<string, any>
  priority?: 'default' | 'normal' | 'high'
  sound?: string | null
  badge?: number
}
```

**Logic:**

1. **Get Target User IDs**
   ```typescript
   const targetUserIds = userIds || (userId ? [userId] : []);
   ```

2. **Fetch Push Tokens**
   ```typescript
   const { data: pushTokens } = await supabase
     .from('push_tokens')
     .select('token, user_id')
     .in('user_id', targetUserIds)
     .eq('is_active', true)
   ```

3. **Validate Token Format**
   ```typescript
   // Skip invalid Expo push tokens
   if (!token.startsWith('ExponentPushToken[') || !token.endsWith(']')) {
     console.warn(`Invalid token format: ${token}`);
     continue;
   }
   ```

4. **Create Expo Messages**
   ```typescript
   const message: ExpoPushMessage = {
     to: token,
     sound: 'default',
     title: title,
     body: body,
     data: {
       ...data,
       userId: user_id,
       timestamp: new Date().toISOString()
     },
     priority: 'high',
     channelId: 'default'
   };
   ```

5. **Batch Sending (Max 100 per request)**
   ```typescript
   // Expo API allows max 100 notifications per request
   for (const batch of batches) {
     const response = await fetch('https://exp.host/--/api/v2/push/send', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(batch)
     });
   }
   ```

6. **Update Notification Records**
   ```typescript
   if (ticket.status === 'ok') {
     totalSent++;

     // Mark as sent
     await supabase
       .from('notifications')
       .update({ push_sent: true, push_sent_at: new Date().toISOString() })
       .eq('user_id', userId)
       .is('push_sent', false)
       .gte('created_at', new Date(Date.now() - 60000).toISOString())
   }
   ```

7. **Handle Errors**
   ```typescript
   if (ticket.details?.error === 'DeviceNotRegistered') {
     // Token is invalid/expired - deactivate it
     await supabase
       .from('push_tokens')
       .update({ is_active: false })
       .eq('token', message.to)
   }
   ```

**Returns:**
```json
{
  "success": true,
  "sent": 42,
  "errors": 0,
  "results": [ /* Expo API responses */ ]
}
```

---

### Token Management

#### Token Collection

**File**: `src/services/notifications.js`

```javascript
class NotificationService {
  async initialize() {
    // 1. Request permissions
    const { status } = await Notifications.requestPermissionsAsync();

    // 2. Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    // 3. Save to database
    await this.savePushToken(token.data);
  }

  async savePushToken(token) {
    await supabase
      .from("push_tokens")
      .upsert({
        user_id: user.id,
        token: token,  // Format: ExponentPushToken[...]
        platform: Device.osName?.toLowerCase(),
        is_active: true,
      }, {
        onConflict: 'user_id,token'
      });
  }
}
```

**Called From**: `app/(app)/_layout.tsx` when user is authenticated

```typescript
useEffect(() => {
  if (user && isAuthenticated && !notificationInitialized) {
    notificationService.initialize();
  }
}, [user, isAuthenticated]);
```

#### Token Validation

**Valid Format**: `ExponentPushToken[xxxxxxxxxxxxxx]`

**Invalid Tokens Are:**
- Deactivated automatically if `DeviceNotRegistered` error occurs
- Skipped during batch sending
- Not counted in success metrics

---

## Security & Permissions

### Role-Based Access Control

**Super Admin Only:**

```sql
CREATE OR REPLACE FUNCTION verify_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = p_user_id
      AND role = 'super_admin'
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**All Broadcast Functions Check This:**
```sql
IF NOT verify_super_admin(auth.uid()) THEN
  RAISE EXCEPTION 'Access denied: super_admin role required';
END IF;
```

**Why `SECURITY DEFINER`?**
- Function runs with creator's privileges (not caller's)
- Allows controlled access to privileged operations
- RLS policies can be bypassed within the function

---

### Row-Level Security (RLS)

**Broadcast Messages Table:**

```sql
-- Super admins can view all broadcasts
CREATE POLICY broadcast_messages_super_admin_select
  ON broadcast_messages FOR SELECT
  TO authenticated
  USING (verify_super_admin(auth.uid()));

-- Super admins can create broadcasts
CREATE POLICY broadcast_messages_super_admin_insert
  ON broadcast_messages FOR INSERT
  TO authenticated
  WITH CHECK (verify_super_admin(auth.uid()));
```

**Notifications Table:**
```sql
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Result:**
- ✅ Super admins see broadcast metadata
- ✅ Regular users see only their notification rows
- ✅ No user can see who else received the broadcast

---

### Concurrency Control

**Advisory Locks Prevent Overlapping Broadcasts:**

```sql
IF NOT pg_try_advisory_xact_lock(hashtext('broadcast_creation')) THEN
  RAISE EXCEPTION 'Another broadcast is currently being sent. Please wait and try again.';
END IF;
```

**How It Works:**
1. First broadcast acquisition attempt succeeds
2. Second broadcast attempt (while first is running) fails immediately
3. Lock is automatically released when transaction commits/rolls back

**Benefits:**
- ✅ Prevents race conditions
- ✅ Ensures sequential processing
- ✅ Avoids database contention

---

### Input Validation

**Title & Body Constraints:**
```sql
CHECK (length(title) >= 3 AND length(title) <= 200)
CHECK (length(body) >= 10 AND length(body) <= 1000)
```

**Priority Constraint:**
```sql
CHECK (priority IN ('normal', 'high', 'urgent'))
```

**Recipient Limit:**
```sql
IF v_recipient_count > 1000 THEN
  RAISE EXCEPTION 'Broadcast too large: % recipients. Maximum allowed is 1000.', v_recipient_count;
END IF;
```

**Why 1000 Limit?**
- Prevents accidental mass broadcasts
- Keeps database operations performant
- Forces admin to think about targeting

---

## Audit Logging

### Enhanced Audit Trail

**Migration**: `supabase/migrations/enhance_broadcast_audit_logging.sql`

```sql
CREATE OR REPLACE FUNCTION log_broadcast_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    action_category,
    old_data,
    new_data,
    actor_id,
    actor_type,
    description,
    metadata
  ) VALUES (
    'broadcast_messages',
    NEW.id,
    'broadcast_notification_created',
    'notification',
    NULL,
    to_jsonb(NEW),
    auth.uid(),
    'super_admin',
    format('Broadcast notification sent: "%s" to %s recipients (%s priority)',
      NEW.title,
      NEW.total_recipients,
      NEW.priority
    ),
    jsonb_build_object(
      'broadcast_id', NEW.id,
      'title', NEW.title,
      'body_preview', LEFT(NEW.body, 100),
      'recipient_count', NEW.total_recipients,
      'priority', NEW.priority,
      'target_criteria', NEW.target_criteria,
      'sent_at', NEW.sent_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_broadcast_creation
  AFTER INSERT ON broadcast_messages
  FOR EACH ROW
  EXECUTE FUNCTION log_broadcast_creation();
```

**Audit Log Entry Example:**
```json
{
  "action_type": "broadcast_notification_created",
  "description": "Broadcast notification sent: \"تحديث مهم\" to 42 recipients (high priority)",
  "metadata": {
    "broadcast_id": "uuid",
    "title": "تحديث مهم",
    "body_preview": "نود إعلامكم بتحديث مهم في النظام...",
    "recipient_count": 42,
    "priority": "high",
    "target_criteria": { "type": "role", "values": ["admin"] },
    "sent_at": "2025-01-14T12:00:00Z"
  }
}
```

**Benefits:**
- ✅ Searchable by title
- ✅ Shows who sent what to whom
- ✅ Includes priority and targeting criteria
- ✅ Body preview for quick reference

---

### Read Statistics Tracking

**Trigger**: Updates read count when notification is marked as read

```sql
CREATE OR REPLACE FUNCTION update_broadcast_read_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false AND NEW.broadcast_id IS NOT NULL THEN
    UPDATE broadcast_messages
    SET read_count = read_count + 1,
        updated_at = NOW()
    WHERE id = NEW.broadcast_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_broadcast_read_count
  AFTER UPDATE ON notifications
  FOR EACH ROW
  WHEN (NEW.is_read = true AND OLD.is_read = false AND NEW.broadcast_id IS NOT NULL)
  EXECUTE FUNCTION update_broadcast_read_count();
```

**Real-Time Updates:**
- User marks notification as read → trigger fires
- `broadcast_messages.read_count` increments
- History view shows updated statistics immediately

---

## Client Integration

### Service Layer

**File**: `src/services/broadcastNotifications.ts`

```typescript
// Preview recipients before sending
export async function previewBroadcastRecipients(
  criteria: BroadcastCriteria
): Promise<ServiceResponse<BroadcastRecipient[]>>

// Create and send broadcast
export async function createBroadcast(
  params: CreateBroadcastParams
): Promise<ServiceResponse<CreateBroadcastResponse>>

// Get history (paginated)
export async function getBroadcastHistory(
  limit: number = 50,
  offset: number = 0
): Promise<ServiceResponse<BroadcastHistoryItem[]>>

// Get statistics for specific broadcast
export async function getBroadcastStatistics(
  broadcastId: string
): Promise<ServiceResponse<BroadcastStatistics>>
```

**Error Handling:**
```typescript
function handleError(error: any): ErrorResponse {
  if (error.message.includes('super_admin')) {
    return { message: 'هذه الميزة متاحة فقط للمشرفين الرئيسيين', code: 'PERMISSION_DENIED' };
  }
  if (error.message.includes('No recipients')) {
    return { message: 'لا يوجد مستخدمين يطابقون المعايير المحددة', code: 'NO_RECIPIENTS' };
  }
  // ... more error mappings
}
```

---

### UI Component

**File**: `src/components/admin/AdminBroadcastManager.tsx`

**Key Features:**
- Unified compose + history interface
- Real-time recipient preview (debounced 300ms)
- Role/gender targeting with chips
- Importance level selection
- Collapsible history section
- No loading spinners (instant feedback)

**Integration:**
```typescript
// Admin Dashboard
import AdminBroadcastManager from '../components/admin/AdminBroadcastManager';

const [showBroadcastManager, setShowBroadcastManager] = useState(false);

// Single button
<TouchableOpacity onPress={() => setShowBroadcastManager(true)}>
  <Text>إشعارات جماعية</Text>
</TouchableOpacity>

// Modal
{showBroadcastManager && (
  <Modal>
    <AdminBroadcastManager onClose={() => setShowBroadcastManager(false)} />
  </Modal>
)}
```

---

## Testing & Monitoring

### Manual Testing Checklist

**Targeting Tests:**
```bash
# 1. All users
SELECT COUNT(*) FROM get_broadcast_recipients('{"type": "all"}'::jsonb);
# Expected: Number of users with auth accounts

# 2. Super admins only
SELECT COUNT(*) FROM get_broadcast_recipients('{"type": "role", "values": ["super_admin"]}'::jsonb);
# Expected: 2 (or your super admin count)

# 3. Males only
SELECT COUNT(*) FROM get_broadcast_recipients('{"type": "gender", "values": ["male"]}'::jsonb);
# Expected: 4 (based on current data)

# 4. Females only
SELECT COUNT(*) FROM get_broadcast_recipients('{"type": "gender", "values": ["female"]}'::jsonb);
# Expected: 0 (no female users with auth accounts yet)
```

**Broadcast Creation Test:**
```sql
SELECT create_broadcast_notification(
  'Test Broadcast',
  'This is a test broadcast message to verify the system is working correctly.',
  '{"type": "role", "values": ["super_admin"]}'::jsonb,
  'normal',
  NULL
);
```

**Expected Result:**
```json
{
  "success": true,
  "broadcast_id": "uuid",
  "total_recipients": 2,
  "delivered_count": 2,
  "sent_at": "timestamp",
  "message": "Broadcast sent successfully to 2 users"
}
```

---

### Monitoring Queries

**Recent Broadcasts:**
```sql
SELECT
  id,
  title,
  total_recipients,
  delivered_count,
  read_count,
  ROUND((read_count::NUMERIC / NULLIF(total_recipients, 0)) * 100, 1) as read_percentage,
  sent_at
FROM broadcast_messages
ORDER BY sent_at DESC
LIMIT 10;
```

**Push Token Health:**
```sql
SELECT
  platform,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
FROM push_tokens
GROUP BY platform;
```

**Notification Delivery Status:**
```sql
SELECT
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE push_sent = true) as push_sent,
  COUNT(*) FILTER (WHERE push_sent = false) as push_pending,
  COUNT(*) FILTER (WHERE push_error IS NOT NULL) as push_failed
FROM notifications
WHERE broadcast_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

---

### Performance Monitoring

**Slow Query Detection:**
```sql
-- Check execution time of broadcast creation
EXPLAIN ANALYZE
SELECT create_broadcast_notification(
  'Performance Test',
  'Testing broadcast creation performance with explain analyze.',
  '{"type": "all"}'::jsonb,
  'normal',
  NULL
);
```

**Index Usage Verification:**
```sql
-- Ensure index is being used for targeting queries
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM get_broadcast_recipients('{"type": "role", "values": ["admin"]}'::jsonb);
```

Look for: `Index Scan using idx_profiles_broadcast_targeting`

---

## Troubleshooting

### Common Issues

#### Issue 1: "No recipients match the specified criteria"

**Symptoms**: Broadcast creation fails with recipient count = 0

**Causes:**
1. **No users with auth accounts**
   ```sql
   SELECT COUNT(*) FROM profiles WHERE user_id IS NOT NULL AND deleted_at IS NULL;
   ```
   If 0: Users haven't created accounts yet (expected in early development)

2. **Wrong role values**
   ```sql
   -- WRONG: 'moderator' (generic)
   -- RIGHT: 'moderator' (app uses same value)

   SELECT role, COUNT(*) FROM profiles WHERE user_id IS NOT NULL GROUP BY role;
   ```

3. **Gender filter with no matches**
   ```sql
   SELECT gender, COUNT(*) FROM profiles WHERE user_id IS NOT NULL GROUP BY gender;
   ```
   If all male: Female filter will return 0 (this is correct behavior)

**Solution:**
- Verify targeting criteria matches actual data
- Check user account linking (`user_id IS NOT NULL`)
- Use "All Users" targeting for testing

---

#### Issue 2: Push notifications not received

**Symptoms**: Database notifications work, but no iOS/Android push

**Debugging Steps:**

1. **Check Edge Function logs**
   ```bash
   # Use Supabase MCP tool
   get_logs(service: 'edge-function')
   ```

2. **Verify push tokens exist**
   ```sql
   SELECT user_id, token, platform, is_active, last_used
   FROM push_tokens
   WHERE user_id = 'target_user_id';
   ```

3. **Check token format**
   ```sql
   SELECT token FROM push_tokens
   WHERE NOT (token LIKE 'ExponentPushToken[%]' AND token LIKE '%]');
   -- Should return no rows
   ```

4. **Test Edge Function directly**
   ```javascript
   const { data, error } = await supabase.functions.invoke('send-push-notification', {
     body: {
       userId: 'test_user_id',
       title: 'Test Push',
       body: 'Testing push notification delivery',
       data: { test: true },
       priority: 'high',
       sound: 'default'
     }
   });
   console.log({ data, error });
   ```

5. **Check notification settings on device**
   - iOS: Settings → Notifications → [Your App] → Allow Notifications (ON)
   - Android: Settings → Apps → [Your App] → Notifications (Enabled)

**Common Causes:**
- User denied notification permissions
- Invalid/expired push token
- Edge Function not deployed
- Network connectivity issues

---

#### Issue 3: "Another broadcast is currently being sent"

**Symptoms**: Second broadcast attempt fails immediately

**Cause**: Advisory lock from previous broadcast still held

**Solutions:**

1. **Wait for first broadcast to complete** (usually < 5 seconds)

2. **Check for stuck transactions**
   ```sql
   SELECT pid, state, query_start, NOW() - query_start as duration, query
   FROM pg_stat_activity
   WHERE query LIKE '%broadcast%' AND state != 'idle';
   ```

3. **Force release lock** (last resort)
   ```sql
   SELECT pg_advisory_unlock_all();
   ```
   ⚠️ **Warning**: Only do this if you're certain no broadcast is running

---

#### Issue 4: Slow broadcast creation (> 5 seconds)

**Symptoms**: Create broadcast takes long time

**Diagnosis:**

1. **Check recipient count**
   ```sql
   SELECT COUNT(*) FROM get_broadcast_recipients('{"type": "all"}'::jsonb);
   ```
   If > 500: Consider narrowing criteria

2. **Verify index usage**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM get_broadcast_recipients('{"type": "role", "values": ["admin"]}'::jsonb);
   ```
   Should use `idx_profiles_broadcast_targeting`

3. **Check database load**
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

**Solutions:**
- Ensure indexes are created
- Run `VACUUM ANALYZE profiles;` to update statistics
- Break large broadcasts into smaller targeted ones

---

### Debug Queries

**View broadcast with full details:**
```sql
SELECT
  bm.*,
  p.name as sender_name,
  p.role as sender_role,
  (SELECT COUNT(*) FROM notifications WHERE broadcast_id = bm.id) as notification_count,
  (SELECT COUNT(*) FROM notifications WHERE broadcast_id = bm.id AND is_read = true) as read_count
FROM broadcast_messages bm
JOIN profiles p ON p.id = bm.sent_by
WHERE bm.id = 'broadcast_uuid'::uuid;
```

**View all notifications for a broadcast:**
```sql
SELECT
  n.id,
  n.user_id,
  n.title,
  n.is_read,
  n.push_sent,
  n.push_error,
  n.created_at,
  n.read_at,
  n.recipient_metadata
FROM notifications n
WHERE n.broadcast_id = 'broadcast_uuid'::uuid
ORDER BY n.created_at;
```

**Check audit trail:**
```sql
SELECT
  action_type,
  description,
  metadata,
  created_at
FROM audit_log_enhanced
WHERE record_id = 'broadcast_uuid'::uuid
ORDER BY created_at DESC;
```

---

## Summary

The Broadcast Notification System is a production-ready, performant solution for sending targeted notifications to multiple users. Key strengths:

✅ **Performance**: Batch inserts, composite indexes, advisory locks
✅ **Reliability**: Two-phase delivery (database + push), error handling, token validation
✅ **Security**: Role-based access, RLS policies, input validation
✅ **Auditability**: Detailed logging, read tracking, engagement metrics
✅ **Scalability**: Supports up to 1000 recipients per broadcast

**Production Deployment Checklist:**
- [ ] Verify all migrations applied successfully
- [ ] Test with small recipient group first
- [ ] Monitor Edge Function logs for errors
- [ ] Check push token collection is working
- [ ] Verify audit logs are being created
- [ ] Set up monitoring alerts for failed broadcasts

---

**Last Updated**: January 2025
**Version**: 1.0
**Maintainer**: Claude Code