import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PropTypes from "prop-types";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
} from "react-native-reanimated";
import { toArabicNumerals } from "../../utils/dateUtils";
import tokens from "../ui/tokens";

/**
 * SearchResultCard - Reusable search result card component
 * Used by both SearchModal and SpouseManager
 * Shows profile with breadcrumb ancestry, generation, and metadata
 *
 * Props:
 * - item: Profile object with name, name_chain, gender, generation, birth_year_hijri, photo_url
 * - index: Position in list (for animation delay)
 * - onPress: Callback when card is pressed
 * - showRelevanceScore: Show match score percentage (default: false)
 * - enableAnimation: Show fade-in animation (default: false)
 */
const SearchResultCard = ({
  item,
  index,
  onPress,
  showRelevanceScore = false,
  enableAnimation = false,
}) => {
  const initials = item?.name ? item.name.charAt(0) : "؟";
  const isAlive = !item?.death_year_hijri;

  // Generate consistent colors from profile names
  const generateColorFromName = (name) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
    ];
    const nameCode = name ? name.charCodeAt(0) : 0;
    return colors[nameCode % colors.length];
  };

  // Get relevance color based on score
  const getRelevanceColor = (score) => {
    if (score >= 8) return "#00C851";
    if (score >= 5) return "#FFB300";
    return "#666";
  };

  // Convert RPC match_score (0-10) to percentage (0-100)
  const getRelevancePercentage = (matchScore) => {
    if (!matchScore && matchScore !== 0) return 0;
    return Math.round(matchScore * 10);
  };

  // Defensive breadcrumb building with 3-level fallback
  const getBreadcrumbParts = (nameChain, gender) => {
    if (!nameChain || typeof nameChain !== 'string') return [];

    // Try gender-specific marker first
    const marker = gender === 'female' ? ' بنت ' : ' بن ';
    let parts = nameChain.split(marker);

    // Fallback: try opposite gender marker (edge case: munasib data)
    if (parts.length === 1) {
      const altMarker = gender === 'female' ? ' بن ' : ' بنت ';
      parts = nameChain.split(altMarker);
    }

    // Last resort: split by spaces if no markers found
    if (parts.length === 1) {
      parts = nameChain.split(/\s+/);
    }

    return parts.slice(0, 3).map(p => p.trim()).filter(Boolean);
  };

  // Render breadcrumb hierarchy
  const renderBreadcrumbs = () => {
    if (!item?.name_chain || item.name_chain.trim() === '') {
      // Fallback: show just the profile name
      return (
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {item?.name || 'غير محدد'}
        </Text>
      );
    }

    const parts = getBreadcrumbParts(item.name_chain, item?.gender);

    if (parts.length === 0) {
      return (
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          غير محدد
        </Text>
      );
    }

    return parts.map((name, idx) => (
      <React.Fragment key={idx}>
        {idx > 0 && (
          <Text style={styles.breadcrumbSeparator}>›</Text>
        )}
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {name}
        </Text>
      </React.Fragment>
    ));
  };

  // Always use Animated.View, conditionally apply animation
  const animationProps = enableAnimation ? {
    entering: FadeIn.delay(Math.min(index * 50, 500)).springify()
  } : {};

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const relevanceScore = getRelevancePercentage(item?.match_score);
  const avatarColor = generateColorFromName(item?.name);
  const relevanceColor = getRelevanceColor(item?.match_score);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.7 : 1 },
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <Animated.View
        {...animationProps}
        style={styles.modernCard}
      >
        {/* Left Side - Visual Identity */}
        <View style={styles.visualSection}>
          {/* Modern Avatar with Status Ring */}
          <View style={[styles.avatarContainer, isAlive && styles.aliveRing]}>
            {item?.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={styles.modernAvatar}
                defaultSource={require("../../../assets/icon.png")}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: avatarColor },
                ]}
              >
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            )}
            {/* Relevance Indicator */}
            {showRelevanceScore && (
              <View
                style={[
                  styles.relevanceDot,
                  { backgroundColor: relevanceColor },
                ]}
              >
                <Text style={styles.relevanceText}>{relevanceScore}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* Center - Information Hierarchy */}
        <View style={styles.contentSection}>
          {/* Primary Info */}
          <View style={styles.primaryInfo}>
            <Text style={styles.modernName} numberOfLines={1}>
              {item?.name || 'بدون اسم'}
            </Text>
            {isAlive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
              </View>
            )}
          </View>

          {/* Name Chain as Breadcrumb */}
          <View style={styles.breadcrumbContainer}>
            {renderBreadcrumbs()}
          </View>

          {/* Rich Metadata Row */}
          <View style={styles.metadataRow}>
            {/* Generation with Icon - only show for Al-Qefari family members (hid !== null) */}
            {item?.generation && item?.hid !== null && (
              <View style={styles.metaTag}>
                <View style={styles.genIcon}>
                  <Text style={styles.genIconText}>ج</Text>
                </View>
                <Text style={styles.metaLabel}>
                  {toArabicNumerals(item?.generation?.toString() || "0")}
                </Text>
              </View>
            )}

            {/* Birth Year */}
            {item?.birth_year_hijri && (
              <View style={styles.metaTag}>
                <Ionicons name="calendar-outline" size={12} color={tokens.colors.textMuted} />
                <Text style={styles.metaLabel}>
                  {toArabicNumerals(item.birth_year_hijri.toString())}هـ
                </Text>
              </View>
            )}

            {/* Location if available */}
            {item?.location && (
              <View style={styles.metaTag}>
                <Ionicons name="location-outline" size={12} color={tokens.colors.textMuted} />
                <Text style={styles.metaLabel}>{item.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Side - Action Area */}
        <View style={styles.actionSection}>
          <View style={styles.goButton}>
            <Ionicons name="arrow-back" size={18} color={tokens.colors.accent} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

SearchResultCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    name_chain: PropTypes.string,
    gender: PropTypes.oneOf(['male', 'female']),
    generation: PropTypes.number,
    photo_url: PropTypes.string,
    birth_year_hijri: PropTypes.number,
    death_year_hijri: PropTypes.number,
    location: PropTypes.string,
    match_score: PropTypes.number,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onPress: PropTypes.func.isRequired,
  showRelevanceScore: PropTypes.bool,
  enableAnimation: PropTypes.bool,
};

SearchResultCard.defaultProps = {
  showRelevanceScore: false,
  enableAnimation: false,
};

const styles = StyleSheet.create({
  // Ultra-modern card design inspired by Google Maps, Spotify, and Airbnb
  // NOTE: App uses forceRTL(true) - React Native auto-flips layouts
  // Use normal "row", "left", "flex-start" - don't use row-reverse/right/flex-end
  modernCard: {
    flexDirection: "row", // React Native auto-flips to row-reverse in RTL
    alignItems: "center",
    backgroundColor: tokens.colors.surface,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    // Sophisticated shadow for depth
    shadowColor: tokens.shadow.ios.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: tokens.shadow.ios.shadowRadius,
    elevation: tokens.shadow.android.elevation,
    // Subtle border for definition
    borderWidth: 0.5,
    borderColor: tokens.colors.divider,
  },
  visualSection: {
    marginRight: tokens.spacing.sm, // 12px - React Native auto-flips in RTL
  },
  avatarContainer: {
    position: "relative",
  },
  aliveRing: {
    borderWidth: 2,
    borderColor: tokens.colors.success,
    borderRadius: 28,
    padding: 2,
  },
  modernAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.bg,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.colors.surface,
    fontFamily: "SF Arabic",
  },
  relevanceDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.colors.surface,
  },
  relevanceText: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.colors.surface,
  },
  contentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start", // React Native auto-flips flex-start ↔ flex-end in RTL
  },
  primaryInfo: {
    flexDirection: "row", // React Native auto-flips to row-reverse in RTL
    alignItems: "center",
    marginBottom: 4,
  },
  modernName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
    flex: 1,
    textAlign: "left", // React Native auto-flips left ↔ right in RTL
  },
  liveBadge: {
    marginLeft: tokens.spacing.xs, // 8px - React Native auto-flips in RTL
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.success,
  },
  breadcrumbContainer: {
    flexDirection: "row", // React Native auto-flips to row-reverse in RTL
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "nowrap",
  },
  breadcrumbText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    fontFamily: "SF Arabic",
    maxWidth: 80,
    textAlign: "left", // React Native auto-flips left ↔ right in RTL
  },
  breadcrumbSeparator: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginHorizontal: tokens.spacing.xs,
  },
  metadataRow: {
    flexDirection: "row", // React Native auto-flips to row-reverse in RTL
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start", // React Native auto-flips flex-start ↔ flex-end in RTL
  },
  metaTag: {
    flexDirection: "row", // React Native auto-flips to row-reverse in RTL
    alignItems: "center",
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radii.sm,
  },
  genIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: tokens.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  genIconText: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.colors.surface,
    fontFamily: "SF Arabic",
  },
  metaLabel: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  actionSection: {
    justifyContent: "center",
    marginLeft: tokens.spacing.sm, // 12px - React Native auto-flips in RTL
  },
  goButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F4FF", // Light blue background for action button
    alignItems: "center",
    justifyContent: "center",
  },
});

export default React.memo(SearchResultCard);
