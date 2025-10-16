/**
 * Generation Utilities
 *
 * Centralized functions for handling generation numbers and labels.
 * Prevents code duplication across ProfileSheet, BranchTreeModal,
 * useProfileMetrics, and PermissionManager.
 */

/**
 * Converts generation number to Arabic ordinal word
 *
 * @param {number} generation - Generation number (1-based)
 * @returns {string} Arabic ordinal (e.g., "الأول", "الثاني")
 *
 * @example
 * getArabicOrdinal(1)  // "الأول"
 * getArabicOrdinal(5)  // "الخامس"
 * getArabicOrdinal(16) // "16" (fallback for >15)
 */
export const getArabicOrdinal = (generation) => {
  const ordinals = [
    "الأول",        // 1st
    "الثاني",       // 2nd
    "الثالث",       // 3rd
    "الرابع",       // 4th
    "الخامس",       // 5th
    "السادس",       // 6th
    "السابع",       // 7th
    "الثامن",       // 8th
    "التاسع",       // 9th
    "العاشر",       // 10th
    "الحادي عشر",   // 11th
    "الثاني عشر",   // 12th
    "الثالث عشر",   // 13th
    "الرابع عشر",   // 14th
    "الخامس عشر"    // 15th
  ];

  // Return ordinal or fallback to number if out of range
  return ordinals[generation - 1] || `${generation}`;
};

/**
 * Gets full generation label with prefix
 *
 * @param {number} generation - Generation number
 * @returns {string|null} Full label (e.g., "الجيل الأول") or null if no generation
 *
 * @example
 * getGenerationLabel(3)  // "الجيل الثالث"
 * getGenerationLabel(null) // null
 * getGenerationLabel(undefined) // null
 */
export const getGenerationLabel = (generation) => {
  if (!generation) return null;
  return `الجيل ${getArabicOrdinal(generation)}`;
};
