/**
 * useEnsureProfileEnriched - Pre-enrichment hook for profile editing
 *
 * Purpose: Ensure profile has version field before allowing edits
 * - Prevents "version undefined" errors in optimistic locking
 * - Enriches non-viewport nodes with full data including version
 * - No-op if profile already enriched
 *
 * Problem it solves:
 * - Progressive loading structure RPC returns minimal data (no version)
 * - When user edits non-scrolled node, version is undefined
 * - admin_update_profile RPC rejects update due to missing p_version
 *
 * Solution:
 * - Check if profile has version field
 * - If missing, trigger enrichment via enrichVisibleNodes()
 * - Update store with enriched data (includes version)
 * - Allow edit to proceed
 *
 * Usage:
 * ```javascript
 * function EditScreen({ profile }) {
 *   useEnsureProfileEnriched(profile);
 *   // ... rest of component
 * }
 * ```
 */

import { useEffect } from 'react';
import { useTreeStore } from '../stores/useTreeStore';
import profilesService from '../services/profiles';

export function useEnsureProfileEnriched(profile) {
  useEffect(() => {
    async function enrichIfNeeded() {
      // Guard: No profile
      if (!profile?.id) {
        return;
      }

      // Guard: Already has version (already enriched)
      if (profile.version !== undefined) {
        return;
      }

      // Profile missing version field - enrich it now
      console.log(
        `⚠️ [useEnsureProfileEnriched] Profile ${profile.id} (${profile.name}) missing version field, enriching...`
      );

      try {
        const { data, error } = await profilesService.enrichVisibleNodes([profile.id]);

        if (error) {
          console.error('[useEnsureProfileEnriched] Enrichment failed:', error);
          return;
        }

        if (!data || !data[0]) {
          console.error('[useEnsureProfileEnriched] No data returned from enrichment');
          return;
        }

        const enrichedProfile = data[0];

        // Update store with enriched data
        useTreeStore.getState().updateNode(profile.id, enrichedProfile);

        console.log(
          `✅ [useEnsureProfileEnriched] Profile ${profile.id} enriched with version ${enrichedProfile.version}`
        );
      } catch (error) {
        console.error('[useEnsureProfileEnriched] Unexpected error during enrichment:', error);
      }
    }

    enrichIfNeeded();
  }, [profile?.id, profile?.version]);
}

/**
 * Helper: Check if profile needs enrichment
 * Returns true if profile is missing version field
 */
export function profileNeedsEnrichment(profile) {
  return profile && profile.id && profile.version === undefined;
}
