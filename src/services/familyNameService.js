/**
 * Family Name Extraction and Management Service
 * Handles intelligent extraction of family names from Arabic full names
 * and manages family origin tracking for the Munasib system
 */

import appConfig from "../config/appConfig";

class FamilyNameService {
  /**
   * Extract family name from a full Arabic name
   * @param {string} fullName - Full Arabic name
   * @returns {string|null} - Extracted family name or null
   */
  extractFamilyName(fullName) {
    if (!fullName || typeof fullName !== "string") {
      return null;
    }

    const trimmed = fullName.trim();
    if (!trimmed) return null;

    // Split by spaces and filter empty strings
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) return null;

    // Get the last word as the family name
    const lastWord = words[words.length - 1];

    // Check if it's an Al-Qefari variant (cousin marriage case)
    if (this.isAlQefariFamily(lastWord)) {
      return null; // Return null for cousin marriages
    }

    return lastWord;
  }

  /**
   * Check if a family name is a variant of Al-Qefari
   * @param {string} familyName - Family name to check
   * @returns {boolean} - True if it's an Al-Qefari variant
   */
  isAlQefariFamily(familyName) {
    if (!familyName) return false;

    const normalizedName = familyName.toLowerCase();

    // Check against known variations
    const alQefariVariants = [
      "القفاري",
      "قفاري",
      "الغفاري",
      "غفاري",
      "القفارى",
      "الغفارى",
      ...appConfig.family.familyNameVariations.map((v) => v.toLowerCase()),
    ];

    return alQefariVariants.some((variant) => {
      return (
        normalizedName === variant ||
        normalizedName.includes("قفار") ||
        normalizedName.includes("غفار")
      );
    });
  }

  /**
   * Normalize family name for consistent storage and searching
   * @param {string} familyName - Family name to normalize
   * @returns {string} - Normalized family name
   */
  normalizeFamilyName(familyName) {
    if (!familyName) return "";

    let normalized = familyName.trim();

    // Ensure it starts with "ال" if it doesn't already
    if (!normalized.startsWith("ال") && !normalized.startsWith("آل")) {
      normalized = "ال" + normalized;
    }

    return normalized;
  }

  /**
   * Parse a full name and extract components
   * @param {string} fullName - Full Arabic name
   * @param {string} gender - Gender ('male' or 'female')
   * @returns {object} - Parsed name components
   */
  parseFullName(fullName, gender = "female") {
    if (!fullName) {
      return {
        firstName: "",
        middleChain: [],
        familyName: "",
        familyOrigin: null,
      };
    }

    const words = fullName.trim().split(/\s+/).filter((w) => w.length > 0);

    if (words.length < 2) {
      return {
        firstName: words[0] || "",
        middleChain: [],
        familyName: "",
        familyOrigin: null,
      };
    }

    const firstName = words[0];
    const familyName = words[words.length - 1];
    const middleChain = words.slice(1, -1);

    // Extract family origin (null if Al-Qefari variant)
    const familyOrigin = this.isAlQefariFamily(familyName)
      ? null
      : this.normalizeFamilyName(familyName);

    return {
      firstName,
      middleChain,
      familyName,
      familyOrigin,
    };
  }

  /**
   * Format display name with family origin
   * @param {string} name - Person's name
   * @param {string} familyOrigin - Family origin
   * @returns {string} - Formatted display name
   */
  formatNameWithFamily(name, familyOrigin) {
    if (!name) return "غير معروف";

    if (!familyOrigin) return name;

    // Extract first name from full name
    const firstName = name.split(" ")[0] || name;

    return `${firstName} من عائلة ${familyOrigin}`;
  }

  /**
   * Search for similar family names (fuzzy matching)
   * @param {string} familyName - Family name to search
   * @param {array} existingFamilies - List of existing family names
   * @returns {array} - Similar family names
   */
  findSimilarFamilies(familyName, existingFamilies) {
    if (!familyName || !existingFamilies) return [];

    const normalized = this.normalizeFamilyName(familyName).toLowerCase();

    return existingFamilies.filter((existing) => {
      const existingNorm = this.normalizeFamilyName(existing).toLowerCase();

      // Exact match
      if (existingNorm === normalized) return true;

      // Partial match (contains)
      if (
        existingNorm.includes(normalized) ||
        normalized.includes(existingNorm)
      ) {
        return true;
      }

      // Check without "ال" prefix
      const withoutAl1 = normalized.replace(/^(ال|آل)/, "");
      const withoutAl2 = existingNorm.replace(/^(ال|آل)/, "");

      return withoutAl1 === withoutAl2;
    });
  }

  /**
   * Get family statistics from a list of profiles
   * @param {array} profiles - List of Munasib profiles
   * @returns {object} - Family statistics grouped by family name
   */
  getFamilyStatistics(profiles) {
    const familyGroups = {};

    profiles.forEach((profile) => {
      const familyName =
        profile.family_origin ||
        this.extractFamilyName(profile.name) ||
        "غير محدد";

      if (!familyGroups[familyName]) {
        familyGroups[familyName] = {
          name: familyName,
          count: 0,
          males: 0,
          females: 0,
          profiles: [],
          generations: new Set(),
        };
      }

      familyGroups[familyName].count++;
      familyGroups[familyName].profiles.push(profile);

      if (profile.gender === "male") {
        familyGroups[familyName].males++;
      } else {
        familyGroups[familyName].females++;
      }

      if (profile.generation) {
        familyGroups[familyName].generations.add(profile.generation);
      }
    });

    // Convert sets to arrays and sort
    Object.values(familyGroups).forEach((group) => {
      group.generations = Array.from(group.generations).sort((a, b) => a - b);
    });

    return familyGroups;
  }

  /**
   * Check if two family names might be the same (fuzzy matching)
   * @param {string} name1 - First family name
   * @param {string} name2 - Second family name
   * @returns {boolean} - True if names might be the same
   */
  isSameFamily(name1, name2) {
    if (!name1 || !name2) return false;

    const norm1 = this.normalizeFamilyName(name1).toLowerCase();
    const norm2 = this.normalizeFamilyName(name2).toLowerCase();

    // Exact match
    if (norm1 === norm2) return true;

    // Check without "ال" prefix
    const withoutAl1 = norm1.replace(/^(ال|آل)/, "");
    const withoutAl2 = norm2.replace(/^(ال|آل)/, "");

    return withoutAl1 === withoutAl2;
  }
}

// Export singleton instance
export default new FamilyNameService();