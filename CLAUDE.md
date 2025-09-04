# Alqefari Family Tree - AI Assistant Context

Premium iOS-first family tree app with React Native Expo, Supabase backend, and glass morphism UI.

## Commands

```bash
# Development
npm start          # Expo dev server (iOS & Android)
npm run ios        # iOS simulator only
npm run android    # Android emulator only

# Database
supabase db push      # Deploy all migrations
supabase dashboard    # Open Supabase UI
supabase db reset     # Reset database (caution!)

# Validation
SELECT * FROM admin_validation_dashboard();  # Check data integrity
SELECT * FROM admin_auto_fix_issues();      # Fix common issues
```

## Code Style

- ES modules only (`import/export`, no `require`)
- Async/await over `.then()` chains
- Arabic-first RTL design - all UI must support RTL
- Glass morphism components in `src/components/glass/`
- NO console.log in final code (remove after debugging)
- Use handleSupabaseError for consistent error handling

## Project Structure

```
src/
├── services/        # Supabase integration (profiles.js, storage.js)
├── components/      # UI components
│   ├── admin/      # Admin-only components
│   └── glass/      # Glass morphism design system
├── stores/         # Zustand state (useTreeStore.js)
└── screens/        # Main app screens

supabase/
├── migrations/     # Database changes (001-020+)
└── functions/      # Edge functions (recalculate-layout)
```

## Development Workflow

1. Check PROJECT_ROADMAP.md for current tasks
2. Use TodoWrite tool for multi-step work
3. Test on physical iOS device for gestures
4. Commit atomically with descriptive messages
5. Update roadmap when completing major features

## Key Patterns

### Database Operations
```javascript
// Always use RPC for admin operations
await supabase.rpc('admin_create_profile', params);

// Use branch-based loading
await supabase.rpc('get_branch_data', { p_hid, p_max_depth: 3 });
```

### State Management
```javascript
// Single source of truth in Zustand
const { nodes, updateNode } = useTreeStore();
// Never duplicate state in components
```

### Error Handling
```javascript
const { data, error } = await profilesService.createProfile(profileData);
if (error) {
  Alert.alert('خطأ', handleSupabaseError(error));
}
```

## Security Rules

- NEVER expose service role key in frontend
- All admin operations through RPC functions
- Check user roles before sensitive operations
- Use RLS policies for row-level security

## Performance Guidelines

- Branch-based loading (max depth 3-5)
- Viewport culling for visible nodes only
- Debounce real-time subscriptions
- Queue layout calculations asynchronously

## Testing

- Test zoom/pan on physical iOS device
- Verify RTL layout in Arabic
- Check admin features with TEST_ADMIN_SETUP.md
- Run validation dashboard after bulk operations

## Common Issues

- **Zoom jumping**: Fixed with proper focal point handling
- **Marriage loading**: Run fix-marriage-dates.sql if needed
- **Missing layouts**: Queue recalculation via admin dashboard
- **Auth errors**: Check Supabase Auth settings

## Environment Variables

```bash
EXPO_PUBLIC_SUPABASE_URL        # Frontend
EXPO_PUBLIC_SUPABASE_ANON_KEY   # Frontend
SUPABASE_DB_PASSWORD            # CLI only
```

---
*Always check docs/ for detailed implementation guides*