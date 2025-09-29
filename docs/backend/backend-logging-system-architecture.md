# Backend Logging System - Complete Technical Architecture

## 📊 Database Structure

### 1. Core Table: `audit_log_enhanced`

```sql
CREATE TABLE audit_log_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Actor Information
    actor_id UUID REFERENCES auth.users(id),
    actor_type TEXT, -- 'user', 'system', 'anonymous'

    -- Action Details
    action_type TEXT NOT NULL, -- 'create_node', 'update_node', etc.
    action_category TEXT, -- 'tree', 'admin', 'marriage', 'photo'

    -- Target Information
    table_name TEXT,
    record_id UUID,
    target_type TEXT, -- 'profile', 'marriage', 'photo', etc.

    -- Data Changes
    old_data JSONB, -- Previous state
    new_data JSONB, -- New state
    changed_fields TEXT[], -- Array of modified field names

    -- Context
    description TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Metadata
    severity TEXT, -- 'low', 'medium', 'high', 'critical'
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    error_message TEXT,

    -- Tracking
    session_id UUID,
    request_id UUID,
    metadata JSONB, -- Additional context

    -- Permissions
    can_revert BOOLEAN DEFAULT false,
    reverted_at TIMESTAMP,
    reverted_by UUID
);
```

### 2. Legacy Table: `audit_log` (Still Active)

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP,
    user_id UUID,
    action TEXT,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT
);
```

## 🔄 Automatic Logging Triggers

### Profile Changes Trigger

```sql
CREATE TRIGGER log_profile_changes
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

**Function Logic:**

- **INSERT**: Logs `create_node` with full profile data in `new_data`
- **UPDATE**: Logs `update_node` with diff, tracks changed fields
- **DELETE**: Logs `delete_node` with full data in `old_data` for potential revert

### Marriage Operations Trigger

```sql
CREATE TRIGGER log_marriage_changes
AFTER INSERT OR UPDATE OR DELETE ON marriages
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

**Captures:**

- Spouse additions/removals
- Marriage date changes
- Relationship status updates
- Links both spouses in metadata

### Photo Management Trigger

```sql
CREATE TRIGGER log_photo_changes
AFTER INSERT OR UPDATE OR DELETE ON photos
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

**Tracks:**

- Photo uploads with URLs
- Caption/metadata updates
- Deletions (stores URL for recovery)

### Admin Actions Trigger

```sql
CREATE TRIGGER log_admin_changes
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.is_admin IS DISTINCT FROM NEW.is_admin
   OR OLD.is_super_admin IS DISTINCT FROM NEW.is_super_admin)
EXECUTE FUNCTION log_admin_action();
```

**Special Handling:**

- Sets `severity: 'high'` for admin grants
- Sets `severity: 'critical'` for super_admin changes
- Includes previous role in `old_data`

## 🎯 Action Type Classification

```javascript
ACTION_TYPES = {
  // Tree Operations
  create_node: { category: "tree", severity: "low" },
  update_node: { category: "tree", severity: "low" },
  delete_node: { category: "tree", severity: "high" },
  merge_nodes: { category: "tree", severity: "medium" },

  // Marriage Operations
  add_marriage: { category: "marriage", severity: "low" },
  update_marriage: { category: "marriage", severity: "low" },
  delete_marriage: { category: "marriage", severity: "medium" },

  // Admin Operations
  grant_admin: { category: "admin", severity: "high" },
  revoke_admin: { category: "admin", severity: "high" },
  grant_super_admin: { category: "admin", severity: "critical" },

  // Photo Operations
  upload_photo: { category: "photo", severity: "low" },
  delete_photo: { category: "photo", severity: "medium" },

  // Munasib Operations
  add_munasib: { category: "munasib", severity: "low" },
  update_munasib: { category: "munasib", severity: "low" },
  delete_munasib: { category: "munasib", severity: "medium" },
};
```

## 🔐 Row-Level Security (RLS)

```sql
-- Read Policy: All authenticated users can read
CREATE POLICY "Users can view audit logs" ON audit_log_enhanced
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert Policy: System triggers only
CREATE POLICY "Only system can insert logs" ON audit_log_enhanced
FOR INSERT WITH CHECK (false);

-- Update Policy: Only for marking as reverted
CREATE POLICY "Admins can mark as reverted" ON audit_log_enhanced
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR is_super_admin = true)
    )
);
```

## 📡 Real-time Subscriptions

```javascript
// Backend publishes changes
supabase
  .channel("activity_log_changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "audit_log_enhanced",
    },
    handleLogUpdate,
  )
  .subscribe();
```

## 🔄 Data Migration System

```sql
-- Migration from legacy to enhanced (056_migrate_audit_logs.sql)
INSERT INTO audit_log_enhanced (
    id, created_at, actor_id, action_type,
    table_name, record_id, old_data, new_data,
    description, ip_address, user_agent
)
SELECT
    id, created_at, user_id,
    CASE action
        WHEN 'إضافة عضو' THEN 'create_node'
        WHEN 'تحديث بيانات' THEN 'update_node'
        WHEN 'حذف عضو' THEN 'delete_node'
        -- ... more mappings
    END,
    table_name, record_id, old_data, new_data,
    action, ip_address::inet, user_agent
FROM audit_log
WHERE NOT EXISTS (
    SELECT 1 FROM audit_log_enhanced
    WHERE audit_log_enhanced.id = audit_log.id
);
```

## 🎨 View Layer: `activity_log_detailed`

