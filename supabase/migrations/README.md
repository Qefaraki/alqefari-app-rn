# Database Migrations

## ✅ CLI-First Workflow (October 2025+)

All migrations from October 2025 forward use the Supabase CLI exclusively.

### Creating New Migrations

```bash
# 1. Create new migration (auto-generates timestamp)
supabase migration new descriptive_name

# 2. Write your SQL in the generated file
# File will be: supabase/migrations/YYYYMMDDHHmmss_descriptive_name.sql

# 3. Push to remote database
supabase db push

# 4. Verify deployment
supabase migration list
```

### Migration Naming

- **Format**: `YYYYMMDDHHmmss_descriptive_name.sql`
- **Example**: `20251014120530_add_user_preferences.sql`
- **Auto-generated**: Use `supabase migration new` (don't create manually)

### Important Notes

1. **Pre-CLI Migrations**: All migrations before October 2025 were deployed manually
   - These are archived in `migrations_archive/`
   - The database schema is complete and operational
   - Migration history was cleared on Oct 14, 2025 to enable CLI workflow

2. **Never manually edit migration files** after they've been pushed

3. **Always use CLI commands** - no more manual SQL execution

4. **Test migrations locally first** if you have Docker running

## Migration History

- **Before Oct 2025**: Manual deployment (18 migrations, see `backups/MIGRATION_HISTORY_BACKUP.md`)
- **Oct 14, 2025**: Cleared migration history, started CLI workflow
- **Oct 14, 2025+**: All migrations via Supabase CLI

## Troubleshooting

```bash
# Check what's deployed
supabase migration list

# Verify project linkage
supabase link --project-ref ezkioroyhzpavmbfavyn

# Dry run before pushing
supabase db push --dry-run
```
