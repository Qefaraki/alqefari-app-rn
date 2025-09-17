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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

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
  // Take first character for Arabic names
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
        {/* Avatar on right for RTL */}
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

        {/* Match score badge on left */}
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
        <LinearGradient
          colors={["#F9F7F3", "#FFFFFF"]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#242121" />
          </TouchableOpacity>
          <Text style={styles.title}>نتائج البحث</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search-outline" size={64} color="#D1BBA3" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
          <Text style={styles.emptySubtitle}>
            لم نتمكن من العثور على ملفات مطابقة للاسم:
          </Text>
          <Text style={styles.searchedName}>{nameChain}</Text>

          <TouchableOpacity
            style={styles.contactAdminButton}
            onPress={handleContactAdmin}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#A13333" />
            <Text style={styles.contactAdminText}>تواصل مع المشرف</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F9F7F3", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color="#242121" />
        </TouchableOpacity>
        <Text style={styles.title}>اختر ملفك الشخصي</Text>
      </View>

      {/* Search Query Display */}
      <View style={styles.searchDisplay}>
        <Text style={styles.searchLabel}>البحث عن</Text>
        <Text style={styles.searchQuery}>{nameChain}</Text>
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsCount}>{profiles.length} نتيجة</Text>
          {profiles.length > 0 && (
            <Text style={styles.helpText}>اضغط على الملف الذي يمثلك</Text>
          )}
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
    backgroundColor: "#F9F7F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#F9F7F3",
  },
  backButton: {
    padding: 8,
    marginRight: 8, // Will flip to left in RTL
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121",
    letterSpacing: -0.5,
  },
  searchDisplay: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA320",
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212180",
    marginBottom: 4,
  },
  searchQuery: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
    marginBottom: 8,
  },
  resultsInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#A13333",
  },
  helpText: {
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#24212180",
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
    borderColor: "#A13333",
  },
  cardContent: {
    flexDirection: "row", // Native RTL will handle this
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },

  // Avatar styles
  avatarContainer: {
    marginRight: 12, // Will be flipped to left by native RTL
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
    color: "#242121",
    fontFamily: "SF Arabic",
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row", // Native RTL handles this
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
  metaText: {
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#24212180",
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
    height: 24, // Fixed height prevents jumping
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // Bottom actions
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9F7F3",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA320",
  },
  confirmButton: {
    backgroundColor: "#A13333",
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
    backgroundColor: "#D1BBA3",
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
    color: "#A13333",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#D1BBA320",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#242121CC",
    textAlign: "center",
    marginBottom: 8,
  },
  searchedName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#A13333",
    marginBottom: 32,
  },
  contactAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A13333",
  },
  contactAdminText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#A13333",
  },
});
