-- Force PostgREST to reload schema cache after function fix
NOTIFY pgrst, 'reload schema';
