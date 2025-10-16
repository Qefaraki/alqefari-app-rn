import { useMemo } from 'react';
import { ADMIN_FEATURES, canAccessFeature, getAccessibleFeaturesBySection } from '../config/adminFeatures';

/**
 * Hook for checking admin feature access permissions
 * @param {string} userRole - Current user's role
 * @returns {Object} - { canAccess, accessMap, featuresBySection }
 */
export const useFeatureAccess = (userRole) => {
  // Build access map once when role changes
  const accessMap = useMemo(() => {
    const map = {};
    Object.entries(ADMIN_FEATURES).forEach(([key, feature]) => {
      map[feature.id] = canAccessFeature(userRole, feature.id);
    });
    return map;
  }, [userRole]);

  // Get features grouped by section
  const featuresBySection = useMemo(() => {
    return getAccessibleFeaturesBySection(userRole);
  }, [userRole]);

  return {
    /**
     * Check if user can access a specific feature
     * @param {string} featureId - Feature ID to check
     * @returns {boolean}
     */
    canAccess: (featureId) => accessMap[featureId] || false,

    /**
     * Quick access map for all features
     * Example: accessMap['permission_manager'] => true/false
     */
    accessMap,

    /**
     * Features grouped by section
     * Example: featuresBySection.core => [LINK_REQUESTS, MUNASIB_MANAGER, ...]
     */
    featuresBySection,
  };
};
