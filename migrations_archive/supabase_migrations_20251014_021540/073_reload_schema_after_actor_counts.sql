-- Force PostgREST to reload schema cache after get_actor_activity_counts deployment
NOTIFY pgrst, 'reload schema';
