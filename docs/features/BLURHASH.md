# BlurHash Implementation (Image Placeholders)

**Status**: 🚧 Day 1 Backend (80% Complete) - October 27, 2025
**Purpose**: Show smooth blurred image placeholders while real photos load
**Timeline**: 10 mins remaining (Day 1) + 8 hours (Day 2 frontend)

## What is BlurHash?

BlurHash generates a tiny ~25-character string representing a blurred version of an image. Used by Twitter, Medium, Unsplash for instant placeholder rendering while the real image loads.

### Example
```
Photo URL: https://.../profile-photo.jpg
BlurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj"  ← 25 chars
         ↓ decodes instantly ↓
     [Smooth blur preview] ← Shows while real photo loads
```

## Why BlurHash?

### Before BlurHash
```
[White box] → [Photo loads] (0-3 seconds, jarring)
```

### After BlurHash
```
[Instant blur preview] → [Photo fades in] (smooth, perceived performance)
```

### Benefits
- **Improves perceived performance**: No white boxes during loading
- **Tiny data size**: ~25 chars vs 50KB+ for real image
- **Works with Progressive Loading**: blurhash in structure, photos on-demand
- **Industry-standard**: BlurHash algorithm is open-source

## Day 1 Backend (80% Complete)

### ✅ Completed

1. **Database Migration Applied**
   - Added `blurhash TEXT` column to profiles table
   - File: `supabase/migrations/20251027000000_add_blurhash_to_profiles_and_structure_rpc.sql`

2. **RPC Updated**
   - `get_structure_only()` now returns blurhash (15th field)
   - All tree queries include blurhash data

3. **Edge Function Created**
   - Location: `supabase/functions/generate-blurhash/index.ts`
   - Uses sharp@0.33.0 for image processing
   - Generates 32×32 blurhash (4x3 components)

4. **Batch Script Created**
   - Location: `scripts/generate-blurhashes-batch.ts`
   - Processes 68 existing photos in parallel (5 at a time)
   - Automatic retry, estimated 20 seconds runtime

### ❌ Remaining (10 Minutes)

1. **Deploy Edge Function**
   ```bash
   npx supabase functions deploy generate-blurhash
   ```

2. **Run Batch Script**
   ```bash
   npx ts-node scripts/generate-blurhashes-batch.ts
   ```

3. **Verify Results**
   ```sql
   SELECT COUNT(*) FROM profiles WHERE blurhash IS NOT NULL;
   -- Expected: 68
   ```

## Day 2 Frontend (Pending)

### Tasks (8 Hours Estimated)

1. **Install Native Library** (30 mins)
   ```bash
   npm install react-native-blurhash
   npx expo prebuild --clean
   ```

2. **Create BlurHash Cache** (1 hour)
   - File: `src/utils/skiaImageCache.ts`
   - Separate cache for blurhash placeholders
   - Fast in-memory lookup

3. **Integrate in TreeView** (3 hours)
   - Update `NodeRenderer.tsx`
   - Render blurhash while photo loads
   - Fade transition blur → photo

4. **Bump Schema Version** (15 mins)
   - File: `src/components/TreeView/hooks/useStructureLoader.js`
   - Change: `1.1.0` → `1.2.0`
   - Forces cache invalidation

5. **Test on Physical Devices** (3 hours)
   - iOS: Test blur → photo transition
   - Android: Test performance
   - Verify fade animation

## Key Files

### Backend
- `supabase/migrations/20251027000000_add_blurhash_to_profiles_and_structure_rpc.sql` - DB schema
- `supabase/functions/generate-blurhash/index.ts` - Edge Function (NOT DEPLOYED YET)
- `scripts/generate-blurhashes-batch.ts` - Batch processor (NOT RUN YET)

### Frontend (Not Created Yet)
- `src/components/TreeView/rendering/BlurHashPlaceholder.tsx` - Placeholder component
- `src/utils/blurhashCache.ts` - BlurHash caching utilities

## Technical Details

### BlurHash Generation
- **Image Size**: Resized to 32×32 pixels
- **Components**: 4x3 (width × height)
- **String Length**: ~25 characters
- **Processing Time**: ~100ms per image

### Database Schema
```sql
ALTER TABLE profiles ADD COLUMN blurhash TEXT;
```

### RPC Update
```sql
CREATE OR REPLACE FUNCTION get_structure_only()
RETURNS TABLE (
  ...,
  blurhash TEXT  -- ← 15th field
)
```

### Edge Function
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import sharp from "npm:sharp@0.33.0";
import { encode } from "npm:blurhash";

serve(async (req) => {
  const { imageUrl } = await req.json();

  // Download image
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();

  // Resize to 32×32
  const image = sharp(buffer).resize(32, 32, { fit: "cover" });
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Generate blurhash
  const blurhash = encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4, // componentX
    3  // componentY
  );

  return new Response(JSON.stringify({ blurhash }));
});
```

## Next Steps

1. **Deploy Edge Function** (5 mins)
2. **Run Batch Script** (2-3 mins)
3. **Continue to Day 2 frontend integration** (8 hours)

## Note

BlurHash is **separate** from QR code work (different feature, happened same day).

## Related Documentation

- [Progressive Loading](../PTS/README.md) - BlurHash works with Progressive Loading Phase 3B
- [TreeView Performance](../TREEVIEW_PERFORMANCE_OPTIMIZATION.md) - Performance considerations
- [Skia Image Cache](../architecture/SKIA_FEATURE_FEASIBILITY_REPORT.md) - Image caching system
