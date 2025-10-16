import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { toArabicNumerals } from "../../utils/dateUtils";
import { formatNameWithTitle } from "../../services/professionalTitleService";
import useDynamicTypography from "../../hooks/useDynamicTypography";

/**
 * SearchResultCard - Shared card component for search results
 * Used in SearchBar dropdown and SpouseManager modal
 *
 * Maintains exact visual consistency across the app
 */
export default function SearchResultCard({ item, index, onPress, isLast = false }) {
  const getTypography = useDynamicTypography();
  const fontFamilyBase = Platform.OS === "ios" ? "System" : "Roboto";
  const fontFamilyArabic = Platform.OS === "ios" ? "SF Arabic" : "Roboto";

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
    // Use index to ensure each result has a different color
    return desertPalette[index % desertPalette.length];
  };

  const nameTypography = useMemo(() => {
    const typography = getTypography("headline", {
      fontWeight: "500",
      fontFamily: fontFamilyArabic,
    });
    return {
      ...typography,
      letterSpacing: -0.1,
    };
  }, [getTypography, fontFamilyArabic]);

  const generationTypography = useMemo(
    () =>
      getTypography("footnote", {
        fontFamily: fontFamilyArabic,
        fontWeight: "400",
      }),
    [getTypography, fontFamilyArabic],
  );

  const avatarTypography = useMemo(() => {
    const typography = getTypography("subheadline", {
      fontFamily: fontFamilyBase,
      fontWeight: "500",
    });
    return {
      ...typography,
      lineHeight: typography.fontSize,
    };
  }, [getTypography, fontFamilyBase]);

  const initials = item.name ? item.name.charAt(0) : "؟";
  const desertColor = getDesertColor(index);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(item);
      }}
      style={({ pressed }) => [
        styles.resultCard,
        pressed && styles.resultCardPressed,
        isLast && styles.lastCard,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Saudi-style avatar - positioned on RIGHT for RTL */}
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

        {/* Text content - RTL aligned to right edge */}
        <View style={styles.textContainer}>
          <Text style={[styles.nameText, nameTypography]} allowFontScaling numberOfLines={1}>
            {formatNameWithTitle(item) || "بدون اسم"}
          </Text>
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
}

const styles = StyleSheet.create({
  // iOS list item style - clean, continuous
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
    backgroundColor: "#D1BBA310", // Subtle press state
    transform: [{ scale: 1 }], // No scale on press for iOS list
  },
  lastCard: {
    borderBottomWidth: 0, // No separator on last item
  },
  cardContent: {
    flexDirection: "row-reverse", // RTL: avatar on right, chevron on left
    alignItems: "center",
    paddingVertical: 11, // iOS list item standard
    paddingLeft: 16, // iOS standard horizontal padding
    paddingRight: 16,
    minHeight: 44, // iOS touch target standard
  },
  // Refined avatar styling - on right side for RTL
  avatarContainer: {
    marginLeft: 0, // Remove left margin
    marginRight: 0, // Avatar should be flush right
  },
  avatarPhoto: {
    width: 36, // iOS small avatar standard
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
  },
  avatarCircle: {
    width: 36, // iOS small avatar standard
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor set dynamically
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
    alignItems: "flex-start", // Changed to flex-start for proper RTL text alignment
  },
  nameText: {
    color: "#242121", // Sadu Night
    marginBottom: 3,
    textAlign: "left", // Changed to left for proper display with row-reverse
    alignSelf: "stretch", // Take full width
    writingDirection: "rtl", // Force RTL writing direction
  },
  metaContainer: {
    flexDirection: "row", // Normal row for generation text
    alignItems: "center",
    alignSelf: "flex-start", // Align to start of container
    justifyContent: "flex-start", // Ensure content aligns to start
  },
  generationText: {
    opacity: 0.6,
    textAlign: "left", // Changed to left for proper display with row-reverse
    writingDirection: "rtl", // Force RTL writing direction
    // color set dynamically
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
