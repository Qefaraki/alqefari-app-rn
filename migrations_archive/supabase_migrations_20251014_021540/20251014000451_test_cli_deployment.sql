-- Test migration to verify CLI deployment works
-- This creates a simple comment in the database

DO $$
BEGIN
  -- Just a test comment, no actual schema changes
  RAISE NOTICE 'Test migration deployed successfully via Supabase CLI at %', NOW();
END $$;
