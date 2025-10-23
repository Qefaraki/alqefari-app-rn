import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { toArabicNumerals } from "../../utils/dateUtils";
import useDynamicTypography from "../../hooks/useDynamicTypography";

/**
 * SearchResultCard - Original simple card with desert Sadu colors
 * Used by both SearchModal and SearchBar
 * Shows: name_chain, generation with desert color
 */
const SearchResultCard = ({
  item,
  index,
  onPress,
}) => {
  const initials = item.name ? item.name.charAt(0) : "؟";
  const getTypography = useDynamicTypography();
  const nameTypography = getTypography(16, 600);
  const generationTypography = getTypography(13, 400);
  const avatarTypography = getTypography(18, 600);
  const isLast = index === 99; // Simplified, actual prop would be passed

  // Premium desert palette - ultra-thin aesthetic
  const getDesertColor = (index) => {
    const desertPalette = [
      "#A13333", // Najdi Crimson
      "#D58C4A", // Desert Ochre
      "#D1BBA3", // Camel Hair Beige
      "#A13333CC", // Najdi Crimson 80%
      "#D58C4ACC", // Desert Ochre 80%
      "#D1BBA3CC", // Camel Hair Beige 80%
      "#A1333399", // Najdi Crimson 60%
      "#D58C4A99", // Desert Ochre 60%
      "#D1BBA399", // Camel Hair Beige 60%
      "#A13333", // Najdi Crimson (repeat)
    ];
    return desertPalette[index % desertPalette.length];
  };

  const desertColor = getDesertColor(index);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.resultCard,
        pressed && styles.resultCardPressed,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Avatar - positioned on RIGHT for RTL */}
        <View style={styles.avatarContainer}>
          {item.photo_url ? (
            <Image
              source={{ uri: item.photo_url }}
              style={styles.avatarPhoto}
              defaultSource={require("../../../assets/icon.png")}
            />
          ) : (
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: desertColor,
                },
              ]}
            >
              <Text style={[styles.avatarLetter, avatarTypography]} allowFontScaling>
                {initials}
              </Text>
            </View>
          )}
        </View>

        {/* Text content - RTL aligned */}
        <View style={styles.textContainer}>
          {/* Show ONLY name_chain, no duplicate */}
          <Text
            style={[styles.nameText, nameTypography]}
            allowFontScaling
            numberOfLines={1}
          >
            {item.name_chain || item.name || "بدون اسم"}
          </Text>
          {/* Generation with desert color */}
          <View style={styles.metaContainer}>
            <Text
              style={[styles.generationText, generationTypography, { color: desertColor }]}
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
  cardContent: {
    flexDirection: "row-reverse", // RTL: avatar on right, chevron on left
    alignItems: "center",
    paddingVertical: 11, // iOS list item standard
    paddingLeft: 16, // iOS standard horizontal padding
    paddingRight: 16,
    minHeight: 44, // iOS touch target standard
  },
  // Avatar styling - on right side for RTL
  avatarContainer: {
    marginLeft: 0,
    marginRight: 0,
  },
  avatarPhoto: {
    width: 36, // iOS small avatar standard
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#F9F7F3", // Al-Jass White
    textAlign: "center",
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
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  generationText: {
    opacity: 0.6,
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
