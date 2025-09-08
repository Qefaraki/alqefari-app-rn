# Admin Setup Guide - UPDATED

## ✅ Admin System Fixed and Working

The admin system has been completely redesigned for better security and maintainability.

### Your Admin Account
- **Email**: `admin@test.com`
- **Status**: ✅ Admin privileges active
- **No profile required**: You don't need a node on the family tree to be admin
   - Password: `testadmin123`
4. Click "Create user"

### 2. Create Admin Profile

1. Go to SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor
2. Copy and run ALL the SQL from `/supabase/create-test-admin-user.sql`
3. This will:
   - Find the user you created
   - Create a profile with admin role
   - Show you the created profile

**Important**: If you see an error about "0 rows", it means the profile wasn't created. Run the SQL script!

### 3. Test in the App

1. The app now has a "Test Admin Login" button in the header
2. Click it to log in with the hardcoded credentials
3. Once logged in, you'll see the Admin Mode Toggle appear
4. Toggle it on to access admin features:
   - Tap any person node to add children
   - Use the floating action button (FAB) for admin actions
   - View the system status indicator

### 4. Sign Out

Click the "Sign Out" button next to your email to log out and test different states.

## Important Notes

- This is a TEMPORARY solution for testing only
- Remove the test login button from App.js before production
- Create proper authentication UI for real users
- The credentials are hardcoded in App.js - DO NOT commit these to a public repo