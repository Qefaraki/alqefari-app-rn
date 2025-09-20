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
import BranchTreeModal from "../../components/BranchTreeModal";

import * as Haptics from "expo-haptics";
import { getProfileDisplayName } from "../../utils/nameChainBuilder";

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

// Convert generation to Arabic ordinal with "الجيل" prefix
const getGenerationName = (generation) => {
  const generationNames = [
    "الجيل الأول", // 1
    "الجيل الثاني", // 2
    "الجيل الثالث", // 3
    "الجيل الرابع", // 4
    "الجيل الخامس", // 5
    "الجيل السادس", // 6
    "الجيل السابع", // 7
    "الجيل الثامن", // 8
    "الجيل التاسع", // 9
    "الجيل العاشر", // 10
    "الجيل الحادي عشر", // 11
    "الجيل الثاني عشر", // 12
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
            {getProfileDisplayName(profile)}
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
            {/* Match percentage */}
            <Text style={styles.metaSeparator}>•</Text>
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

export default function ProfileMatchingScreen({ navigation, route }) {
  const { profiles = [], nameChain, user } = route.params;
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [treeModalProfile, setTreeModalProfile] = useState(null);

  const handleSelectProfile = useCallback((profile) => {
    // Show tree modal for verification
    setTreeModalProfile(profile);
    setShowTreeModal(true);
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

  const handleConfirmFromModal = useCallback(
    async (profile) => {
      // Close modal immediately for better UX
      setShowTreeModal(false);
      setTreeModalProfile(null);

      // Show selection
      setSelectedProfile(profile);
      setSubmitting(true);

      // Small delay for UI feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Submit the link request
      const result = await phoneAuthService.submitProfileLinkRequest(
        profile.id,
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
        // Clear selection on error so user can try again
        setSelectedProfile(null);
      }

      setSubmitting(false);
    },
    [nameChain, navigation],
  );

  const handleCloseTreeModal = useCallback(() => {
    setShowTreeModal(false);
    setTreeModalProfile(null);
  }, []);

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
          {/* Progress Dots - Step 4 of 5 - Reversed for RTL */}
          <View style={styles.progressContainer}>
            <View style={styles.progressDot} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
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
        {/* Progress Dots - Step 4 of 5 - Reversed for RTL */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
          <View style={[styles.progressDot, styles.progressDotCompleted]} />
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

        {/* Search Query Display with Match Explanation */}
        <View style={styles.searchDisplay}>
          <Text style={styles.searchLabel}>البحث عن</Text>
          <Text style={styles.searchQuery}>{nameChain}</Text>
          <Text style={styles.resultsCount}>
            عدد النتائج: {profiles.length}
          </Text>
        </View>

        {/* Match Explanation Helper */}
        <View style={styles.matchHelper}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.secondary}
          />
          <Text style={styles.matchHelperText}>
            نعرض لك الملفات الأقرب لاسمك بناءً على تطابق الأسماء والجيل
          </Text>
        </View>
      </View>

      {/* Results List - with proper flex to prevent overlap */}
      <View style={styles.listContainer}>
        <FlatList
          data={profiles}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Bottom Actions - Fixed and clear */}
      <View style={styles.bottomActions}>
        {submitting ? (
          <View style={styles.selectedConfirmation}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.selectedText}>
              جاري ربط حسابك بملف {selectedProfile?.name}...
            </Text>
          </View>
        ) : selectedProfile ? (
          <View style={styles.selectedConfirmation}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.selectedText}>
              تم اختيار: {selectedProfile.name}
            </Text>
            <Text style={styles.selectedSubtext}>
              سيتم ربط حسابك بهذا الملف
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.instructionText}>
              اضغط على ملفك الشخصي للتحقق من موقعك في الشجرة
            </Text>

            <TouchableOpacity
              style={styles.notFoundButton}
              onPress={handleContactAdmin}
            >
              <Text style={styles.notFoundButtonText}>
                لم أجد ملفي في القائمة
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Branch Tree Modal for verifying identity */}
      <BranchTreeModal
        visible={showTreeModal}
        profile={treeModalProfile}
        onConfirm={handleConfirmFromModal}
        onClose={handleCloseTreeModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  listContainer: {
    flex: 1, // Take remaining space
    marginBottom: 100, // Space for fixed bottom section
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
    backgroundColor: "#D58C4A", // Desert Ochre - matches our design system
  },
  progressDotActive: {
    backgroundColor: colors.primary, // Najdi Crimson
    width: 24, // Elongated dot for active step
  },

  // Main content - EXACT MATCH with NameChainEntryScreen
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
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
    paddingBottom: 20, // Reduced since container handles margin
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72, // More height to prevent cramping
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
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "left", // Native RTL will flip to right
    lineHeight: 22,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 3,
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

  // Match percentage text
  matchPercentage: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  inlineMatchText: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    marginLeft: 2,
  },
  checkmarkContainer: {
    marginLeft: 8,
    justifyContent: "center",
  },

  // Score badge

  // Bottom actions - fixed height and better shadow
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
    borderTopColor: "#D1BBA340",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
    minHeight: 100,
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

  // New styles for the updated flow
  selectedConfirmation: {
    alignItems: "center",
    paddingVertical: 16,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginTop: 8,
  },
  selectedSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },

  // Match helper tooltip
  matchHelper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary + "10",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.secondary + "20",
  },
  matchHelperText: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.text,
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
});
