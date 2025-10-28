/**
 * Admin Dashboard Feature Registry
 * Central source of truth for feature access control
 *
 * To add a new feature:
 * 1. Add feature object to ADMIN_FEATURES
 * 2. Update AdminDashboard to render it conditionally
 * 3. Feature will automatically respect role permissions
 */

export const ADMIN_FEATURES = {
  // Super Admin Only Features
  PERMISSION_MANAGER: {
    id: 'permission_manager',
    requiredRoles: ['super_admin'],
    section: 'core',
    icon: 'star-outline',
    title: 'إدارة الصلاحيات',
    color: 'primary',
  },
  BROADCAST_MANAGER: {
    id: 'broadcast_manager',
    requiredRoles: ['super_admin'],
    section: 'tools',
    icon: 'mail-outline',
    title: 'إشعارات جماعية',
    color: 'primary',
  },

  // Admin + Super Admin Features
  LINK_REQUESTS: {
    id: 'link_requests',
    requiredRoles: ['super_admin', 'admin'],
    section: 'core',
    icon: 'link-outline',
    title: 'ربط الملفات',
    color: 'primary',
    hasBadge: true, // Shows pending count
  },
  ACTIVITY_LOG: {
    id: 'activity_log',
    requiredRoles: ['super_admin', 'admin'],
    section: 'tools',
    icon: 'time-outline',
    title: 'سجل النشاط',
    color: 'text',
  },
  MESSAGE_TEMPLATES: {
    id: 'message_templates',
    requiredRoles: ['super_admin', 'admin'],
    section: 'tools',
    icon: 'logo-whatsapp',
    title: 'التواصل',
    color: '#25D366', // WhatsApp green
  },

  // All Admin Roles (super_admin, admin, moderator)
  MUNASIB_MANAGER: {
    id: 'munasib_manager',
    requiredRoles: ['super_admin', 'admin', 'moderator'],
    section: 'core',
    icon: 'people-outline',
    title: 'الأنساب',
    color: 'secondary',
  },
  FAMILY_STATISTICS: {
    id: 'family_statistics',
    requiredRoles: ['super_admin', 'admin', 'moderator'],
    section: 'core',
    icon: 'stats-chart-outline',
    title: 'إحصائيات العائلة',
    subtitle: 'عرض إحصائيات شاملة',
    color: 'secondary',
  },
  SUGGESTION_REVIEW: {
    id: 'suggestion_review',
    requiredRoles: ['super_admin', 'admin', 'moderator'],
    section: 'core',
    icon: 'document-text-outline',
    title: 'مراجعة الاقتراحات',
    color: 'text',
    hasBadge: true, // Shows pending count
  },
};

/**
 * Check if a user role can access a specific feature
 * @param {string} userRole - User's role (super_admin, admin, moderator, user)
 * @param {string} featureId - Feature ID from ADMIN_FEATURES
 * @returns {boolean} - Whether user can access the feature
 */
export const canAccessFeature = (userRole, featureId) => {
  const feature = Object.values(ADMIN_FEATURES).find(f => f.id === featureId);
  if (!feature) return false;
  return feature.requiredRoles.includes(userRole);
};

/**
 * Get all features accessible by a specific role, grouped by section
 * @param {string} userRole - User's role
 * @returns {Object} - { core: [...features], tools: [...features] }
 */
export const getAccessibleFeaturesBySection = (userRole) => {
  const accessible = Object.values(ADMIN_FEATURES).filter(
    feature => feature.requiredRoles.includes(userRole)
  );

  return {
    core: accessible.filter(f => f.section === 'core'),
    tools: accessible.filter(f => f.section === 'tools'),
  };
};
