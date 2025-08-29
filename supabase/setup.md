# Supabase Backend Setup Guide

## Quick Start

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Initialize Supabase in the Project

```bash
# Navigate to project directory
cd "/Users/alqefari/Desktop/alqefari app/AlqefariTreeRN-Expo"

# Initialize Supabase
supabase init

# Link to your existing project
supabase link --project-ref ezkioroyhzpavmbfavyn
```

When prompted, use the database password from your .env file: `FwxS5z3MseYqRy2Q`

### 3. Run Database Migrations

```bash
# Push all migrations to your Supabase project
supabase db push
```

### 4. Verify Setup

```bash
# Check migration status
supabase migration list

# Open Supabase dashboard
supabase dashboard
```

## Migration Files Created

The following migration files have been created in `supabase/migrations/`:

1. `001_create_profiles_table.sql` - Core profiles table with all fields

## Next Steps

After running the initial migration, you'll need to:

1. Create the remaining tables (marriages, media_uploads, suggestions, audit_log, roles)
2. Set up Row Level Security policies
3. Create the RPC functions for admin operations
4. Deploy Edge Functions for background tasks

## Environment Variables

Make sure your `.env` file contains:

```
SUPABASE_URL=https://ezkioroyhzpavmbfavyn.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing the Database

Once migrations are complete, you can test by:

1. Opening the Supabase dashboard
2. Navigating to the SQL Editor
3. Running test queries:

```sql
-- Check if profiles table exists
SELECT * FROM profiles LIMIT 1;

-- Insert a test profile
INSERT INTO profiles (name, gender, generation, hid) 
VALUES ('Test Person', 'male', 1, 'T1')
RETURNING *;
```

## Troubleshooting

If you encounter issues:

1. Check the Supabase dashboard logs
2. Verify your database password is correct
3. Ensure you have the correct project reference
4. Check migration syntax with `supabase db lint`

## Security Note

Never commit the `.env` file or expose your service role key in client-side code!