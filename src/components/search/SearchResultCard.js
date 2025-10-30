import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { toArabicNumerals } from "../../utils/dateUtils";
import useDynamicTypography from "../../hooks/useDynamicTypography";
import { SaduPlaceholderCanvas, DEFAULT_GLYPH_OPACITY } from "../TreeView/rendering/SaduPlaceholder";
import { TIDY_CIRCLE } from "../TreeView/rendering/nodeConstants";

/**
 * SearchResultCard - Original simple card with desert Sadu colors
 * Used by both SearchModal and SearchBar
 * Shows: name_chain, generation with desert color
 */
const SearchResultCard = ({
  item,
  index,
  onPress,
  isLast,
}) => {
  const getTypography = useDynamicTypography();
  const nameTypography = getTypography(16, 600);
  const generationTypography = getTypography('caption1', { fontWeight: '400' });
  const accentColor = TIDY_CIRCLE.COLORS.OUTER_RING;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.resultCard,
        pressed && styles.resultCardPressed,
        isLast && styles.lastCard,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Avatar - positioned on RIGHT for RTL */}
        <View style={styles.avatarContainer}>
          {(item.photo_url_cropped || item.photo_url) ? (
            <Image
              source={{ uri: item.photo_url_cropped || item.photo_url }}
              style={styles.avatarPhoto}
              defaultSource={require("../../../assets/icon.png")}
            />
          ) : (
            <SaduPlaceholderCanvas
              cx={18}
              cy={18}
              diameter={36}
              parentKey={item.father_id ?? null}
              fallbackKey={item.id ?? item.name ?? null}
              siblingOffset={index}
              glyphOpacity={DEFAULT_GLYPH_OPACITY}
            />
          )}
        </View>

        {/* Text content - RTL aligned */}
        <View style={styles.textContainer}>
          {/* Show ONLY name_chain, no duplicate */}
          <Text
            style={[styles.nameText, nameTypography]}
            allowFontScaling
            numberOfLines={2}
            accessibilityLabel={item.name_chain || item.name || "بدون اسم"}
          >
            {item.name_chain || item.name || "بدون اسم"}
          </Text>
          {/* Generation with desert color */}
          <View style={styles.metaContainer}>
            <Text
            style={[styles.generationText, generationTypography]}
              allowFontScaling
            >
              الجيل {toArabicNumerals(item.generation?.toString() || "0")}
            </Text>
          </View>
        </View>

        {/* Chevron indicator on left edge */}
        <View style={styles.chevronContainer}>
          <Text style={styles.chevron} allowFontScaling={false}>
            ‹
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  resultCard: {
    backgroundColor: "transparent", // iOS list items are transparent
    borderRadius: 0, // No radius for continuous list
    marginBottom: 0, // No gaps between items
    overflow: "hidden",
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)", // Subtle divider
  },
  resultCardPressed: {
    backgroundColor: "#D1BBA310", // Subtle press state (Camel Hair 20%)
    transform: [{ scale: 1 }], // No scale on press for iOS list
  },
  lastCard: {
    borderBottomWidth: 0, // No separator on last item
  },
  cardContent: {
    flexDirection: "row-reverse", // RTL: avatar on right, chevron on left
    alignItems: "center",
    paddingVertical: 11, // iOS list item standard for 44pt height alignment
    paddingLeft: 16, // iOS standard horizontal padding
    paddingRight: 16,
    minHeight: 44, // iOS touch target standard
  },
  // Avatar styling - on right side for RTL
  avatarContainer: {
    marginLeft: 0,
    marginRight: 0,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: {
    width: 36, // iOS small avatar standard
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
  },
  // Text styling - uses full width with forced RTL
  textContainer: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 12,
    alignItems: "flex-start", // For proper RTL text alignment
  },
  nameText: {
    color: "#242121", // Sadu Night
    marginBottom: 3,
    textAlign: "left", // For proper display with row-reverse
    alignSelf: "stretch",
    writingDirection: "rtl", // Force RTL writing direction
    maxWidth: "100%", // Ensure proper wrapping for 2-line names
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  generationText: {
    color: '#242121',
    opacity: 0.5,
    textAlign: "left", // For proper display with row-reverse
    writingDirection: "rtl", // Force RTL writing direction
  },
  // Minimal chevron - on left edge
  chevronContainer: {
    paddingLeft: 6,
  },
  chevron: {
    fontSize: 18,
    color: "#24212140", // Sadu Night 25%
    fontWeight: "300",
    opacity: 0.5,
  },
});

export default SearchResultCard;
