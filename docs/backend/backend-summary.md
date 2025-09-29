# Backend Architecture Summary

## Overview

The Alqefari Family Tree application uses Supabase as its backend, providing a PostgreSQL database, real-time subscriptions, authentication, and edge functions. The backend is fully implemented and optimized for managing family trees with 10,000+ nodes.

## Core Components

### 1. Database Schema

The database uses a normalized schema with these core tables:

- **profiles** - Person data (name, bio, dates, relationships, etc.)
- **marriages** - Marriage relationships between people
- **background_jobs** - Async job queue for layout calculations
- **audit_log** - Complete history of all admin actions
- **media_uploads** - Profile photo management (pending approval workflow)

Key design decisions:
- Single source of truth (no redundant data)
- JSONB fields for flexible data (dates, social media links)
- Hierarchical ID (HID) system for human-readable positions
- Soft deletes with `deleted_at` timestamps

### 2. Authentication & Authorization

- **Supabase Auth** handles user authentication
- **Role-based access** via `user_roles` table
- **RLS policies** enforce row-level security
- **Admin functions** use SECURITY DEFINER for elevated permissions

Admin roles:
- `SUPER_ADMIN` - Full system access
- `BRANCH_ADMIN` - Limited to specific branches
- Regular users - Read-only access

### 3. API Functions (RPCs)

Key RPC functions for the frontend:

```javascript
// Branch-based data loading (replaces full tree loading)
supabase.rpc('get_branch_data', { p_hid, p_max_depth, p_limit })

// Viewport-based loading for performance
supabase.rpc('get_visible_nodes', { viewport, zoom_level })

// Admin operations
supabase.rpc('admin_create_profile', { profile_data })
supabase.rpc('admin_bulk_create_children', { parent_id, children })
supabase.rpc('admin_revert_action', { log_id })
```

### 4. Real-time Subscriptions

The app uses Supabase real-time for live updates:

```javascript
// Subscribe to all profile changes
supabase.channel('profiles-all')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handler)

// Subscribe to background jobs
supabase.channel('background-jobs')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'background_jobs' }, handler)
```

### 5. Edge Functions

- **recalculate-layout** - Asynchronously recalculates tree layout positions
  - Triggered after bulk operations
  - Updates `background_jobs` table with progress
  - Prevents UI freezing on large operations

### 6. Storage

- **profile-photos** bucket for user avatars
- Integrated with `storage.js` service
- Supports image upload with automatic resizing

## HID (Hierarchical ID) System

Every person has a unique HID that encodes their position:

- **Format**: `R1` (root), `R1.1` (first child), `R1.1.1` (grandchild)
- **Benefits**: Human-readable, shows family relationships, enables efficient queries
- **Generation**: Automatic via database functions

Example HID queries:
```sql
-- Get all descendants of a person
SELECT * FROM profiles WHERE hid LIKE 'R1.2.%';

-- Get direct children
SELECT * FROM profiles WHERE father_id = ? ORDER BY sibling_order;
```

## Performance Optimizations

1. **Branch-based loading** - Load only visible portions of the tree
2. **Viewport culling** - Fetch only nodes in the current viewport
3. **Indexed fields** - HID, father_id, generation for fast queries
4. **Async operations** - Layout calculations run in background
5. **Connection pooling** - Reuse database connections

## Frontend Integration

The frontend integrates via service files:

- `src/services/supabase.js` - Supabase client initialization
- `src/services/profiles.js` - Profile CRUD operations
- `src/services/realtimeProfiles.js` - Real-time subscriptions
- `src/services/backgroundJobs.js` - Job monitoring
- `src/services/storage.js` - Photo uploads

## Development Workflow

### Running Migrations
```bash
# Push all migrations to Supabase
supabase db push

# Or deploy specific migration
supabase migration up --file migrations/XXX_migration_name.sql
```

### Testing Locally
```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop
```

### Accessing Dashboard
```bash
# Open Supabase dashboard
supabase dashboard
```

## Key Files Reference

```
supabase/
├── migrations/          # 16+ migration files
│   ├── 001-003         # Core tables
│   ├── 009-012         # Admin functions
│   ├── 013-018         # Features & fixes
│   └── 020+            # Storage & extras
├── functions/          # Edge functions
│   └── recalculate-layout/
├── config.toml         # Supabase configuration
└── seed.sql           # Sample data (if needed)
```

## Environment Variables

Required for frontend:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key

Required for Supabase CLI:
- `SUPABASE_DB_PASSWORD` - Database password for migrations

## Common Operations

### Check Data Integrity
```sql
-- Run validation dashboard
SELECT * FROM admin_validation_dashboard();
```

### Monitor Background Jobs
```sql
-- View active jobs
SELECT * FROM background_jobs WHERE status IN ('queued', 'processing');
```

### Debug Issues
- Check Supabase logs in dashboard
- Use `handleSupabaseError` helper for consistent error handling
- Monitor real-time subscriptions in browser DevTools

## Security Considerations

1. Never expose service role key in frontend
2. All admin operations go through RPC functions
3. RLS policies enforce access control
4. Audit log tracks all modifications
5. Soft deletes preserve data integrity