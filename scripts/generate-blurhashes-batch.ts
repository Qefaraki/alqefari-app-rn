/**
 * Batch BlurHash Generation Script
 *
 * Purpose: Generate blurhashes for all existing profile photos
 *
 * Usage:
 *   npx ts-node scripts/generate-blurhashes-batch.ts
 *
 * OR using Deno (recommended for Supabase Edge Functions compatibility):
 *   deno run --allow-net --allow-env scripts/generate-blurhashes-batch.ts
 *
 * Environment Variables (required):
 *   SUPABASE_URL=https://ezkioroyhzpavmbfavyn.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 * Performance:
 *   - 68 photos × ~300ms avg = ~20 seconds
 *   - Runs 5 photos in parallel for speed
 *   - Automatic retry on failures
 *
 * Output:
 *   - Progress bar with current/total
 *   - Success/failure count
 *   - List of failed profiles (if any)
 */

import { createClient } from '@supabase/supabase-js'

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-blurhash`
const BATCH_SIZE = 5  // Process 5 photos in parallel
const RETRY_ATTEMPTS = 2

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.error('   Set it with: export SUPABASE_SERVICE_ROLE_KEY="your-key-here"')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface Profile {
  id: string
  hid: string
  name: string
  photo_url: string
  blurhash: string | null
}

interface GenerationResult {
  profileId: string
  hid: string
  name: string
  success: boolean
  blurhash?: string
  error?: string
  attempts: number
}

/**
 * Call the generate-blurhash Edge Function for a single profile
 */
async function generateBlurhashForProfile(
  profile: Profile,
  attempt: number = 1
): Promise<GenerationResult> {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileId: profile.id,
        photoUrl: profile.photo_url
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()

    return {
      profileId: profile.id,
      hid: profile.hid,
      name: profile.name,
      success: true,
      blurhash: data.blurhash,
      attempts: attempt
    }
  } catch (error) {
    // Retry on failure (up to RETRY_ATTEMPTS)
    if (attempt < RETRY_ATTEMPTS) {
      console.log(`   ⚠️  Retry ${attempt + 1}/${RETRY_ATTEMPTS} for ${profile.hid} (${profile.name})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
      return generateBlurhashForProfile(profile, attempt + 1)
    }

    return {
      profileId: profile.id,
      hid: profile.hid,
      name: profile.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      attempts: attempt
    }
  }
}

/**
 * Process photos in batches for performance
 */
async function processBatch(profiles: Profile[]): Promise<GenerationResult[]> {
  const results: GenerationResult[] = []

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(profiles.length / BATCH_SIZE)

    console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} photos)`)

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(profile => generateBlurhashForProfile(profile))
    )

    results.push(...batchResults)

    // Print batch results
    for (const result of batchResults) {
      if (result.success) {
        console.log(`   ✅ ${result.hid} (${result.name}): ${result.blurhash}`)
      } else {
        console.log(`   ❌ ${result.hid} (${result.name}): ${result.error}`)
      }
    }

    // Small delay between batches to avoid overwhelming the Edge Function
    if (i + BATCH_SIZE < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                                                                ║')
  console.log('║           BlurHash Batch Generation Script                     ║')
  console.log('║                                                                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  // Step 1: Fetch all profiles with photos but no blurhash
  console.log('📊 Fetching profiles with photos...')

  const { data: profiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, hid, name, photo_url, blurhash')
    .not('photo_url', 'is', null)
    .is('blurhash', null)
    .is('deleted_at', null)
    .order('generation', { ascending: true })
    .order('sibling_order', { ascending: true })

  if (fetchError) {
    console.error('❌ Error fetching profiles:', fetchError.message)
    process.exit(1)
  }

  if (!profiles || profiles.length === 0) {
    console.log('✅ All profiles already have blurhashes! Nothing to do.')
    process.exit(0)
  }

  console.log(`📈 Found ${profiles.length} profiles needing blurhash generation\n`)
  console.log(`⚙️  Configuration:`)
  console.log(`   - Batch size: ${BATCH_SIZE} photos in parallel`)
  console.log(`   - Retry attempts: ${RETRY_ATTEMPTS}`)
  console.log(`   - Estimated time: ${Math.ceil(profiles.length * 0.3 / BATCH_SIZE)} seconds\n`)

  // Step 2: Confirm before starting
  console.log('🚀 Starting blurhash generation...\n')

  const startTime = Date.now()

  // Step 3: Process all profiles in batches
  const results = await processBatch(profiles as Profile[])

  // Step 4: Print summary
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
  const successCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length
  const failedProfiles = results.filter(r => !r.success)

  console.log('\n╔════════════════════════════════════════════════════════════════╗')
  console.log('║                         SUMMARY                                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')
  console.log(`⏱️  Time elapsed: ${elapsedSeconds}s`)
  console.log(`✅ Successful: ${successCount}/${profiles.length}`)
  console.log(`❌ Failed: ${failedCount}/${profiles.length}`)

  if (failedProfiles.length > 0) {
    console.log('\n📋 Failed Profiles:')
    for (const failed of failedProfiles) {
      console.log(`   - ${failed.hid} (${failed.name}): ${failed.error}`)
    }
    console.log('\n💡 Tip: Run this script again to retry failed profiles')
  } else {
    console.log('\n🎉 All blurhashes generated successfully!')
  }

  console.log('\n✨ Next steps:')
  console.log('   1. Verify blurhashes in database:')
  console.log('      SELECT COUNT(*) FROM profiles WHERE blurhash IS NOT NULL;')
  console.log('   2. Continue with frontend implementation (Day 2)')
  console.log('   3. Deploy OTA update when ready')
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
