/**
 * Utility functions for building and formatting name chains
 * Extracted from TabFamily to prevent circular dependencies
 */

/**
 * Get a shortened version of the name chain (max 5 tokens)
 * @param {Object} profile - Profile object with lineage/name data
 * @returns {string|null} - Short name chain or null
 */
export const getShortNameChain = (profile) => {
  const rawChain =
    profile?.lineage_preview ||
    profile?.name_chain ||
    profile?.full_name_chain ||
    profile?.name_chain_snapshot ||
    profile?.full_name ||
    null;

  let normalized;
  if (rawChain) {
    normalized = rawChain.replace(/\s+/g, ' ').trim();
  }

  if (!normalized) {
    const familyName = profile?.family_origin || profile?.family_name || null;
    if (familyName) {
      return `${profile?.name || ''} ${familyName}`.trim();
    }
    return null;
  }

  const tokens = normalized.split(' ');
  if (tokens.length <= 5) {
    return tokens.join(' ');
  }
  return tokens.slice(0, 5).join(' ');
};
