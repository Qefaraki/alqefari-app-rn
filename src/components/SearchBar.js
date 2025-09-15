import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  FlatList,
  Pressable,
  Keyboard,
  Animated,
  Platform,
  Image,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";

import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";
import { useTreeStore } from "../stores/useTreeStore";

const SearchBar = ({ onSelectResult, style }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const inputRef = useRef(null);

  // Get profile sheet state from store
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const resultsTranslateY = useRef(new Animated.Value(-20)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;
  const containerScale = useRef(new Animated.Value(0.95)).current;

  // Use regular Animated.Value that starts at 1 (guaranteed visible)
  const searchBarOpacity = useRef(new Animated.Value(1)).current;

  // Track if this is the first mount to avoid initial fade (fixes opacity: 0 bug)
  const isFirstMount = useRef(true);
  const lastOpacity = useRef(1);
  const animationRef = useRef(null);

  // Bridge function to update regular Animated.Value from worklet
  const updateOpacity = useCallback(
    (value, sheetProgress) => {
      // CRITICAL FIX: Never trust opacity 0 unless sheet is actually open
      // This prevents false triggers from re-initialization or bridge timeouts
      if (value === 0 || value < 0.1) {
        // Only apply opacity 0 if ProfileSheet is actually past fade threshold
        if (!sheetProgress || sheetProgress < 0.3) {
          // Sheet is closed, this is a false trigger - keep SearchBar visible
          if (lastOpacity.current !== 1) {
            value = 1; // Force to visible
          } else {
            return; // Already visible, skip update
          }
        }
      }

      // Skip the first update if it's trying to set opacity to 0
      if (isFirstMount.current && value < 0.5) {
        isFirstMount.current = false;
        return;
      }
      isFirstMount.current = false;

      // Only update if value changed significantly (reduce stuttering)
      const roundedValue = Math.round(value * 100) / 100;
      if (Math.abs(roundedValue - lastOpacity.current) < 0.01) {
        return;
      }

      lastOpacity.current = roundedValue;

      // Cancel any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      // Start new animation
      animationRef.current = Animated.timing(searchBarOpacity, {
        toValue: roundedValue,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      });

      animationRef.current.start();
    },
    [searchBarOpacity],
  );

  // Use animated reaction to watch profileSheetProgress and update opacity
  useAnimatedReaction(
    () => {
      "worklet";
      // Calculate opacity based on profile sheet progress
      let opacity = 1;
      let currentProgress = 0;

      if (profileSheetProgress && profileSheetProgress.value > 0) {
        currentProgress = profileSheetProgress.value;
        const fadeStart = 0.3;
        const fadeEnd = 0.7;

        if (currentProgress > fadeStart) {
          const fadeProgress =
            (currentProgress - fadeStart) / (fadeEnd - fadeStart);
          opacity = Math.max(0, 1 - fadeProgress);
        }
      }

      return { opacity, progress: currentProgress };
    },
    (result) => {
      "worklet";
      // Call the JS function with both opacity and sheet progress
      runOnJS(updateOpacity)(result.opacity, result.progress);
    },
    [profileSheetProgress],
  );

  // CRITICAL FIX: Reset opacity when no person is selected (sheet closed)
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const { isAdminMode } = useAdminMode();

  useEffect(() => {
    if (!selectedPersonId) {
      // No person selected = sheet is closed, FORCE SearchBar visible
      console.log("[SearchBar] No person selected, forcing visible");
      lastOpacity.current = 1;
      isFirstMount.current = true; // Reset first mount flag

      // Cancel any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      // Force immediate visibility
      searchBarOpacity.setValue(1);

      // Also reset the profileSheetProgress if it's stuck
      if (profileSheetProgress && profileSheetProgress.value !== 0) {
        console.log("[SearchBar] Resetting stuck profileSheetProgress");
        profileSheetProgress.value = 0;
      }
    }
  }, [selectedPersonId, searchBarOpacity, profileSheetProgress]);

  // Additional safety: Reset when admin mode changes
  useEffect(() => {
    // When admin mode toggles, ensure SearchBar is visible
    if (!selectedPersonId) {
      console.log("[SearchBar] Admin mode changed, ensuring visible");
      searchBarOpacity.setValue(1);
      lastOpacity.current = 1;
    }
  }, [isAdminMode, selectedPersonId, searchBarOpacity]);

  const showBackdrop = () => {
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideResults = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(resultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(containerScale, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start(() => {
      setShowResults(false);
      resultsTranslateY.setValue(-20);
      containerScale.setValue(0.95);
    });
  };

  const performSearch = useCallback(
    async (searchText) => {
      if (!searchText || searchText.length < 1) {
        setResults([]);
        setShowResults(false);
        return;
      }

      try {
        // Import enhanced search service
        const enhancedSearchService =
          require("../services/enhancedSearchService").default;

        // Split the query by spaces to create name chain
        const names = searchText
          .trim()
          .split(/\s+/)
          .filter((name) => name.length > 0);

        console.log("Searching for:", names);

        // Use enhanced search with fuzzy matching
        const { data, error } =
          await enhancedSearchService.searchWithFuzzyMatching(names, {
            limit: 20,
            fuzzyThreshold: 0.7,
            includePartialMatches: true,
          });

        if (error) {
          console.error("Search error:", error);
          setResults([]);
          setShowResults(false);
        } else {
          console.log("Search results:", data?.length || 0, "items");
          // Add match type indicator to results
          const enhancedResults = (data || []).map((result) => ({
            ...result,
            isFuzzyMatch: result.matchType === "fuzzy",
          }));

          setResults(enhancedResults);
          if (enhancedResults.length > 0) {
            setShowResults(true);
            // Apple-style smooth entrance
            Animated.parallel([
              Animated.timing(resultsOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
              }),
              Animated.timing(resultsTranslateY, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
              }),
              Animated.timing(containerScale, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
              }),
            ]).start();
          }
        }
      } catch (err) {
        console.error("Search exception:", err);
        setResults([]);
        setShowResults(false);
      }
    },
    [resultsOpacity, resultsTranslateY, containerScale],
  );

  const handleChangeText = useCallback(
    (text) => {
      setQuery(text);

      // Animate clear button
      Animated.timing(clearButtonOpacity, {
        toValue: text.length > 0 ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();

      // Clear previous timer
      if (searchTimer) clearTimeout(searchTimer);

      // If text is cleared, hide results immediately
      if (!text) {
        hideResults();
        return;
      }

      // Debounce search
      const timer = setTimeout(() => {
        performSearch(text);
      }, 300);
      setSearchTimer(timer);
    },
    [searchTimer, performSearch, clearButtonOpacity],
  );

  const handleSelectResult = useCallback(
    (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery("");
      hideResults();
      Keyboard.dismiss();
      onSelectResult(item);
    },
    [onSelectResult],
  );

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery("");
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    // Subtle press animation like Google Maps
    Animated.timing(searchBarScale, {
      toValue: 0.97,
      duration: 150,
      useNativeDriver: true,
    }).start();
    // Always show backdrop when focused, not just when there's a query
    showBackdrop();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Animate scale back to normal
    Animated.timing(searchBarScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    // Hide backdrop when blur happens
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const renderResult = ({ item, index }) => {
    const initials = item.name ? item.name.charAt(0) : "؟";
    const isLast = index === results.length - 1;

    // Premium desert palette - ultra-thin aesthetic
    const getDesertColor = (index) => {
      const desertPalette = [
        "#C19A6B", // Desert Sand
        "#8B7355", // Sienna Clay
        "#A0826D", // Sandstone
        "#BC9A6A", // Camel
        "#D2B48C", // Tan Dunes
        "#DEB887", // Burlywood
        "#F4A460", // Sandy Brown
        "#CD853F", // Peru Sand
        "#D2691E", // Chocolate Oasis
        "#B8860B", // Dark Goldenrod
      ];
      // Use index to ensure each result has a different color
      return desertPalette[index % desertPalette.length];
    };

    const desertColor = getDesertColor(index);

    return (
      <Pressable
        key={item.id}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handleSelectResult(item);
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
                defaultSource={require("../../assets/icon.png")}
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
                <Text style={styles.avatarLetter}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Text content - RTL aligned to right edge */}
          <View style={styles.textContainer}>
            <Text style={styles.nameText} numberOfLines={1}>
              {item.name_chain || item.name || "بدون اسم"}
            </Text>
            <View style={styles.metaContainer}>
              <Text style={[styles.generationText, { color: desertColor }]}>
                الجيل {toArabicNumerals(item.generation?.toString() || "0")}
              </Text>
            </View>
          </View>

          {/* Chevron indicator on left edge */}
          <View style={styles.chevronContainer}>
            <Text style={styles.chevron}>‹</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // Show backdrop when results appear
  useEffect(() => {
    if (showResults && results.length > 0) {
      showBackdrop();
    }
  }, [showResults, results]);

  // Dismiss results when tapping outside
  useEffect(() => {
    const keyboardHideListener = Keyboard.addListener("keyboardDidHide", () => {
      if (query.length === 0) {
        hideResults();
      }
    });

    return () => {
      keyboardHideListener.remove();
    };
  }, [query]);

  return (
    <>
      {/* Backdrop when search is active or focused */}
      {(showResults || isFocused) && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={showResults || isFocused ? "auto" : "none"}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
              setIsFocused(false);
              Keyboard.dismiss();
              inputRef.current?.blur();
              // Animate backdrop out
              Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }}
          />
        </Animated.View>
      )}

      <View style={[styles.container, style]}>
        <Animated.View
          style={[
            styles.searchBarContainer,
            { transform: [{ scale: searchBarScale }] },
          ]}
        >
          <Animated.View style={{ opacity: searchBarOpacity }}>
            <Pressable
              style={styles.searchBar}
              onPress={() => inputRef.current?.focus()}
            >
              {/* Family emblem on left (RTL) */}
              <Image
                source={require("../../assets/logo/Alqefari Emblem (Transparent).png")}
                style={styles.familyEmblemLeft}
                resizeMode="contain"
              />

              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="البحث في شجرة العائلة"
                placeholderTextColor="#5F6368"
                value={query}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                textAlign="right"
              />

              {/* Clear button on the right with fade animation */}
              {query.length > 0 && (
                <Animated.View style={{ opacity: clearButtonOpacity }}>
                  <Pressable onPress={handleClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#9AA0A6" />
                  </Pressable>
                </Animated.View>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>

        {showResults && results.length > 0 && (
          <Animated.View
            style={[
              styles.resultsContainer,
              {
                opacity: resultsOpacity,
                transform: [
                  { translateY: resultsTranslateY },
                  { scale: containerScale },
                ],
              },
            ]}
          >
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.resultsList}
              contentContainerStyle={styles.resultsContent}
              nestedScrollEnabled={true}
              // Performance optimizations
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          </Animated.View>
        )}
      </View>
    </>
  );
};

const styles = {
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.2)", // Lighter backdrop
    zIndex: 9999,
    elevation: 999,
  },
  container: {
    position: "absolute",
    top: 90, // Moved down to avoid Dynamic Island
    left: 12,
    right: 12,
    height: 48, // Fixed height matching search bar
    zIndex: 10001, // Higher than backdrop
    elevation: 1001,
  },
  searchBarContainer: {
    // Ultra-thin unified shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // Pure white like Google Maps
    borderRadius: 24, // Full pill shape
    paddingHorizontal: 14,
    height: 48, // Google Maps height
    borderWidth: 0,
  },
  familyEmblemLeft: {
    width: 36,
    height: 36,
    marginRight: 10,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#202124", // Google dark gray
    paddingVertical: 0,
    paddingHorizontal: 4,
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Unified results container - flows from search bar
  resultsContainer: {
    marginTop: 4, // Tight connection to search bar
    marginHorizontal: 4, // Slight inset for dropdown effect
    backgroundColor: "#FFFFFF",
    borderRadius: 24, // Match search bar radius
    borderTopLeftRadius: 20, // Slightly softer top
    borderTopRightRadius: 20,
    maxHeight: 460, // Increased max height to prevent cropping
    overflow: "hidden",
    paddingTop: 12,
    paddingBottom: 0, // Remove container padding, use content padding instead
    // Matching shadow system (slightly lighter)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultsList: {
    maxHeight: 420, // Increased to allow full content visibility
    backgroundColor: "transparent",
  },
  resultsContent: {
    paddingTop: 0,
    paddingBottom: 12, // Increased bottom padding to ensure last item is fully visible
    paddingHorizontal: 12,
  },
  // Clean card design - no borders
  resultCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    overflow: "hidden",
    borderWidth: 0, // No borders, ultra-clean
  },
  resultCardPressed: {
    backgroundColor: "#F0F0F0",
    transform: [{ scale: 0.99 }],
  },
  lastCard: {
    marginBottom: 12, // Add extra margin to last card to prevent cropping
  },
  cardContent: {
    flexDirection: "row-reverse", // RTL: avatar on right, chevron on left
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 16,
    minHeight: 60,
  },
  // Refined avatar styling - on right side for RTL
  avatarContainer: {
    marginLeft: 0, // Remove left margin
    marginRight: 0, // Avatar should be flush right
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F7",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor set dynamically
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: "400",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
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
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    color: "#000000",
    marginBottom: 3,
    textAlign: "left", // Changed to left for proper display with row-reverse
    alignSelf: "stretch", // Take full width
    letterSpacing: -0.1,
    writingDirection: "rtl", // Force RTL writing direction
  },
  metaContainer: {
    flexDirection: "row", // Normal row for generation text
    alignItems: "center",
    alignSelf: "flex-start", // Align to start of container
    justifyContent: "flex-start", // Ensure content aligns to start
  },
  generationBadge: {
    paddingHorizontal: 0, // No badge background
    paddingVertical: 0,
    borderRadius: 0,
  },
  generationText: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    letterSpacing: 0,
    opacity: 0.6,
    textAlign: "left", // Changed to left for proper display with row-reverse
    writingDirection: "rtl", // Force RTL writing direction
    // color set dynamically
  },
  fuzzyBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FFF3E0",
    borderRadius: 4,
  },
  fuzzyBadgeText: {
    fontSize: 11,
    color: "#E65100",
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  // Minimal chevron - on left edge
  chevronContainer: {
    paddingLeft: 0,
  },
  chevron: {
    fontSize: 18,
    color: "#C7C7CC",
    fontWeight: "300",
    opacity: 0.5,
  },
};

export default SearchBar;
