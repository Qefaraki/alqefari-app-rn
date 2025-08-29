# Manual Deployment Guide

Since we're having connection issues with the Supabase CLI, follow these steps to deploy manually through the Supabase Dashboard:

## 📋 Step-by-Step Deployment

### 1. Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

### 2. Run Migration Scripts in Order

#### Step 1: Migrate Existing Tables (CRITICAL - Do This First!)
1. Open file: `supabase/migrations/100_migrate_existing_to_v2.sql`
2. Copy the ENTIRE contents
3. Paste into SQL Editor
4. Click "Run" 
5. Wait for success message (should show "Migration completed successfully!")

#### Step 2: Create Validation Functions
1. Open file: `supabase/migrations/002_create_validation_functions.sql`
2. Copy ENTIRE contents
3. Paste into SQL Editor
4. Click "Run"

#### Step 3: Create Admin Functions (Async)
1. Open file: `supabase/migrations/009_create_admin_functions_v2.sql`
2. Copy ENTIRE contents
3. Paste into SQL Editor
4. Click "Run"

#### Step 4: Create Safe Access Functions
1. Open file: `supabase/migrations/011_create_safe_access_functions.sql`
2. Copy ENTIRE contents
3. Paste into SQL Editor
4. Click "Run"

#### Step 5: Create Bulk Operations & Dashboard
1. Open file: `supabase/migrations/012_create_bulk_operations.sql`
2. Copy ENTIRE contents
3. Paste into SQL Editor
4. Click "Run"

### 3. Verify Migration Success

Run this query to check everything worked:
```sql
SELECT * FROM admin_validation_dashboard();
```

You should see results showing the health status of your data.

### 4. Deploy Edge Functions

#### Option A: Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/functions
2. Click "New Function"
3. Name: `recalculate-layout`
4. Copy contents from: `supabase/functions/recalculate-layout/index.ts`
5. Deploy

#### Option B: Via CLI (if connection works later)
```bash
supabase functions deploy recalculate-layout
```

## ✅ Success Checklist

After deployment, verify:
- [ ] Migration completed without errors
- [ ] Validation dashboard shows all green
- [ ] No error messages in SQL output
- [ ] Edge Function deployed successfully

## 🧪 Test the App

```bash
cd /Users/alqefari/Desktop/alqefari\ app/AlqefariTreeRN-Expo
npm start
```

The app should:
- Load the tree without errors
- Show profile data correctly
- Display dates in new format
- Load marriages separately

## ⚠️ Troubleshooting

If you see errors:

1. **"relation already exists"** - This is OK, it means the object was already created
2. **"version mismatch"** - Someone else updated data, refresh and try again
3. **"function does not exist"** - Make sure you ran the scripts in order

## 🛟 Emergency Rollback

If something goes wrong:
```sql
-- The migration created backups
-- To view backup data:
SELECT * FROM profiles_backup_v1 LIMIT 10;

-- To restore (ONLY if needed):
DROP TABLE profiles CASCADE;
ALTER TABLE profiles_backup_v1 RENAME TO profiles;
```

---

**Important**: Run the scripts IN ORDER! The migration must happen first.