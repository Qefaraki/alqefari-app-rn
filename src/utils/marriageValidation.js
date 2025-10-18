/**
 * Marriage Validation Utilities
 *
 * Centralizes all marriage-related validation logic for consistency
 * across SpouseManager, SpouseRow, admin tools, and imports.
 *
 * @module marriageValidation
 */

/**
 * Check if a profile is an Al-Qefari family member (has valid HID)
 *
 * Al-Qefari members have:
 * - hid !== null
 * - hid is a non-empty string after trimming
 * - Format: "R1.2.1.1" or similar
 *
 * Munasib (external spouses) have:
 * - hid === null
 * - family_origin !== null (e.g., "الجربوع", "العتيبي")
 *
 * @param {Object} profile - Profile object with hid field
 * @returns {boolean} True if profile has valid HID
 */
export const isAlQefariMember = (profile) => {
  if (!profile?.hid) return false;
  if (typeof profile.hid !== 'string') return false;
  return profile.hid.trim().length > 0;
};

/**
 * Determine if marriage is a cousin marriage (both spouses are Al-Qefari)
 *
 * @param {Object} person1 - First spouse profile
 * @param {Object} person2 - Second spouse profile
 * @returns {boolean} True if both have valid HID (cousin marriage)
 */
export const isCousinMarriage = (person1, person2) => {
  return isAlQefariMember(person1) && isAlQefariMember(person2);
};

/**
 * Get the munasib value for a marriage
 *
 * Returns:
 * - null for cousin marriages (both Al-Qefari)
 * - family_origin string for regular marriages (e.g., "الجربوع")
 *
 * @param {Object} person1 - First spouse profile
 * @param {Object} person2 - Second spouse profile
 * @returns {string|null} Munasib value for marriages table
 */
export const getMunasibValue = (person1, person2) => {
  if (isCousinMarriage(person1, person2)) {
    return null;
  }

  // Find the munasib spouse (one without HID) and get their family_origin
  const munasibSpouse = !isAlQefariMember(person1) ? person1 : person2;
  const familyOrigin = munasibSpouse.family_origin;

  // Validate family_origin is not just whitespace
  if (!familyOrigin || typeof familyOrigin !== 'string') {
    return null;
  }

  const trimmed = familyOrigin.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Validate marriage creation request
 *
 * Checks:
 * - Both profiles exist with valid IDs
 * - Not marrying self
 * - Both profiles have gender specified
 * - Spouses are different genders (no same-gender marriages)
 *
 * @param {Object} person - Current person profile
 * @param {Object} spouse - Selected spouse profile
 * @throws {Error} with user-friendly Arabic message
 * @returns {Object} {husbandId, wifeId} - IDs for marriage record
 */
export const validateMarriageProfiles = (person, spouse) => {
  if (!person?.id) {
    throw new Error('بيانات الشخص الحالي غير متوفرة');
  }

  if (!spouse?.id) {
    throw new Error('بيانات الزوج/الزوجة غير متوفرة');
  }

  if (person.id === spouse.id) {
    throw new Error('لا يمكن الزواج من نفس الشخص');
  }

  if (!person.gender) {
    throw new Error('نوع الجنس غير محدد للشخص الحالي');
  }

  if (!spouse.gender) {
    throw new Error('نوع الجنس غير محدد للزوج/الزوجة');
  }

  // NEW: Validate spouses are different genders
  if (person.gender === spouse.gender) {
    throw new Error('يجب أن يكون الزوجان من جنسين مختلفين');
  }

  const husbandId = person.gender === 'male' ? person.id : spouse.id;
  const wifeId = person.gender === 'female' ? person.id : spouse.id;

  return { husbandId, wifeId };
};

/**
 * Get marriage type as a string for logging/display
 *
 * @param {Object} person1 - First spouse
 * @param {Object} person2 - Second spouse
 * @returns {'cousin'|'munasib'} Marriage type
 */
export const getMarriageType = (person1, person2) => {
  return isCousinMarriage(person1, person2) ? 'cousin' : 'munasib';
};

export default {
  isAlQefariMember,
  isCousinMarriage,
  getMunasibValue,
  validateMarriageProfiles,
  getMarriageType,
};
