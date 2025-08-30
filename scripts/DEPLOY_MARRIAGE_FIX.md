# Fix Marriage Loading Error

To fix the marriage date error, you need to deploy the SQL fix to your Supabase database.

## Quick Fix Steps:

1. **Open Supabase SQL Editor:**
   https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new

2. **Copy the SQL from:**
   `scripts/fix-marriage-dates.sql`

3. **Paste it in the SQL editor and click "Run"**

4. **Done!** Marriages will now load properly in the app.

## What this fixes:
- The backend was trying to insert TEXT values into DATE columns
- The fix adds proper type casting (::DATE) when inserting marriages
- This resolves the "Returned type text does not match expected type date" error

Once deployed, the ProfileSheet will show marriage information correctly.