/**
 * Fast equality checking utilities optimized for form field comparison
 */

/**
 * Fast equality check optimized for form fields
 * - Primitives: Reference equality (instant)
 * - Arrays/Objects: Deep comparison only when necessary
 *
 * @param {any} a - First value
 * @param {any} b - Second value
 * @returns {boolean} - True if values are equal
 */
export const fastEqual = (a, b) => {
  // Fast path: Same reference or both null/undefined
  if (a === b) return true;

  // One is null/undefined, other isn't
  if (a == null || b == null) return false;

  // Different types
  if (typeof a !== typeof b) return false;

  // Primitives (already handled by === above, but explicit for clarity)
  if (typeof a !== 'object') return a === b;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => fastEqual(item, b[index]));
  }

  // Objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => fastEqual(a[key], b[key]));
};

/**
 * Optimized deep clone function
 * - Uses native structuredClone if available (3x faster)
 * - Fallback to JSON for compatibility
 *
 * @param {any} value - Value to clone
 * @returns {any} - Cloned value
 */
export const deepClone = (value) => {
  if (!value) return {};

  // Modern browsers (iOS 15.4+, Android Chrome 98+)
  // structuredClone is ~3x faster and handles more edge cases
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (error) {
      // Fallback if structuredClone fails (e.g., functions in object)
      console.warn('structuredClone failed, falling back to JSON', error);
    }
  }

  // Fallback: JSON method (works but slower)
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.error('Failed to clone value', error);
    return {};
  }
};
