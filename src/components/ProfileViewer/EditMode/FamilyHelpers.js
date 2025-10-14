/**
 * FamilyHelpers - Shared Helper Components for Family Editing
 *
 * This file contains reusable UI components and utility functions used throughout
 * the family editing interface:
 *
 * Components:
 * - SectionCard: Styled card container for major sections (Mother, Spouses, Children)
 * - ParentProfileCard: Displays parent (father/mother) profile with action buttons
 *
 * Utilities:
 * - getInitials: Extracts initials from a person's name for avatar fallbacks
 *
 * @module FamilyHelpers
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../ui/tokens';
import { ProgressiveThumbnail } from '../../ProgressiveImage';
import { getShortNameChain } from '../../../utils/nameChainUtils';

/**
 * SectionCard Component
 *
 * Styled container for major family sections (Mother, Spouses, Children).
 * Provides consistent header with icon, title, optional badge, and footer.
 *
 * @param {object} props
 * @param {string} props.icon - Ionicons name for section icon
 * @param {string} props.iconTint - Color for the icon (default: Najdi primary)
 * @param {string} props.badge - Optional badge text (e.g., "3")
 * @param {string} props.title - Section title
 * @param {string} props.subtitle - Optional subtitle
 * @param {React.ReactNode} props.children - Section content
 * @param {React.ReactNode} props.footer - Optional footer content
 * @param {object} props.style - Additional styles
 */
export const SectionCard = React.memo(({
  icon,
  iconTint = tokens.colors.najdi.primary,
  badge,
  title,
  subtitle,
  children,
  footer,
  style,
}) => (
  <View style={[styles.sectionCard, style]}>
    <View style={styles.sectionHeader}>
      {icon ? (
        <View style={[styles.sectionIcon, { backgroundColor: `${iconTint}15` }]}>
          <Ionicons name={icon} size={20} color={iconTint} />
        </View>
      ) : null}
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.sectionBody}>{children}</View>
    {footer ? <View style={styles.sectionFooter}>{footer}</View> : null}
  </View>
));
SectionCard.displayName = 'SectionCard';

SectionCard.propTypes = {
  icon: PropTypes.string,
  iconTint: PropTypes.string,
  badge: PropTypes.string,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  style: PropTypes.object,
};

/**
 * Get Initials Utility Function
 *
 * Extracts initials from a person's name for avatar fallbacks.
 * - Single word: Returns first 2 characters (e.g., "Ali" → "AL")
 * - Multiple words: Returns first character of first 2 words (e.g., "Ali Ahmed" → "AA")
 *
 * @param {string} name - Person's full name
 * @returns {string} Initials in uppercase, or '؟' if no name provided
 */
export const getInitials = (name) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

/**
 * AvatarThumbnail Component
 *
 * Displays a profile photo or fallback initials avatar.
 * Used by SpouseRow and ChildRow components.
 *
 * @param {object} props
 * @param {string} props.photoUrl - URL to profile photo
 * @param {number} props.size - Size of avatar in pixels (default: 52)
 * @param {string} props.fallbackLabel - Initials to show if no photo
 */
