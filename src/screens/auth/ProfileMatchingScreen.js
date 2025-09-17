import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";

import * as Haptics from "expo-haptics";

// Color constants - matching NameChainEntryScreen exactly
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#242121CC", // Sadu Night 80%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  inputBg: "rgba(209, 187, 163, 0.1)", // Container 10%
  inputBorder: "rgba(209, 187, 163, 0.4)", // Container 40%
};

// Match quality colors - using the desert palette from SearchBar
const DESERT_PALETTE = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender Haze
  "#736372", // Muted Plum
  "#D1BBA399", // Camel Hair Beige 60%
];

// Get initials from Arabic name
const getInitials = (name) => {
  if (!name) return "؟";
  const arabicName = name.trim();
  return arabicName.charAt(0);
};

// Convert generation to Arabic ordinal
const getGenerationName = (generation) => {
  const generationNames = [
    "الأول", // 1
    "الثاني", // 2
    "الثالث", // 3
    "الرابع", // 4
    "الخامس", // 5
    "السادس", // 6
    "السابع", // 7
    "الثامن", // 8
    "التاسع", // 9
    "العاشر", // 10
    "الحادي عشر", // 11
    "الثاني عشر", // 12
  ];
  return generationNames[generation - 1] || `الجيل ${generation}`;
};

// Profile match card component - matching SearchBar UI
const ProfileMatchCard = ({ profile, isSelected, onPress, index }) => {
  // Use rotating colors from desert palette
  const avatarColor = DESERT_PALETTE[index % DESERT_PALETTE.length];
  const initials = getInitials(profile.name);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
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
            {profile.full_chain || profile.name}
          </Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.generationText, { color: avatarColor }]}>
              {getGenerationName(profile.generation || 1)}
            </Text>
            {profile.has_auth && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.linkedText}>مطالب به</Text>
              </>
            )}
          </View>
        </View>

        {/* Match score badge */}
        <View style={styles.scoreContainer}>
          <View
            style={[styles.scoreBadge, { backgroundColor: avatarColor + "20" }]}
          >
            <Text style={[styles.scoreText, { color: avatarColor }]}>
              {profile.match_score}%
            </Text>
          </View>
          {/* Fixed height container prevents jumping */}
          <View style={styles.checkContainer}>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={20} color={avatarColor} />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function ProfileMatchingScreen({ navigation, route }) {
  const { profiles = [], nameChain, user } = route.params;
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelectProfile = useCallback((profile) => {
    setSelectedProfile(profile);
  }, []);

  const handleConfirmProfile = async () => {
    if (!selectedProfile) {
      Alert.alert("تنبيه", "يرجى اختيار ملفك الشخصي أولاً");
      return;
    }

    setSubmitting(true);
    const result = await phoneAuthService.submitProfileLinkRequest(
      selectedProfile.id,
      nameChain,
    );

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.temporary) {
        Alert.alert("تم الربط", "تم ربط ملفك الشخصي بنجاح!", [
          { text: "موافق", onPress: () => navigation.replace("Main") },
        ]);
      } else {
        Alert.alert("تم إرسال الطلب", result.message, [
          { text: "موافق", onPress: () => navigation.replace("Main") },
        ]);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", result.error);
    }

    setSubmitting(false);
  };

  const handleContactAdmin = () => {
    navigation.navigate("ContactAdmin", { user, nameChain });
  };

  const renderProfile = ({ item, index }) => (
    <ProfileMatchCard
      profile={item}
      isSelected={selectedProfile?.id === item.id}
      onPress={() => handleSelectProfile(item)}
      index={index}
    />
  );

  // Empty state
  if (profiles.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header with progress dots - matching NameChainEntryScreen */}
        <View style={styles.header}>
          {/* Progress Dots - Step 4 of 5 */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
          </View>

          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.title}>لا توجد نتائج</Text>
          <Text style={styles.subtitle}>
            لم نتمكن من العثور على ملفات مطابقة
          </Text>

          <View style={styles.searchDisplay}>
            <Text style={styles.searchLabel}>تم البحث عن</Text>
            <Text style={styles.searchQuery}>{nameChain}</Text>
          </View>

          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <TouchableOpacity
              style={styles.contactAdminButton}
              onPress={handleContactAdmin}
            >
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.contactAdminText}>تواصل مع المشرف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with progress dots - matching NameChainEntryScreen */}
      <View style={styles.header}>
        {/* Progress Dots - Step 4 of 5 */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>

        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Main Content - matching NameChainEntryScreen exactly */}
      <View style={styles.mainContent}>
        <Text style={styles.title}>اختر ملفك الشخصي</Text>
        <Text style={styles.subtitle}>اضغط على الملف الذي يمثلك في الشجرة</Text>

        {/* Search Query Display */}
        <View style={styles.searchDisplay}>
          <Text style={styles.searchLabel}>البحث عن</Text>
          <Text style={styles.searchQuery}>{nameChain}</Text>
          <Text style={styles.resultsCount}>
            عدد النتائج: {profiles.length}
          </Text>
        </View>
      </View>

      {/* Results List */}
      <FlatList
        data={profiles}
        renderItem={renderProfile}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedProfile && styles.confirmButtonDisabled,
            submitting && styles.buttonLoading,
          ]}
          onPress={handleConfirmProfile}
          disabled={!selectedProfile || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>تأكيد الاختيار</Text>
              <Ionicons name="checkmark-circle" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.notFoundButton}
          onPress={handleContactAdmin}
        >
          <Text style={styles.notFoundButtonText}>لم أجد ملفي</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header - EXACT MATCH with NameChainEntryScreen
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inputBorder, // Container 40%
  },
  progressDotCompleted: {
    backgroundColor: "#4CAF50", // Green for completed steps
  },
  progressDotActive: {
    backgroundColor: colors.primary, // Najdi Crimson
    width: 24, // Elongated dot for active step
  },

  // Main content - EXACT MATCH with NameChainEntryScreen
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "left", // Native RTL will flip this to right
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    textAlign: "left", // Native RTL will flip this to right
    marginBottom: 24,
  },

  // Search display - matching input style
  searchDisplay: {
    backgroundColor: colors.inputBg,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginBottom: 4,
  },
  searchQuery: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: 8,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#24212199",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  // Result card styles - matching SearchBar
  resultCard: {
    backgroundColor: "#D1BBA310",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  resultCardPressed: {
    backgroundColor: "#D1BBA320",
    transform: [{ scale: 0.99 }],
  },
  resultCardSelected: {
    backgroundColor: "#A1333310",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },

  // Avatar styles
  avatarContainer: {
    marginRight: 12,
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1BBA320",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: "400",
    color: "#F9F7F3",
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
  },

  // Text content
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  generationText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  metaSeparator: {
    fontSize: 12,
    color: "#24212140",
    marginHorizontal: 6,
  },
  linkedText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#F59E0B",
  },

  // Score badge
  scoreContainer: {
    alignItems: "center",
    gap: 4,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
  checkContainer: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  // Bottom actions
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA320",
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.container,
    opacity: 0.5,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  confirmButtonText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  notFoundButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  notFoundButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },

  // Contact admin button
  contactAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  contactAdminText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.primary,
  },
});
