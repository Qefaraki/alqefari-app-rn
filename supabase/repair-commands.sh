#!/bin/bash
# Repair commands if TRUNCATE fails
# Run these one by one if needed

# List of all migrations to mark as applied
supabase migration repair 001_create_profiles_table_v2 --status applied
supabase migration repair 001_create_profiles_table --status applied
supabase migration repair 002_create_marriages_table --status applied
supabase migration repair 002_create_validation_functions --status applied
supabase migration repair 003_create_media_uploads_table --status applied
supabase migration repair 009_create_admin_functions_v2 --status applied
supabase migration repair 011_create_safe_access_functions --status applied
supabase migration repair 012_create_bulk_operations --status applied
supabase migration repair 013_fix_marriage_function --status applied
supabase migration repair 014_create_background_jobs --status applied
supabase migration repair 015_admin_bulk_create_children --status applied
supabase migration repair 016_create_audit_log --status applied
supabase migration repair 017_admin_revert_action --status applied
supabase migration repair 018_add_role_to_profiles --status applied
supabase migration repair 019_fix_rls_and_admin_security --status applied
supabase migration repair 020_harden_bulk_create_children --status applied
supabase migration repair 021_add_version_checks_to_revert --status applied
supabase migration repair 100_migrate_existing_to_v2 --status applied