import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";
import BranchTreeModal from "../../components/BranchTreeModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { getProfileDisplayName } from "../../utils/nameChainBuilder";

// Najdi Sadu Color System
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#242121CC", // Sadu Night 80%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  inputBg: "rgba(209, 187, 163, 0.1)", // Container 10%
  inputBorder: "rgba(209, 187, 163, 0.4)", // Container 40%
  inputFocusBorder: "#A13333", // Primary
  textHint: "rgba(36, 33, 33, 0.4)", // Text 40%
  success: "#22C55E",
  warning: "#D58C4A",
  error: "#EF4444",
};

// Desert palette for avatars
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
  ];
  return generationNames[generation - 1] || `الجيل ${generation}`;
};

// Profile match card component
const ProfileMatchCard = ({ profile, isSelected, onPress, index }) => {
  const avatarColor = DESERT_PALETTE[index % DESERT_PALETTE.length];
  const initials = getInitials(profile.name);

  // Match confidence colors
  const getConfidenceColor = (score) => {
    if (score >= 80) return "#22C55E"; // Green
    if (score >= 60) return "#D58C4A"; // Orange
    return "#EF4444"; // Red
  };

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
                <View style={styles.claimedDot} />
                <Text style={styles.claimedText}>مطالب به</Text>
              </>
            )}
          </View>
          {/* Match confidence bar */}
          <View style={styles.confidenceContainer}>
            <View style={styles.confidenceBarBg}>
              <View
                style={[
                  styles.confidenceBar,
                  {
                    width: `${Math.round(profile.match_score)}%`,
                    backgroundColor: getConfidenceColor(profile.match_score),
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Selection indicator */}
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={22} color={avatarColor} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default function ProfileLinkingScreen({ navigation, route }) {
  const { user } = route.params;
  const { checkProfileStatus } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultsAnim = useRef(new Animated.Value(0)).current;
  const exampleOpacity = useRef(new Animated.Value(1)).current;

  // Auto-focus input on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Auto-focus after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    });
  }, []);

  // Get dynamic placeholder based on current input
  const getPlaceholder = () => {
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return "اكتب اسمك الثلاثي هنا...";
    if (words.length === 1) return "أضف اسم والدك...";
    if (words.length === 2) return "أضف اسم جدك...";
    return "اكتب اسمك الثلاثي هنا...";
  };

  // Perform search with debounce
  const performSearch = useCallback(async (searchText) => {
    const trimmed = searchText.trim();

    // Remove family names
    const familyNames = ["القفاري", "الدوسري", "العتيبي", "الشمري", "العنزي"];
    let cleanedName = trimmed;
    familyNames.forEach((family) => {
      cleanedName = cleanedName.replace(family, "").trim();
    });

    if (!cleanedName || cleanedName.split(/\s+/).length < 2) {
      setResults([]);
      Animated.timing(resultsAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    setSearching(true);

    try {
      const result = await phoneAuthService.searchProfilesByNameChain(cleanedName);

      if (result.success && result.profiles.length > 0) {
        setResults(result.profiles);

        // Animate results in
        Animated.timing(resultsAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Hide example text
        Animated.timing(exampleOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        setResults([]);
        Animated.timing(resultsAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    }

    setSearching(false);
  }, [resultsAnim, exampleOpacity]);

  // Handle text change with debounce
  const handleChangeText = useCallback((text) => {
    setQuery(text);

    // Clear previous timer
    if (searchTimer) clearTimeout(searchTimer);

    // If text is cleared, reset
    if (!text) {
      setResults([]);
      Animated.timing(resultsAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(exampleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Debounce search
    const timer = setTimeout(() => {
      performSearch(text);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer, performSearch, resultsAnim, exampleOpacity]);

  // Handle profile selection
  const handleSelectProfile = useCallback((profile) => {
    setSelectedProfile(profile);
    setShowTreeModal(true);
  }, []);

  // Handle confirmation from modal
  const handleConfirmFromModal = useCallback(async (profile) => {
    setShowTreeModal(false);
    setSubmitting(true);

    // Small delay for UI feedback
    await new Promise(resolve => setTimeout(resolve, 300));

    // Submit the link request
    const result = await phoneAuthService.submitProfileLinkRequest(
      profile.id,
      query
    );

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Mark onboarding complete
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');

      // Trigger profile status refresh
      await checkProfileStatus(user);

      Alert.alert(
        "تم إرسال الطلب ✅",
        "تم إرسال طلبك للمراجعة. سيتم إشعارك عند الموافقة على الطلب.",
        [{
          text: "موافق",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "Main" }],
            });
          },
        }],
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", result.error);
      setSelectedProfile(null);
    }

    setSubmitting(false);
  }, [query, user, checkProfileStatus, navigation]);

  // Handle clear button
  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery("");
    setResults([]);
    setSelectedProfile(null);
    inputRef.current?.focus();

    Animated.parallel([
      Animated.timing(resultsAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(exampleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle contact admin
  const handleContactAdmin = () => {
    Alert.alert(
      "هل تحتاج مساعدة؟",
      "تواصل مع المشرف لإضافة ملفك الشخصي إلى الشجرة",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "واتساب",
          onPress: () => {
            Alert.alert("قريباً", "سيتم إضافة رابط واتساب المشرف قريباً");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            {/* Progress Dots */}
            <View style={styles.progressContainer}>
              <View style={styles.progressDot} />
              <View style={[styles.progressDot, styles.progressDotActive]} />
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

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>ابحث عن مكانك في الشجرة</Text>
            <Text style={styles.subtitle}>
              اكتب اسمك الثلاثي عشان نربطك في الشجرة
            </Text>
          </View>

          {/* Example - fades out when results appear */}
          {!results.length && (
            <Animated.View style={[styles.exampleContainer, { opacity: exampleOpacity }]}>
              <View style={styles.exampleCard}>
                <View style={styles.exampleBadge}>
                  <Text style={styles.exampleBadgeText}>مثال</Text>
                </View>
                <Text style={styles.exampleText}>محمد عبدالله سليمان</Text>
              </View>
            </Animated.View>
          )}

          {/* Search Input */}
          <View style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
          ]}>
            <TextInput
              ref={inputRef}
              style={styles.nameInput}
              placeholder={getPlaceholder()}
              placeholderTextColor={colors.textHint}
              value={query}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              returnKeyLabel="بحث"
            />
            {query.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={colors.textHint} />
              </TouchableOpacity>
            )}
          </View>

          {/* Loading indicator */}
          {searching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>جاري البحث...</Text>
            </View>
          )}

          {/* Results */}
          <Animated.View style={[
            styles.resultsContainer,
            {
              opacity: resultsAnim,
              transform: [{
                translateY: resultsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            },
          ]}>
            {results.length > 0 ? (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <ProfileMatchCard
                    profile={item}
                    isSelected={selectedProfile?.id === item.id}
                    onPress={() => handleSelectProfile(item)}
                    index={index}
                  />
                )}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => Keyboard.dismiss()}
              />
            ) : (
              query.length > 0 && !searching && (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={colors.textHint} />
                  <Text style={styles.emptyStateText}>
                    لم نجد نتائج، حاول كتابة الاسم بشكل مختلف
                  </Text>
                  <TouchableOpacity
                    style={styles.helpButton}
                    onPress={handleContactAdmin}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.helpButtonText}>تواصل مع المشرف</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </Animated.View>

          {/* Tree Modal */}
          {showTreeModal && selectedProfile && (
            <BranchTreeModal
              visible={showTreeModal}
              onClose={() => {
                setShowTreeModal(false);
                setSelectedProfile(null);
              }}
              profileId={selectedProfile.id}
              profileName={getProfileDisplayName(selectedProfile)}
              onConfirm={() => handleConfirmFromModal(selectedProfile)}
              confirmText="تأكيد اختيار هذا الملف"
              isLoading={submitting}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
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
    backgroundColor: colors.inputBorder,
  },
  progressDotCompleted: {
    backgroundColor: colors.secondary,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  titleContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "left",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    textAlign: "left",
    lineHeight: 22,
  },
  exampleContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  exampleCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderStyle: "dashed",
    padding: 16,
    position: "relative",
  },
  exampleBadge: {
    position: "absolute",
    top: -10,
    left: 20,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  exampleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
  },
  exampleText: {
    fontSize: 18,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "left",
  },
  inputContainer: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  nameInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.text,
    minHeight: 56,
    writingDirection: "rtl",
    textAlign: "right",
  },
  clearButton: {
    padding: 12,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  resultCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  resultCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFFFFF",
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  generationText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  claimedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },
  claimedText: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: colors.error,
  },
  confidenceContainer: {
    marginTop: 4,
  },
  confidenceBarBg: {
    height: 3,
    backgroundColor: colors.inputBg,
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceBar: {
    height: "100%",
    borderRadius: 2,
  },
  checkmarkContainer: {
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  helpButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.background,
  },
});