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

// EXACT SAME colors from ProfileMatchingScreen
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
};

// EXACT SAME desert palette from ProfileMatchingScreen
const DESERT_PALETTE = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender Haze
  "#736372", // Muted Plum
  "#D1BBA399", // Camel Hair Beige 60%
];

// EXACT SAME helper functions from ProfileMatchingScreen
const getInitials = (name) => {
  if (!name) return "؟";
  const arabicName = name.trim();
  return arabicName.charAt(0);
};

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

// EXACT ProfileMatchCard component from ProfileMatchingScreen
const ProfileMatchCard = ({ profile, isSelected, onPress, index }) => {
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

export default function ProfileLinkingScreen({ navigation, route }) {
  const { user } = route.params;
  const { checkProfileStatus } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if search has run

  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;

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

  // Perform search with debounce - LIKE MAIN SEARCH, works with 1+ characters
  const performSearch = useCallback(async (searchText) => {
    const trimmed = searchText.trim();

    // Remove family names
    const familyNames = ["القفاري", "الدوسري", "العتيبي", "الشمري", "العنزي"];
    let cleanedName = trimmed;
    familyNames.forEach((family) => {
      cleanedName = cleanedName.replace(family, "").trim();
    });

    // Search with ANY input (even 1 letter), like main search
    if (!cleanedName || cleanedName.length < 1) {
      setResults([]);
      Animated.timing(resultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    try {
      const result = await phoneAuthService.searchProfilesByNameChain(cleanedName);

      // Only mark as searched if we have meaningful input (2+ words)
      const wordCount = cleanedName.split(/\s+/).filter(w => w.length > 0).length;
      const shouldMarkSearched = wordCount >= 2;

      if (result.success) {
        setResults(result.profiles || []);
        if (shouldMarkSearched) {
          setHasSearched(true); // Only mark for meaningful searches
        }
        // Animate results in
        Animated.timing(resultsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        setResults([]);
        if (shouldMarkSearched) {
          setHasSearched(true); // Only mark for meaningful searches
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      // Don't mark as searched on error for single letters
    }
  }, [resultsOpacity]);

  // Handle text change with debounce
  const handleChangeText = useCallback((text) => {
    setQuery(text);

    // Animate clear button
    Animated.timing(clearButtonOpacity, {
      toValue: text.length > 0 ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();

    // Clear previous timer
    if (searchTimer) clearTimeout(searchTimer);

    // If text is cleared, reset
    if (!text) {
      setResults([]);
      setHasSearched(false); // Reset search flag
      Animated.timing(resultsOpacity, {
        toValue: 0,
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
  }, [searchTimer, performSearch, clearButtonOpacity, resultsOpacity]);

  // Handle profile selection - DIRECTLY open modal (no tick)
  const handleSelectProfile = useCallback((profile) => {
    // Don't show tick, directly open modal like original behavior
    setSelectedProfile(profile);
    setShowTreeModal(true);
  }, []);

  // Handle confirmation from modal - EXACT same as ProfileMatchingScreen
  const handleConfirmFromModal = useCallback(async (profile) => {
    // Close modal immediately for better UX
    setShowTreeModal(false);

    // Show selection
    setSelectedProfile(profile);
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

      // Request sent for admin approval - mark onboarding complete
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');

      // Trigger profile status refresh to detect pending request
      await checkProfileStatus(user);

      // Show success message
      Alert.alert(
        "تم إرسال الطلب ✅",
        "تم إرسال طلبك للمراجعة. سيتم إشعارك عند الموافقة على الطلب.",
        [{
          text: "موافق",
          onPress: () => {
            // Navigate to main app - user will see pending status
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
      // Clear selection on error so user can try again
      setSelectedProfile(null);
    }

    setSubmitting(false);
  }, [query, user, checkProfileStatus, navigation]);

  // Handle clear button
  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSelectedProfile(null);
    inputRef.current?.focus();
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

  const renderProfile = ({ item, index }) => (
    <ProfileMatchCard
      profile={item}
      isSelected={false} // Never show selection tick
      onPress={() => handleSelectProfile(item)}
      index={index}
    />
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header - EXACT same as ProfileMatchingScreen */}
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

          {/* Main content */}
          <View style={styles.mainContent}>
            <Text style={styles.title}>ابحث عن مكانك في الشجرة</Text>
            <Text style={styles.subtitle}>
              اكتب اسمك الثلاثي عشان نربطك في الشجرة
            </Text>

            {/* Example - only show when no results and haven't searched yet */}
            {results.length === 0 && !hasSearched && (
              <View style={styles.exampleContainer}>
                <View style={styles.exampleCard}>
                  <View style={styles.exampleBadge}>
                    <Text style={styles.exampleBadgeText}>مثال</Text>
                  </View>
                  <Text style={styles.exampleText}>محمد عبدالله سليمان</Text>
                </View>
              </View>
            )}

            {/* Search Input - Similar to main SearchBar but adapted for this context */}
            <View style={styles.searchBarContainer}>
              <View style={[
                styles.searchBar,
                isFocused && styles.searchBarFocused,
              ]}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder={getPlaceholder()}
                  placeholderTextColor="#24212199"
                  value={query}
                  onChangeText={handleChangeText}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                  textAlign="right"
                  writingDirection="rtl"
                />

                {/* Clear button - EXACT same as SearchBar */}
                {query.length > 0 && (
                  <Animated.View style={{ opacity: clearButtonOpacity }}>
                    <Pressable onPress={handleClear} style={styles.clearButton}>
                      <Ionicons name="close-circle" size={20} color="#24212199" />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>

            {/* No loading indicator - seamless experience */}

            {/* Results - More compact without unnecessary labels */}
            {results.length > 0 && (
              <Animated.View style={[styles.resultsSection, { opacity: resultsOpacity }]}>
                {/* Small result count inline */}
                <Text style={styles.resultsCountCompact}>
                  {results.length} نتيجة
                </Text>

                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  renderItem={renderProfile}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => Keyboard.dismiss()}
                />
              </Animated.View>
            )}

            {/* Empty state - only show after a meaningful search with no results */}
            {results.length === 0 && hasSearched && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#24212199" />
                <Text style={styles.emptyText}>
                  لم نجد نتائج، حاول كتابة الاسم بشكل مختلف
                </Text>
                <TouchableOpacity
                  style={styles.contactAdminButton}
                  onPress={handleContactAdmin}
                  activeOpacity={0.7}
                >
                  <Text style={styles.contactAdminText}>تواصل مع المشرف</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tree Modal - EXACT same as ProfileMatchingScreen */}
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

// EXACT styles from ProfileMatchingScreen
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

  // Header - Reduced padding
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 30, // Reduced
    paddingHorizontal: 16,
    paddingBottom: 8, // Reduced
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
    backgroundColor: "#D58C4A",
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },

  // Main content - Reduced top padding
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12, // Reduced from 24
  },
  title: {
    fontSize: 26, // Slightly smaller
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "left",
    marginBottom: 6, // Reduced
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    textAlign: "left",
    marginBottom: 16, // Reduced from 24
  },

  // Example - from NameChainEntryScreen
  exampleContainer: {
    marginBottom: 16, // Reduced for more compact layout
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

  // Search bar - Adapted from main SearchBar
  searchBarContainer: {
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12, // Match example card radius
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  searchBarFocused: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#242121",
    paddingVertical: 0,
    paddingHorizontal: 4,
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },


  // Results section
  resultsSection: {
    flex: 1,
  },

  // Compact results count
  resultsCountCompact: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  listContent: {
    paddingBottom: 20,
    paddingTop: 4, // Small top padding
  },

  // Result card styles - EXACT from ProfileMatchingScreen
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
    minHeight: 72,
  },

  // Avatar styles - EXACT from ProfileMatchingScreen
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

  // Text content - EXACT from ProfileMatchingScreen
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "left",
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
    color: "#F44336",
  },
  matchPercentage: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  checkmarkContainer: {
    marginLeft: 8,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },

  // Contact admin button - EXACT from ProfileMatchingScreen
  contactAdminButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  contactAdminText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.background,
  },
});