export const AvatarThumbnail = ({ photoUrl, size = 52, fallbackLabel }) => {
  if (photoUrl) {
    return (
      <ProgressiveThumbnail
        source={{ uri: photoUrl }}
        size={size}
        style={[styles.memberAvatarImage, { borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.memberAvatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.memberAvatarInitial}>{fallbackLabel}</Text>
    </View>
  );
};
AvatarThumbnail.displayName = 'AvatarThumbnail';

AvatarThumbnail.propTypes = {
  photoUrl: PropTypes.string,
  size: PropTypes.number,
  fallbackLabel: PropTypes.string.isRequired,
};

/**
 * ParentProfileCard Component
 *
 * Displays a parent (father/mother) profile with avatar, name, and action button.
 * Supports both filled (has profile) and empty (no profile) states.
 *
 * @param {object} props
 * @param {string} props.label - Label for the parent (e.g., "الأب", "الأم")
 * @param {object} props.profile - Parent profile object with id, name, photo_url
 * @param {string} props.emptyTitle - Title to show when no profile exists
 * @param {string} props.emptySubtitle - Subtitle hint when no profile exists
 * @param {function} props.onAction - Callback when action button is pressed
 * @param {string} props.actionLabel - Label for action button (default: "تغيير")
 * @param {React.ReactNode} props.children - Additional content to show below header
 * @param {string} props.infoHint - Optional info hint to show at bottom
 * @param {string} props.actionTone - Button tone: 'primary' | 'secondary' (default: 'primary')
 */
export const ParentProfileCard = React.memo(({
  label,
  profile,
  emptyTitle,
  emptySubtitle,
  onAction,
  actionLabel = 'تغيير',
  children,
  infoHint,
  actionTone = 'primary',
}) => {
  const hasProfile = Boolean(profile);
  const initials = hasProfile ? getInitials(profile.name) : '؟';
  const shortChain = hasProfile ? getShortNameChain(profile) : null;

  const renderAvatar = () => {
    if (hasProfile && profile.photo_url) {
      return (
        <ProgressiveThumbnail
          source={{ uri: profile.photo_url }}
          size={56}
          style={styles.parentAvatarImage}
        />
      );
    }

    return (
      <View style={[styles.parentAvatarFallback, !hasProfile && styles.parentAvatarEmpty]}>
        <Text style={styles.parentAvatarInitial}>{initials}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.parentCard, !hasProfile && styles.parentCardEmpty]}>
      <View style={styles.parentHeader}>
        <View style={styles.parentAvatar}>{renderAvatar()}</View>
        <View style={styles.parentDetails}>
          <Text style={styles.parentLabel}>{label}</Text>
          <Text
            style={[styles.parentName, !hasProfile && styles.parentNameEmpty]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {hasProfile ? (shortChain || profile.name) : emptyTitle}
          </Text>
          {!hasProfile && emptySubtitle ? (
            <Text style={styles.parentHint}>{emptySubtitle}</Text>
          ) : null}
        </View>
      </View>
      {onAction ? (
        <TouchableOpacity
          style={[
            styles.parentActionButton,
            actionTone === 'secondary' && styles.parentActionButtonSecondary,
          ]}
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.parentActionButtonText,
              actionTone === 'secondary' && styles.parentActionButtonTextSecondary,
            ]}
          >
            {actionLabel}
          </Text>
          <Ionicons
            name={actionTone === 'secondary' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={actionTone === 'secondary' ? tokens.colors.najdi.primary : tokens.colors.surface}
            style={styles.parentActionButtonIcon}
          />
        </TouchableOpacity>
      ) : null}
      {children ? <View style={styles.parentExtras}>{children}</View> : null}
      {!children && infoHint ? (
        <View style={styles.parentInfoHint}>
          <Ionicons name="information-circle-outline" size={14} color={tokens.colors.najdi.textMuted} />
          <Text style={styles.parentInfoHintText}>{infoHint}</Text>
        </View>
      ) : null}
    </View>
  );
});
ParentProfileCard.displayName = 'ParentProfileCard';

ParentProfileCard.propTypes = {
  label: PropTypes.string.isRequired,
  profile: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    photo_url: PropTypes.string,
  }),
  emptyTitle: PropTypes.string.isRequired,
  emptySubtitle: PropTypes.string,
  onAction: PropTypes.func,
  actionLabel: PropTypes.string,
  children: PropTypes.node,
  infoHint: PropTypes.string,
  actionTone: PropTypes.oneOf(['primary', 'secondary']),
};

/**
 * Styles for FamilyHelpers components
 *
 * Follows Najdi Sadu design system:
 * - 8px spacing grid
 * - SF Arabic typography
 * - Al-Jass White, Camel Hair Beige, Najdi Crimson colors
 * - Subtle shadows (max 0.08 opacity)
 */
const styles = StyleSheet.create({
  // ============= SectionCard Styles =============
  sectionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    marginBottom: 24,
    padding: 0,
    shadowColor: tokens.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${tokens.colors.najdi.border}40`,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF-Arabic-Semibold',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF-Arabic-Regular',
    marginTop: 2,
  },
  sectionBadge: {
    backgroundColor: `${tokens.colors.najdi.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
    fontFamily: 'SF-Arabic-Semibold',
  },
  sectionBody: {
    padding: 20,
  },
  sectionFooter: {
    padding: 20,
    paddingTop: 0,
  },

  // ============= ParentProfileCard Styles =============
  parentCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: tokens.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  parentCardEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colors.najdi.border,
    backgroundColor: `${tokens.colors.najdi.border}10`,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parentAvatar: {
    marginLeft: 12,
  },
  parentAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  parentAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${tokens.colors.najdi.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarEmpty: {
    backgroundColor: `${tokens.colors.najdi.border}30`,
  },
  parentAvatarInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.secondary,
    fontFamily: 'SF-Arabic-Semibold',
  },
  parentDetails: {
    flex: 1,
  },
  parentLabel: {
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF-Arabic-Regular',
    marginBottom: 4,
  },
  parentName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF-Arabic-Semibold',
  },
  parentNameEmpty: {
    color: tokens.colors.najdi.textMuted,
    fontStyle: 'italic',
  },
  parentHint: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF-Arabic-Regular',
    marginTop: 4,
  },
  parentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  parentActionButtonSecondary: {
    backgroundColor: `${tokens.colors.najdi.primary}10`,
  },
  parentActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
    fontFamily: 'SF-Arabic-Semibold',
  },
  parentActionButtonTextSecondary: {
    color: tokens.colors.najdi.primary,
  },
  parentActionButtonIcon: {
    marginRight: 6,
  },
  parentExtras: {
    marginTop: 12,
  },
  parentInfoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: `${tokens.colors.najdi.info}10`,
    borderRadius: 8,
  },
  parentInfoHintText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF-Arabic-Regular',
    marginRight: 8,
    flex: 1,
  },

  // ============= AvatarThumbnail Styles =============
  memberAvatarImage: {
    // Dynamic sizing handled inline
  },
  memberAvatarFallback: {
    backgroundColor: `${tokens.colors.najdi.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.najdi.secondary,
    fontFamily: 'SF-Arabic-Semibold',
  },
});
