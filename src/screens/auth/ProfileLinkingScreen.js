import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";
import BranchTreeModal from "../../components/BranchTreeModal";
import ProfileMatchCard from "../../components/ProfileMatchCard";
import DuolingoProgressBar from "../../components/DuolingoProgressBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../contexts/AuthContext";
import * as Haptics from "expo-haptics";

// Color palette - moved outside component
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

// Family names to remove - constant
const FAMILY_NAMES = ["القفاري", "الدوسري", "العتيبي", "الشمري", "العنزي"];

// Family Logo
const AlqefariLogo = require("../../../assets/logo/Alqefari Emblem (Transparent).png");

// Helper function to clean name
const cleanName = (text) => {
  let cleaned = text.trim();
  FAMILY_NAMES.forEach((family) => {
    cleaned = cleaned.replace(family, "").trim();
  });
  return cleaned;
};

// Item height for FlatList optimization
const ITEM_HEIGHT = 88 + 12; // card height + margin

export default function ProfileLinkingScreen({ navigation, route }) {
  const { user } = route.params;
  const { checkProfileStatus } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Use refs for things that don't need re-renders
  const inputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Animation values - stable refs
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid animation
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;
  const animationsRef = useRef([]);

  // Auto-focus input on mount
  useEffect(() => {
    // Skip the fade-in animation to save memory
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    // Cleanup on unmount
    return () => {
      // Stop all animations
      animationsRef.current.forEach(anim => anim?.stop?.());
      animationsRef.current = [];

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Get dynamic placeholder - memoized
  const placeholder = useMemo(() => {
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return "اكتب اسمك الثلاثي هنا...";
    if (words.length === 1) return "أضف اسم والدك...";
    if (words.length === 2) return "أضف اسم جدك...";
    return "اكتب اسمك الثلاثي هنا...";
  }, [query]);

  // Perform search
  const performSearch = async (searchText) => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cleanedName = cleanName(searchText);

    if (!cleanedName || cleanedName.length < 1) {
      setResults([]);
      setIsSearching(false);
      // Skip animation to save memory
      resultsOpacity.setValue(0);
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const result = await phoneAuthService.searchProfilesByNameChain(cleanedName);

      if (result.success) {
        // Limit results to prevent memory issues
        const limitedResults = (result.profiles || []).slice(0, 30); // Further reduce to 30
        setResults(limitedResults);

        // Simple opacity change without animation
        resultsOpacity.setValue(1);
      } else {
        setResults([]);
      }
      setIsSearching(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Search error:", error);
        setResults([]);
        setIsSearching(false);
      }
    }
  };

  // Handle text change
  const handleChangeText = (text) => {
    setQuery(text);

    // Set clear button opacity directly without animation
    clearButtonOpacity.setValue(text.length > 0 ? 1 : 0);

    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    // If text is cleared, reset
    if (!text) {
      setResults([]);
      setIsSearching(false);
      resultsOpacity.setValue(0);
      return;
    }

    // Mark as searching
    setIsSearching(true);

    // Debounce search
    searchTimerRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  // Handle profile selection
  const handleSelectProfile = (profile) => {
    console.log('[DEBUG] Profile selected:', profile.name, profile.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProfile(profile);
    setTimeout(() => {
      setShowTreeModal(true);
      console.log('[DEBUG] showTreeModal set to true');
    }, 100);
  };

  // Handle confirmation from modal
  const handleConfirmFromModal = async (profile) => {
    setShowTreeModal(false);
    setSelectedProfile(profile);
    setSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    const result = await phoneAuthService.submitProfileLinkRequest(
      profile.id,
      query
    );

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
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
  };

  // Handle clear button
  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery("");
    setResults([]);
    setSelectedProfile(null);
    setIsSearching(false);
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

  // Render item for FlatList
  const renderProfile = ({ item, index }) => (
    <ProfileMatchCard
      profile={item}
      isSelected={false}
      onPress={() => handleSelectProfile(item)}
      index={index}
    />
  );

  // Extract key for FlatList
  const keyExtractor = (item) => item.id;

  // Get item layout for optimization
  const getItemLayout = (data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            {/* Family emblem first (appears on right in RTL) */}
            <Image source={AlqefariLogo} style={styles.emblem} resizeMode="contain" />

            {/* Progress bar in middle */}
            <View style={styles.progressBarContainer}>
              <DuolingoProgressBar
                currentStep={3}
                totalSteps={5}
                initialStep={2}
                showStepCount={false}
              />
            </View>

            {/* Back button last (appears on left in RTL) */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Main content */}
          <View style={styles.mainContent}>
            <Text style={styles.title}>اربط حسابك في الشجرة</Text>
            <Text style={styles.subtitle}>
              اكتب اسمك الثلاثي عشان نربطك في الشجرة
            </Text>

            {/* Example - only show when no results and no query */}
            {results.length === 0 && !query.trim() && (
              <View style={styles.exampleContainer}>
                <View style={styles.exampleCard}>
                  <View style={styles.exampleBadge}>
                    <Text style={styles.exampleBadgeText}>مثال</Text>
                  </View>
                  <Text style={styles.exampleText}>محمد عبدالله سليمان</Text>
                </View>
              </View>
            )}

            {/* Search Input */}
            <View style={styles.searchBarContainer}>
              <View style={[
                styles.searchBar,
                isFocused && styles.searchBarFocused,
              ]}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder={placeholder}
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

                {query.length > 0 && (
                  <Pressable onPress={handleClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#24212199" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Results */}
            {results.length > 0 && (
              <View style={styles.resultsSection}>
                <FlatList
                  data={results}
                  keyExtractor={keyExtractor}
                  renderItem={renderProfile}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => Keyboard.dismiss()}
                  getItemLayout={getItemLayout}
                  windowSize={5}
                  initialNumToRender={5}
                  maxToRenderPerBatch={5}
                  removeClippedSubviews={true}
                  updateCellsBatchingPeriod={100}
                />
              </View>
            )}

            {/* Empty state */}
            {results.length === 0 && query.trim().length > 0 && !isSearching && (
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
        </View>
      </KeyboardAvoidingView>

      {/* Tree Modal - moved outside main content */}
      {selectedProfile && showTreeModal && (
        <>
          {console.log('[DEBUG] Rendering BranchTreeModal with:', {
            profile: selectedProfile,
            visible: showTreeModal
          })}
          <BranchTreeModal
            visible={true}
            onClose={() => {
              console.log('[DEBUG] Closing tree modal');
              setShowTreeModal(false);
              setSelectedProfile(null);
            }}
            profile={selectedProfile}
            onConfirm={() => handleConfirmFromModal(selectedProfile)}
          />
        </>
      )}
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  progressBarContainer: {
    flex: 1,
    marginEnd: 12, // margin-right in LTR, margin-left in RTL
  },
  backButton: {
    padding: 8,
  },
  emblem: {
    width: 44,
    height: 44,
    opacity: 1,
    tintColor: "#242121", // Sadu Night black like NewsScreen
    marginTop: -2, // Push down a bit (was -5)
    marginStart: -8, // Negative margin on the left (appears right in RTL)
    marginEnd: 4, // Small positive margin on the right (appears left in RTL)
  },

  // Main content
  mainContent: {
    flex: 1,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "left",
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: -4, // Push up a few pixels
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "left",
    marginHorizontal: 16,
    marginBottom: 24,
  },

  // Example
  exampleContainer: {
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 24,
  },
  exampleCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  exampleBadge: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  exampleBadgeText: {
    fontSize: 11,
    color: colors.textHint,
    fontWeight: "500",
  },
  exampleText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },

  // Search bar
  searchBarContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
  },
  searchBarFocused: {
    borderColor: colors.inputFocusBorder,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: "100%",
  },
  clearButton: {
    padding: 4,
  },

  // Results
  resultsSection: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textHint,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  contactAdminButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  contactAdminText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "600",
  },
});