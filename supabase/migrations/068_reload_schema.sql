-- Force PostgREST to reload its schema cache
-- This is needed when functions are added/modified

NOTIFY pgrst, 'reload schema';