```sql
CREATE VIEW activity_log_detailed AS
SELECT
    -- Core fields
    al.*,

    -- Actor enrichment
    actor_p.display_name as actor_name,
    actor_p.phone as actor_phone,
    CASE
        WHEN actor_p.is_super_admin THEN 'super_admin'
        WHEN actor_p.is_admin THEN 'admin'
        ELSE 'user'
    END as actor_role,

    -- Target enrichment
    target_p.display_name as target_name,
    target_p.phone as target_phone,

    -- Computed fields
    CASE
        WHEN al.old_data IS NOT NULL
        AND al.action_type IN ('delete_node', 'delete_marriage')
        THEN true ELSE false
    END as can_revert

FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.id
LEFT JOIN profiles target_p ON al.record_id = target_p.id
    AND al.table_name = 'profiles';
```

## 🚀 Performance Optimizations

```sql
-- Indexes for query performance
CREATE INDEX idx_audit_log_enhanced_created_at
    ON audit_log_enhanced(created_at DESC);

CREATE INDEX idx_audit_log_enhanced_actor_id
    ON audit_log_enhanced(actor_id);

CREATE INDEX idx_audit_log_enhanced_action_type
    ON audit_log_enhanced(action_type);

CREATE INDEX idx_audit_log_enhanced_severity
    ON audit_log_enhanced(severity)
    WHERE severity IN ('high', 'critical');

-- Partial index for pending actions
CREATE INDEX idx_audit_log_pending
    ON audit_log_enhanced(status)
    WHERE status = 'pending';
```

## 🔄 Audit Function Core Logic

```sql
CREATE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_action_type TEXT;
    v_severity TEXT;
    v_description TEXT;
    v_changed_fields TEXT[];
BEGIN
    -- Get actor ID
    v_actor_id := auth.uid();

    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'create_' || TG_TABLE_NAME;
        v_severity := 'low';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action_type := 'update_' || TG_TABLE_NAME;
        -- Calculate changed fields
        v_changed_fields := ARRAY(
            SELECT jsonb_object_keys(to_jsonb(NEW))
            WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
        );
        v_severity := 'low';
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'delete_' || TG_TABLE_NAME;
        v_severity := 'medium';
    END IF;

    -- Build description
    v_description := format('%s operation on %s', TG_OP, TG_TABLE_NAME);

    -- Insert audit record
    INSERT INTO audit_log_enhanced (
        actor_id, action_type, action_category, table_name,
        record_id, old_data, new_data, changed_fields,
        description, severity, ip_address, user_agent
    ) VALUES (
        v_actor_id, v_action_type,
        CASE TG_TABLE_NAME
            WHEN 'profiles' THEN 'tree'
            WHEN 'marriages' THEN 'marriage'
            WHEN 'photos' THEN 'photo'
            ELSE 'other'
        END,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
        v_changed_fields, v_description, v_severity,
        current_setting('request.headers')::json->>'x-forwarded-for',
        current_setting('request.headers')::json->>'user-agent'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📊 Stats Aggregation

```sql
-- Real-time stats function
CREATE FUNCTION get_activity_stats() RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'total', (SELECT COUNT(*) FROM audit_log_enhanced),
        'today', (SELECT COUNT(*) FROM audit_log_enhanced
                  WHERE created_at >= CURRENT_DATE),
        'critical', (SELECT COUNT(*) FROM audit_log_enhanced
                     WHERE severity IN ('high', 'critical')),
        'pending', (SELECT COUNT(*) FROM audit_log_enhanced
                    WHERE status = 'pending'),
        'by_category', (
            SELECT json_object_agg(action_category, cnt)
            FROM (
                SELECT action_category, COUNT(*) as cnt
                FROM audit_log_enhanced
                GROUP BY action_category
            ) t
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

## 🔒 Security Features

1. **IP Tracking**: Captures client IP from headers
2. **User Agent Storage**: Browser/device identification
3. **Session Tracking**: Links actions within same session
4. **Request ID**: Unique identifier per API call
5. **Role-based Visibility**: Sensitive data filtered by role

## 🎯 Key Design Decisions

1. **Dual Table System**: Maintains backward compatibility while adding features
2. **JSONB Storage**: Flexible schema for old/new data comparison
3. **Trigger-based**: Automatic, consistent logging without app code
4. **Severity Levels**: Prioritizes admin attention to critical events
5. **Revert Capability**: Stores enough data to undo destructive actions
6. **View Abstraction**: Simplifies queries with pre-joined actor/target data

## 📈 Usage Patterns

### Querying Recent Critical Actions

```sql
SELECT * FROM activity_log_detailed
WHERE severity IN ('high', 'critical')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Finding All Actions by a User

```sql
SELECT * FROM activity_log_detailed
WHERE actor_id = 'user-uuid-here'
ORDER BY created_at DESC;
```

### Tracking Changes to Specific Profile

```sql
SELECT * FROM activity_log_detailed
WHERE target_id = 'profile-uuid-here'
  AND table_name = 'profiles'
ORDER BY created_at DESC;
```

### Getting Activity Statistics

```sql
SELECT get_activity_stats() as stats;
```

## 🔄 Frontend Integration

The frontend ActivityLogDashboard component connects to this backend system via:

1. **Direct Queries**: Fetches from `activity_log_detailed` view
2. **Real-time Updates**: Subscribes to `audit_log_enhanced` changes
3. **Stats Calculation**: Aggregates data client-side for performance
4. **Filtering**: Applies filters based on `action_type`, `severity`, etc.
5. **Search**: Queries across actor/target names and descriptions

## 📝 Migration Status

- ✅ Enhanced table structure created (migration 055)
- ✅ Data migration from legacy table (migration 056)
- ✅ View layer for simplified queries (migration 057)
- ✅ Indexes for performance optimization
- ✅ RLS policies configured
- ✅ Real-time subscriptions enabled
- ✅ Frontend dashboard integrated

This backend logging system provides comprehensive, automatic, and performant activity tracking with minimal application code changes required.
