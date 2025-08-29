import profilesService from './profiles';

/**
 * Helper functions for backward compatibility during migration from v1 to v2 schema
 */
export const migrationHelpers = {
  /**
   * Convert old date format (string) to new JSONB format
   * @param {string} dateString - Date string like "1445"
   * @returns {Object|null} - DateData object or null
   */
  convertDateToJSONB(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    
    // Try to parse as Hijri year
    const yearMatch = dateString.match(/(\d{3,4})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      return {
        hijri: { year },
        display: `${year}هـ`
      };
    }
    
    return null;
  },

  /**
   * Get spouse count without direct field access
   * @param {string} profileId - Profile ID
   * @returns {Promise<number>} - Spouse count
   */
  async getSpouseCount(profileId) {
    try {
      const { data: marriages } = await profilesService.getPersonMarriages(profileId);
      return marriages?.length || 0;
    } catch (error) {
      console.error('Error getting spouse count:', error);
      return 0;
    }
  },

  /**
   * Get spouse names array
   * @param {string} profileId - Profile ID
   * @returns {Promise<string[]>} - Array of spouse names
   */
  async getSpouseNames(profileId) {
    try {
      const { data: marriages } = await profilesService.getPersonMarriages(profileId);
      return marriages?.map(m => m.spouse_name) || [];
    } catch (error) {
      console.error('Error getting spouse names:', error);
      return [];
    }
  },

  /**
   * Format date for display
   * @param {Object} dateData - DateData object
   * @returns {string} - Formatted date string
   */
  formatDateDisplay(dateData) {
    if (!dateData) return '';
    
    // Use pre-formatted display if available
    if (dateData.display) return dateData.display;
    
    // Format Hijri date
    if (dateData.hijri?.year) {
      const parts = [];
      if (dateData.hijri.day) parts.push(dateData.hijri.day);
      if (dateData.hijri.month) parts.push(dateData.hijri.month);
      parts.push(dateData.hijri.year);
      return parts.join('/') + 'هـ';
    }
    
    // Format Gregorian date
    if (dateData.gregorian?.year) {
      const prefix = dateData.gregorian.approximate ? '~' : '';
      const parts = [];
      if (dateData.gregorian.day) parts.push(dateData.gregorian.day);
      if (dateData.gregorian.month) parts.push(dateData.gregorian.month);
      parts.push(dateData.gregorian.year);
      return prefix + parts.join('/') + 'م';
    }
    
    return '';
  },

  /**
   * Extract year from DateData
   * @param {Object} dateData - DateData object
   * @returns {number|null} - Year or null
   */
  extractYear(dateData) {
    if (!dateData) return null;
    
    // Prefer Hijri year
    if (dateData.hijri?.year) {
      return dateData.hijri.year;
    }
    
    // Fall back to Gregorian
    if (dateData.gregorian?.year) {
      return dateData.gregorian.year;
    }
    
    return null;
  },

  /**
   * Calculate age from birth date
   * @param {Object} dobData - Date of birth DateData
   * @param {Object} dodData - Date of death DateData (optional)
   * @returns {string} - Age string or empty
   */
  calculateAge(dobData, dodData = null) {
    const birthYear = this.extractYear(dobData);
    if (!birthYear) return '';
    
    if (dodData) {
      const deathYear = this.extractYear(dodData);
      if (deathYear) {
        return `${deathYear - birthYear} سنة`;
      }
    } else {
      // Calculate from current Hijri year (approximate)
      const currentHijriYear = new Date().getFullYear() - 579; // Rough conversion
      return `${currentHijriYear - birthYear} سنة`;
    }
    
    return '';
  },

  /**
   * Extract social media platform URL
   * @param {Object} profile - Profile object
   * @param {string} platform - Platform name
   * @returns {string|null} - URL or null
   */
  getSocialMediaUrl(profile, platform) {
    // Check new structure first
    if (profile.social_media_links?.[platform]) {
      return profile.social_media_links[platform];
    }
    
    // Fallback to old structure (for migration period)
    if (profile[platform]) {
      return profile[platform];
    }
    
    return null;
  },

  /**
   * Get all social media links
   * @param {Object} profile - Profile object
   * @returns {Object} - All social media links
   */
  getAllSocialMedia(profile) {
    const links = {};
    
    // New structure
    if (profile.social_media_links && typeof profile.social_media_links === 'object') {
      Object.assign(links, profile.social_media_links);
    }
    
    // Old structure fallback
    const oldPlatforms = ['twitter', 'instagram', 'linkedin', 'website'];
    oldPlatforms.forEach(platform => {
      if (profile[platform] && !links[platform]) {
        links[platform] = profile[platform];
      }
    });
    
    return links;
  },

  /**
   * Check if profile data is using old schema
   * @param {Object} profile - Profile object
   * @returns {boolean} - True if old schema
   */
  isOldSchema(profile) {
    return !!(
      profile.birth_date ||
      profile.death_date ||
      profile.spouse_count !== undefined ||
      profile.spouse_names !== undefined ||
      profile.twitter ||
      profile.instagram ||
      profile.linkedin ||
      profile.website
    );
  },

  /**
   * Migrate old profile data to new format
   * @param {Object} oldProfile - Profile with old schema
   * @returns {Object} - Profile with new schema
   */
  migrateProfile(oldProfile) {
    const newProfile = { ...oldProfile };
    
    // Remove old fields
    delete newProfile.birth_date;
    delete newProfile.death_date;
    delete newProfile.spouse_count;
    delete newProfile.spouse_names;
    delete newProfile.twitter;
    delete newProfile.instagram;
    delete newProfile.linkedin;
    delete newProfile.website;
    
    // Convert dates if needed
    if (oldProfile.birth_date && !newProfile.dob_data) {
      newProfile.dob_data = this.convertDateToJSONB(oldProfile.birth_date);
    }
    
    if (oldProfile.death_date && !newProfile.dod_data) {
      newProfile.dod_data = this.convertDateToJSONB(oldProfile.death_date);
    }
    
    // Migrate social media
    if (!newProfile.social_media_links) {
      newProfile.social_media_links = {};
    }
    
    ['twitter', 'instagram', 'linkedin', 'website'].forEach(platform => {
      if (oldProfile[platform]) {
        newProfile.social_media_links[platform] = oldProfile[platform];
      }
    });
    
    // Ensure required fields
    if (!newProfile.hid) {
      newProfile.hid = `TEMP_${newProfile.id}`;
    }
    
    return newProfile;
  },

  /**
   * Safe profile data access helper
   * @param {Object} profile - Profile object (may be old or new schema)
   * @param {string} field - Field to access
   * @returns {any} - Field value with migration handling
   */
  safeGet(profile, field) {
    if (!profile) return null;
    
    // Handle date fields
    if (field === 'birth_year') {
      return this.extractYear(profile.dob_data) || 
             (profile.birth_date ? parseInt(profile.birth_date) : null);
    }
    
    if (field === 'death_year') {
      return this.extractYear(profile.dod_data) ||
             (profile.death_date ? parseInt(profile.death_date) : null);
    }
    
    // Handle social media
    if (['twitter', 'instagram', 'linkedin', 'website'].includes(field)) {
      return this.getSocialMediaUrl(profile, field);
    }
    
    // Direct access for other fields
    return profile[field];
  }
};

// Export helper functions individually for convenience
export const {
  convertDateToJSONB,
  formatDateDisplay,
  extractYear,
  calculateAge,
  getSocialMediaUrl,
  getAllSocialMedia,
  isOldSchema,
  migrateProfile,
  safeGet
} = migrationHelpers;

export default migrationHelpers;