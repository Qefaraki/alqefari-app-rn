import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
} from "react-native-reanimated";
import { toArabicNumerals } from "../../utils/dateUtils";

/**
 * SearchResultCard - Reusable search result card component
 * Used by both SearchModal and SpouseManager
 * Renders card with avatar, name, breadcrumb ancestry, and metadata
 */
const SearchResultCard = ({
  item,
  index,
  onPress,
  showRelevanceScore = true,
  enableAnimation = false,
}) => {
  const initials = item.name ? item.name.charAt(0) : "؟";
  const isAlive = !item.death_year_hijri;

  // Create relevance score visual (based on match quality)
  const relevanceScore = Math.max(80 - index * 5, 30); // Mock score for demo

  // Helper function to generate consistent colors from names
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
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[colorIndex];
  };

  // Helper function for relevance color
  const getRelevanceColor = (score) => {
    if (score >= 80) return "#00C851";
    if (score >= 60) return "#FFB300";
    return "#666";
  };

  const animationProps = enableAnimation ? {
    entering: FadeIn.delay(index * 50).springify()
  } : {};

  return (
    <Pressable
      onPress={onPress}
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
            {item.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={styles.modernAvatar}
                defaultSource={require("../../../assets/icon.png")}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: generateColorFromName(item.name) },
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
                  { backgroundColor: getRelevanceColor(relevanceScore) },
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
              {item.name}
            </Text>
            {isAlive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
              </View>
            )}
          </View>

          {/* Name Chain as Breadcrumb */}
          <View style={styles.breadcrumbContainer}>
            {item.name_chain
              ?.split(" بن ")
              .slice(0, 3)
              .map((name, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <Text style={styles.breadcrumbSeparator}>›</Text>
                  )}
                  <Text style={styles.breadcrumbText} numberOfLines={1}>
                    {name.trim()}
                  </Text>
                </React.Fragment>
              ))}
          </View>

          {/* Rich Metadata Row */}
          <View style={styles.metadataRow}>
            {/* Generation with Icon - only show for Al-Qefari family members (hid !== null) */}
            {item.generation && item?.hid !== null && (
              <View style={styles.metaTag}>
                <View style={styles.genIcon}>
                  <Text style={styles.genIconText}>ج</Text>
                </View>
                <Text style={styles.metaLabel}>
                  {toArabicNumerals(item.generation?.toString() || "0")}
                </Text>
              </View>
            )}

            {/* Birth Year */}
            {item.birth_year_hijri && (
              <View style={styles.metaTag}>
                <Ionicons name="calendar-outline" size={12} color="#666" />
                <Text style={styles.metaLabel}>
                  {toArabicNumerals(item.birth_year_hijri.toString())}هـ
                </Text>
              </View>
            )}

            {/* Location if available */}
            {item.location && (
              <View style={styles.metaTag}>
                <Ionicons name="location-outline" size={12} color="#666" />
                <Text style={styles.metaLabel}>{item.location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Side - Action Area */}
        <View style={styles.actionSection}>
          <View style={styles.goButton}>
            <Ionicons name="arrow-back" size={18} color="#007AFF" />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Ultra-modern card design inspired by Google Maps, Spotify, and Airbnb
  modernCard: {
    flexDirection: "row-reverse", // RTL: photo on left, text starts from right
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    // Sophisticated shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    // Subtle border for definition
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.04)",
  },
  visualSection: {
    marginLeft: 14, // Changed from marginRight for RTL
  },
  avatarContainer: {
    position: "relative",
  },
  aliveRing: {
    borderWidth: 2,
    borderColor: "#00C851",
    borderRadius: 28,
    padding: 2,
  },
  modernAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F8F9FA",
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
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  relevanceDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00C851",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  relevanceText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end", // RTL: align text to the right
  },
  primaryInfo: {
    flexDirection: "row-reverse", // RTL: name first from right
    alignItems: "center",
    marginBottom: 4,
  },
  modernName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#1A1A1A",
    flex: 1,
    textAlign: "right", // RTL: align text to right
  },
  liveBadge: {
    marginRight: 8, // Changed from marginLeft for RTL
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C851",
  },
  breadcrumbContainer: {
    flexDirection: "row-reverse", // RTL: start from right
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "nowrap",
  },
  breadcrumbText: {
    fontSize: 13,
    color: "#666",
    fontFamily: "SF Arabic",
    maxWidth: 80,
    textAlign: "right", // RTL: align text right
  },
  breadcrumbSeparator: {
    fontSize: 12,
    color: "#999",
    marginHorizontal: 4,
  },
  metadataRow: {
    flexDirection: "row-reverse", // RTL: tags from right to left
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-end", // RTL: align row to right
  },
  metaTag: {
    flexDirection: "row-reverse", // RTL: icon and text reversed
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  genIconText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  metaLabel: {
    fontSize: 12,
    color: "#666",
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  actionSection: {
    justifyContent: "center",
    marginRight: 12, // Changed from marginLeft for RTL
  },
  goButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F8FF",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SearchResultCard;
