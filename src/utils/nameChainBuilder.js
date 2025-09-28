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

  console.log("🔍 DEBUG buildNameChain: Starting with profile:", profile.name, "father_id:", profile.father_id);
  console.log("🔍 DEBUG buildNameChain: allProfiles count:", allProfiles.length);

  // If full_chain already exists, use it
  if (profile.full_chain) {
    console.log("🔍 DEBUG buildNameChain: Using existing full_chain:", profile.full_chain);
    return profile.full_chain;
  }

  // Start with the person's name
  let chain = profile.name || "";

  // Try to build from father chain if available
  if (profile.father_name) {
    chain = `${profile.name} بن ${profile.father_name}`;

    if (profile.grandfather_name) {
      chain += ` ${profile.grandfather_name}`;
    }
    console.log("🔍 DEBUG buildNameChain: Built from father_name/grandfather_name:", chain);
  } else if (profile.father_id && allProfiles.length > 0) {
    // Try to find father in profiles array
    const father = allProfiles.find((p) => p.id === profile.father_id);
    console.log("🔍 DEBUG buildNameChain: Found father?", father ? father.name : "NOT FOUND");
    if (father) {
      chain = `${profile.name} بن ${father.name}`;

      // Try to find grandfather
      if (father.father_id) {
        const grandfather = allProfiles.find((p) => p.id === father.father_id);
        console.log("🔍 DEBUG buildNameChain: Found grandfather?", grandfather ? grandfather.name : "NOT FOUND");
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
              console.log("🔍 DEBUG buildNameChain: Added ancestor:", nextAncestor.name);
            } else {
              console.log("🔍 DEBUG buildNameChain: Could not find ancestor with id:", currentAncestor.father_id);
              break;
            }
          }
        }
      }
    }
  } else {
    console.log("🔍 DEBUG buildNameChain: No father_id or allProfiles empty");
  }

  console.log("🔍 DEBUG buildNameChain: Final chain:", chain);
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
