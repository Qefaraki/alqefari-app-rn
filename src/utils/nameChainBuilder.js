/**
 * Build full name chain from profile and ancestors
 * This should be used consistently across the app
 */

/**
 * Build name chain from profile data
 * @param {Object} profile - The profile object
 * @param {Array} allProfiles - All profiles for looking up ancestors
 * @returns {string} Full name chain
 */
export function buildNameChain(profile, allProfiles = []) {
  if (!profile) return "";

  // CRITICAL FIX: RPC returns "full_name_chain" with gendered connectors already built
  // Check correct field name (not "full_chain" which doesn't exist in profiles table)
  if (profile.full_name_chain) {
    return profile.full_name_chain;
  }

  // Fallback: search_name_chain RPC returns "name_chain"
  if (profile.name_chain) {
    return profile.name_chain;
  }

  // Fallback: Build manually if neither field exists
  // (This code path should rarely execute now)
  let chain = profile.name || "";

  // Try to build from father chain if available
  if (profile.father_name) {
    chain = `${profile.name} بن ${profile.father_name}`;

    if (profile.grandfather_name) {
      chain += ` ${profile.grandfather_name}`;
    }
  } else if (profile.father_id && allProfiles.length > 0) {
    // Try to find father in profiles array
    const father = allProfiles.find((p) => p.id === profile.father_id);
    if (father) {
      chain = `${profile.name} بن ${father.name}`;

      // Try to find grandfather
      if (father.father_id) {
        const grandfather = allProfiles.find((p) => p.id === father.father_id);
        if (grandfather) {
          chain += ` ${grandfather.name}`;

          // Continue up the chain without "بن"
          let currentAncestor = grandfather;
          let ancestorCount = 0;
          while (currentAncestor.father_id && ancestorCount < 10) {
            const nextAncestor = allProfiles.find((p) => p.id === currentAncestor.father_id);
            if (nextAncestor) {
              chain += ` ${nextAncestor.name}`;
              currentAncestor = nextAncestor;
              ancestorCount++;
            } else {
              break;
            }
          }
        }
      }
    }
  }

  return chain;
}

/**
 * Get display name for profile (for UI display)
 * @param {Object} profile
 * @returns {string} Display name
 */
export function getProfileDisplayName(profile) {
  if (!profile) return "غير معروف";

  // Priority order:
  // 1. Full chain if available
  // 2. Built name chain
  // 3. Simple name
  // 4. Fallback

  return (
    profile.full_chain ||
    profile.display_name ||
    buildNameChain(profile) ||
    profile.name ||
    "بدون اسم"
  );
}

/**
 * Extract first three names from a full name chain
 * @param {string} nameChain - Full name chain (e.g., "محمد بن علي عبدالله أحمد القفاري")
 * @returns {string} First three names (e.g., "محمد بن علي عبدالله")
 */
export function getFirstThreeNames(nameChain) {
  if (!nameChain || typeof nameChain !== 'string') {
    return '';
  }

  // Trim and normalize whitespace
  const normalized = nameChain.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  // Split by spaces
  const parts = normalized.split(' ');

  // If 3 or fewer parts, return as is
  if (parts.length <= 3) {
    return normalized;
  }

  // Return first 3 parts joined
  return parts.slice(0, 3).join(' ');
}
