# Migration History Backup
**Date**: October 14, 2025
**Purpose**: Pre-CLI cleanup backup

## Remote Migrations (Already Deployed)
The following migrations exist in the remote database `supabase_migrations.schema_migrations` table:

1. 001_create_profiles_table
2. 001_create_profiles_table_v2
3. 002_create_marriages_table
4. 002_create_validation_functions
5. 003_create_media_uploads_table
6. 009_create_admin_functions_v2
7. 011_create_safe_access_functions
8. 012_create_bulk_operations
9. 013_fix_marriage_function
10. 014_create_background_jobs
11. 015_admin_bulk_create_children
12. 016_create_audit_log
13. 017_admin_revert_action
14. 018_add_role_to_profiles
15. 019_fix_rls_and_admin_security
16. 020_harden_bulk_create_children
17. 021_add_version_checks_to_revert
18. 100_migrate_existing_to_v2

## Local Migration Files Backed Up
All migration files have been copied to:
- `migrations_archive/supabase_migrations_YYYYMMDD_HHMMSS/`

## Next Steps
1. Clear migration history table
2. Generate new baseline migration with `supabase db pull`
3. Future migrations use CLI workflow exclusively
