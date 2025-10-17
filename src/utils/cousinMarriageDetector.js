/**
 * Cousin Marriage Detection Utility
 *
 * Identifies cousin marriages (marriages between Al-Qefari family members) for
 * dual-path ancestor highlighting.
 *
 * Detection Logic:
 * - Al-Qefari family members have `hid !== null` (Historical ID)
 * - Munasib (spouses from other families) have `hid === null`
 * - Cousin marriage = both spouses have `hid !== null`
 *
 * Usage:
 *   import { detectCousinMarriage, isAlQefariMember } from './cousinMarriageDetector';
 *
 *   const cousinMarriages = detectCousinMarriage(profile, nodesMap);
 *   if (cousinMarriages.length > 0) {
 *     // Trigger dual-path highlighting
 *   }
 */

/**
 * Check if a profile is an Al-Qefari family member (has HID)
 * @param {Object} profile - Profile object
 * @returns {boolean} True if Al-Qefari family member
 */
export function isAlQefariMember(profile) {
  if (!profile) return false;
  return profile.hid !== null && profile.hid !== undefined;
}

/**
 * Detect cousin marriages for a profile
 * @param {Object} profile - Profile object with marriages array
 * @param {Map} nodesMap - Map of all profiles by ID
 * @returns {Array<Object>} Array of cousin marriage objects
 *   Each object: { spouse: spouseProfile, marriage: marriageData }
 */
export function detectCousinMarriage(profile, nodesMap) {
  if (!profile || !nodesMap) {
    return [];
  }

  // Check if this profile is Al-Qefari
  const isProfileAlQefari = isAlQefariMember(profile);
  if (!isProfileAlQefari) {
    return []; // Munasib profiles can't have cousin marriages
  }

  // Get all marriages (both active and inactive)
  const marriages = profile.marriages || [];
  console.log(`[CousinDetector] Profile ${profile.id} (${profile.name}) has ${marriages.length} marriages`);

  if (marriages.length === 0) {
    return [];
  }

  const cousinMarriages = [];

  for (const marriage of marriages) {
    // Get spouse profile
    const spouseId = marriage.spouse_id || marriage.wife_id || marriage.husband_id;
    console.log(`[CousinDetector] Checking marriage:`, {
      spouseId,
      marriageKeys: Object.keys(marriage),
      marriageData: marriage
    });

    if (!spouseId) {
      console.log('[CousinDetector] No spouse ID found, skipping');
      continue;
    }

    const spouse = nodesMap.get(spouseId);
    if (!spouse) {
      console.log(`[CousinDetector] Spouse ${spouseId} not in nodesMap`);
      continue;
    }

    console.log(`[CousinDetector] Spouse ${spouseId} (${spouse.name}):`, {
      hid: spouse.hid,
      isAlQefari: isAlQefariMember(spouse),
      deletedAt: spouse.deleted_at
    });

    // Check if spouse is also Al-Qefari (has HID) and not soft-deleted
    if (isAlQefariMember(spouse) && !spouse.deleted_at) {
      console.log(`[CousinDetector] ✅ Cousin marriage found with ${spouse.id} (${spouse.name})`);
      cousinMarriages.push({
        spouse: spouse,
        marriage: marriage
      });
    } else {
      console.log(`[CousinDetector] ❌ Not a cousin marriage (isAlQefari: ${isAlQefariMember(spouse)}, deleted: ${spouse.deleted_at})`);
    }
  }

  console.log(`[CousinDetector] Total cousin marriages found: ${cousinMarriages.length}`);
  return cousinMarriages;
}

/**
 * Get all cousin marriages for a profile (simpler API)
 * @param {Object} profile - Profile object
 * @param {Map} nodesMap - Map of all profiles
 * @returns {Array<Object>} Array of spouse profiles (cousin spouses only)
 */
export function getCousinSpouses(profile, nodesMap) {
  const cousinMarriages = detectCousinMarriage(profile, nodesMap);
  return cousinMarriages.map(cm => cm.spouse);
}

/**
 * Check if a specific marriage is a cousin marriage
 * @param {Object} profile1 - First profile
 * @param {Object} profile2 - Second profile
 * @returns {boolean} True if both are Al-Qefari members
 */
export function isCousinMarriage(profile1, profile2) {
  return isAlQefariMember(profile1) && isAlQefariMember(profile2);
}

export default {
  isAlQefariMember,
  detectCousinMarriage,
  getCousinSpouses,
  isCousinMarriage,
};
