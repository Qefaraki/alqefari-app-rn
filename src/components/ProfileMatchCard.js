import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getProfileDisplayName } from "../utils/nameChainBuilder";

// Desert palette colors
const DESERT_PALETTE = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender Haze
  "#736372", // Muted Plum
  "#D1BBA399", // Camel Hair Beige 60%
];

// Generation names
const GENERATION_NAMES = [
  "الجيل الأول",
  "الجيل الثاني",
  "الجيل الثالث",
  "الجيل الرابع",
  "الجيل الخامس",
  "الجيل السادس",
  "الجيل السابع",
  "الجيل الثامن",
  "الجيل التاسع",
  "الجيل العاشر",
  "الجيل الحادي عشر",
  "الجيل الثاني عشر",
];

const getInitials = (name) => {
  if (!name) return "؟";
  return name.trim().charAt(0);
};

const getGenerationName = (generation) => {
  return GENERATION_NAMES[generation - 1] || `الجيل ${generation}`;
};

const ProfileMatchCard = ({ profile, isSelected, onPress, index }) => {
  const avatarColor = DESERT_PALETTE[index % DESERT_PALETTE.length];
  const initials = getInitials(profile.name);

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
        isSelected && styles.resultCardSelected,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile.photo_url ? (
            <Image
              source={{ uri: profile.photo_url }}
              style={styles.avatarPhoto}
            />
          ) : (
            <View
              style={[styles.avatarCircle, { backgroundColor: avatarColor }]}
            >
              <Text style={styles.avatarLetter}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={styles.nameText} numberOfLines={2}>
            {getProfileDisplayName(profile)}
          </Text>
          <View style={styles.metaContainer}>
            {/* Generation - only show for Al-Qefari family members (hid !== null) */}
            {profile?.hid !== null && (
              <>
                <Text style={[styles.generationText, { color: avatarColor }]}>
                  {getGenerationName(profile.generation || 1)}
                </Text>
                {/* Match percentage */}
                <Text style={styles.metaSeparator}>•</Text>
              </>
            )}
            <Text style={[styles.matchPercentage, { color: avatarColor }]}>
              {Math.round(profile.match_score)}% تطابق
            </Text>
          </View>
        </View>

        {/* Selection checkmark only */}
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={22} color={avatarColor} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  resultCard: {
    backgroundColor: "#F9F7F3",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(209, 187, 163, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    height: 88, // Fixed height for getItemLayout
  },
  resultCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  resultCardSelected: {
    borderColor: "#A13333",
    borderWidth: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    flex: 1,
  },
  avatarContainer: {
    marginEnd: 16,
  },
  avatarPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "600",
    color: "#F9F7F3",
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    marginBottom: 6,
    lineHeight: 22,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  generationText: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaSeparator: {
    fontSize: 13,
    color: "#24212199",
    marginHorizontal: 6,
  },
  linkedText: {
    fontSize: 13,
    color: "#24212199",
    fontWeight: "500",
  },
  matchPercentage: {
    fontSize: 13,
    fontWeight: "600",
  },
  checkmarkContainer: {
    marginStart: 12,
  },
});

export default React.memo(ProfileMatchCard);