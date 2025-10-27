/**
 * Batch BlurHash Generation - Node.js Script
 *
 * Purpose: Generate blurhashes for existing profile photos
 *
 * Requirements:
 *   npm install sharp blurhash node-fetch
 *
 * Usage:
 *   node scripts/generate-blurhashes-node.js
 *
 * This script:
 * 1. Fetches all profiles with photos that need blurhash
 * 2. Downloads each photo
 * 3. Generates blurhash (32×32, 4×3 components)
 * 4. Updates database via Supabase client
 *
 * Performance: ~2-3 minutes for 68 photos
 */

const sharp = require('sharp');
const { encode } = require('blurhash');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://ezkioroyhzpavmbfavyn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/generate-blurhashes-node.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let successCount = 0;
let failedCount = 0;

/**
 * Generate blurhash from image URL
 */
async function generateBlurhash(photoUrl) {
  try {
    // Download image
    const response = await fetch(photoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process image with sharp (resize to 32×32)
    const { data, info } = await sharp(buffer)
      .resize(32, 32, {
        fit: 'cover',
        position: 'center'
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Generate blurhash (4×3 components)
    const blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      4, // componentX
      3  // componentY
    );

    return { success: true, blurhash };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main batch processing function
 */
async function main() {
  console.log('🚀 Starting batch blurhash generation...');
  console.log('---\n');

  // Fetch all profiles with photos that need blurhash
  const { data: profiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, hid, name, photo_url')
    .not('photo_url', 'is', null)
    .is('blurhash', null)
    .is('deleted_at', null)
    .order('generation', { ascending: true })
    .order('sibling_order', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch profiles:', fetchError);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅ No profiles need blurhash generation!');
    process.exit(0);
  }

  console.log(`Found ${profiles.length} profiles that need blurhashes\n`);

  // Process profiles in batches of 5
  const BATCH_SIZE = 5;

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (profile, batchIndex) => {
        const currentIndex = i + batchIndex + 1;
        const { id, hid, name, photo_url } = profile;

        console.log(`[${currentIndex}/${profiles.length}] Processing ${hid} - ${name}...`);

        // Generate blurhash
        const result = await generateBlurhash(photo_url);

        if (result.success) {
          // Update database
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ blurhash: result.blurhash })
            .eq('id', id);

          if (updateError) {
            console.log(`  ❌ Failed to update database: ${updateError.message}`);
            failedCount++;
          } else {
            console.log(`  ✅ Generated: ${result.blurhash}`);
            successCount++;
          }
        } else {
          console.log(`  ❌ Failed to generate: ${result.error}`);
          failedCount++;
        }
      })
    );

    // Pause between batches to avoid overwhelming the database
    if (i + BATCH_SIZE < profiles.length) {
      console.log('  ⏸️  Pausing for 1 second...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n---');
  console.log('🎉 Batch generation complete!');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  📊 Total: ${profiles.length}`);
}

// Run main function
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
