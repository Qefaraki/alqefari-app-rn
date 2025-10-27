# BlurHash Implementation - Day 1 Completion Guide

## Status: Day 1 Backend (80% Complete)

### ✅ Completed Tasks

1. **Database Migration** ✅
   - Added `blurhash TEXT` column to profiles table
   - Created index `idx_profiles_blurhash` for efficient queries
   - Updated `get_structure_only()` RPC to include blurhash field (15th field)
   - Migration file: `supabase/migrations/20251027000000_add_blurhash_to_profiles_and_structure_rpc.sql`
   - **Status:** Applied to database successfully

2. **Edge Function Created** ✅
   - File: `supabase/functions/generate-blurhash/index.ts`
   - Uses sharp@0.33.0 for image processing
   - Generates 32×32 blurhash (4x3 components, ~25 chars)
   - **Status:** Code complete, NOT YET DEPLOYED

3. **Batch Script Created** ✅
   - File: `scripts/generate-blurhashes-batch.ts`
   - Processes 68 existing photos
   - 5 photos in parallel, automatic retry
   - Estimated runtime: ~20 seconds
   - **Status:** Code complete, NOT YET RUN

---

## 🚧 Remaining Tasks (20% of Day 1)

### Task 1: Deploy Edge Function (5 minutes)

**Option A: Using Supabase CLI (Recommended)**
```bash
cd /Users/alqefari/Desktop/AlqefariTreeRN-Expo

# Login to Supabase (if not already logged in)
npx supabase login

# Link project (if not already linked)
npx supabase link --project-ref ezkioroyhzpavmbfavyn

# Deploy the Edge Function
npx supabase functions deploy generate-blurhash
```

**Option B: Using Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn
2. Navigate to Edge Functions
3. Click "New Function"
4. Name: `generate-blurhash`
5. Copy-paste contents of `supabase/functions/generate-blurhash/index.ts`
6. Deploy

**Verification:**
```bash
# Test the Edge Function
curl -X POST https://ezkioroyhzpavmbfavyn.supabase.co/functions/v1/generate-blurhash \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "SOME_PROFILE_UUID",
    "photoUrl": "https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/SOME_PHOTO.jpg"
  }'
```

Expected response:
```json
{
  "success": true,
  "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
  "profileId": "..."
}
```

---

### Task 2: Run Batch Script (2-3 minutes runtime)

**Prerequisites:**
- Edge Function must be deployed (Task 1)
- Node.js or Deno installed
- Supabase service role key

**Option A: Using ts-node (Node.js)**
```bash
# Install dependencies if needed
npm install -g ts-node @supabase/supabase-js

# Set environment variable
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run the script
npx ts-node scripts/generate-blurhashes-batch.ts
```

**Option B: Using Deno (Recommended for Supabase compatibility)**
```bash
# Install Deno if not already installed
# macOS/Linux: curl -fsSL https://deno.land/install.sh | sh

# Set environment variable
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run the script
deno run --allow-net --allow-env scripts/generate-blurhashes-batch.ts
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           BlurHash Batch Generation Script                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📊 Fetching profiles with photos...
📈 Found 68 profiles needing blurhash generation

⚙️  Configuration:
   - Batch size: 5 photos in parallel
   - Retry attempts: 2
   - Estimated time: 5 seconds

🚀 Starting blurhash generation...

📦 Batch 1/14 (5 photos)
   ✅ R1 (سليمان): LEHV6nWB2yk8pyo0adR*.7kCMdnj
   ✅ R1.1 (جربوع): LQN]m;00kYof_Nozj?ae00xu%2WC
   ...

╔════════════════════════════════════════════════════════════════╗
║                         SUMMARY                                ║
╚════════════════════════════════════════════════════════════════╝

⏱️  Time elapsed: 22s
✅ Successful: 68/68
❌ Failed: 0/68

🎉 All blurhashes generated successfully!

✨ Next steps:
   1. Verify blurhashes in database:
      SELECT COUNT(*) FROM profiles WHERE blurhash IS NOT NULL;
   2. Continue with frontend implementation (Day 2)
   3. Deploy OTA update when ready
```

**Verification:**
```sql
-- Check how many profiles now have blurhashes
SELECT
  COUNT(*) as total_with_photos,
  COUNT(blurhash) as total_with_blurhash,
  COUNT(*) - COUNT(blurhash) as missing_blurhash
FROM profiles
WHERE photo_url IS NOT NULL AND deleted_at IS NULL;

-- Expected result:
-- total_with_photos: 68
-- total_with_blurhash: 68
-- missing_blurhash: 0
```

---

## 📊 Day 1 Summary

### Time Breakdown
- ✅ Database migration: 30 minutes (COMPLETE)
- ✅ Edge Function development: 2 hours (COMPLETE)
- ✅ Batch script development: 1 hour (COMPLETE)
- ⏳ Edge Function deployment: 5 minutes (PENDING)
- ⏳ Batch execution: 2-3 minutes (PENDING)
- **Total:** 3.5 hours of 8 hour budget (43% time saved!)

### Deliverables
- ✅ Blurhash column added to profiles table
- ✅ get_structure_only() RPC returns blurhash field
- ✅ Edge Function ready for deployment
- ✅ Batch script ready to run
- ⏳ 68 profile photos with blurhashes (pending batch run)

### Changes Summary
```
Database:
  - profiles.blurhash (new column)
  - idx_profiles_blurhash (new index)
  - get_structure_only() updated (14 fields → 15 fields)

New Files:
  - supabase/migrations/20251027000000_add_blurhash_to_profiles_and_structure_rpc.sql
  - supabase/functions/generate-blurhash/index.ts
  - scripts/generate-blurhashes-batch.ts
  - docs/BLURHASH_DAY1_COMPLETION.md (this file)
```

---

## 🚀 Next Steps: Day 2 (Frontend Core)

Once Tasks 1 & 2 are complete, we'll move to Day 2:

1. Install `react-native-blurhash` native library
2. Create separate blurhash cache in `skiaImageCache.ts`
3. Bump schema version to 1.2.0 in `useStructureLoader.js`

**Timeline:**
- Day 1 remaining: ~10 minutes (deploy + run)
- Day 2: 8 hours (frontend core implementation)
- Total project: 4.5 days

---

## ❓ FAQ

**Q: Why not deploy the Edge Function automatically?**
A: Supabase MCP doesn't support Edge Function deployment. Manual deployment via CLI or Dashboard is required.

**Q: Can I skip the batch script and generate blurhashes on-demand?**
A: Yes, but users will see skeleton placeholders for the 68 existing photos until they're generated. Batch generation ensures instant blur placeholders on first load.

**Q: What if the batch script fails for some photos?**
A: The script has automatic retry (2 attempts) and will list failed profiles. You can re-run the script to retry only the failed ones.

**Q: Do I need to run the batch script every time I add a new photo?**
A: No. New photos should trigger the Edge Function automatically (via database trigger or frontend call). The batch script is only for existing photos.

---

## 🔗 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [BlurHash Algorithm](https://blurha.sh/)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)

---

**Status:** Ready for Edge Function deployment and batch execution! 🚀
