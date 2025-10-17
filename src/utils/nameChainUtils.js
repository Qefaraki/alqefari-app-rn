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

/**
 * Get complete name chain without truncation (for cousin marriages)
 * Prioritizes full_name_chain field over other chain variants to ensure
 * surname "القفاري" is included. Used when displaying Al-Qefari family
 * members in spouse rows where full lineage context is important.
 *
 * @param {Object} profile - Profile object with name chain data
 * @returns {string|null} - Complete name chain or null
 *
 * @example
 * // Returns: "محمد بن عبدالله بن أحمد بن سعود القفاري"
 * getCompleteNameChain({ full_name_chain: "محمد بن عبدالله بن أحمد بن سعود القفاري" })
 *
 * @example
 * // Fallback: Returns: "محمد القفاري"
 * getCompleteNameChain({ name: "محمد", hid: "001", full_name_chain: null })
 */
export const getCompleteNameChain = (profile) => {
  // Prioritize full_name_chain first (complete chain from database)
  const rawChain =
    profile?.full_name_chain ||      // PRIMARY (complete chain with surname)
    profile?.name_chain ||            // Fallback 1
    profile?.lineage_preview ||       // Fallback 2 (might be truncated, but better than nothing)
    profile?.name_chain_snapshot ||   // Fallback 3
    profile?.full_name ||             // Fallback 4
    null;

  // Normalize whitespace but DON'T truncate
  if (rawChain) {
    return rawChain.replace(/\s+/g, ' ').trim();
  }

  // Final fallback: construct from name + family_origin
  const familyName = profile?.family_origin || profile?.family_name || null;
  if (familyName) {
    return `${profile?.name || ''} ${familyName}`.trim();
  }

  // For Al-Qefari without chain (hid !== null): add surname
  if (profile?.hid !== null && profile?.hid !== undefined) {
    return `${profile?.name || ''} القفاري`.trim();
  }

  // Last resort: just the name
  return profile?.name || null;
};
