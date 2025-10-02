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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";
import { useTreeStore } from "../stores/useTreeStore";
import { useAdminMode } from "../contexts/AdminModeContext";

const SearchBar = ({ onSelectResult, onClearHighlight, style }) => {
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
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
  const forceVisibleRef = useRef(false);

  // Bridge function to update regular Animated.Value from worklet
  const updateOpacity = useCallback(
    (value, sheetProgress) => {
      // If force visible is set, ignore all updates and stay visible
      if (forceVisibleRef.current) {
        if (lastOpacity.current !== 1) {
          lastOpacity.current = 1;
          searchBarOpacity.setValue(1);
        }
        return;
      }

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
      // Always call the update function, let it handle the check
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
      lastOpacity.current = 1;
      isFirstMount.current = true; // Reset first mount flag

      // Cancel any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }

      // Force immediate visibility without animation
      searchBarOpacity.setValue(1);

      // Reset the profileSheetProgress immediately if it exists
      if (profileSheetProgress && profileSheetProgress.value !== 0) {
        profileSheetProgress.value = 0;
      }
    }
  }, [selectedPersonId, searchBarOpacity, profileSheetProgress]);

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

      // Fill search bar with name chain (search results already have full chain)
      const nameChain = item.name_chain || item.name || "";
      setQuery(nameChain);

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

    // Clear highlighted ancestry path
    if (onClearHighlight) {
      onClearHighlight();
    }
  }, [onClearHighlight]);

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

      <View style={[styles.container, { top: insets.top + 10 }, style]}>
        <Animated.View
          style={[
            styles.searchBarContainer,
            { transform: [{ scale: searchBarScale }] },
          ]}
        >
          <Animated.View
            style={{
              opacity: isAdminMode && !selectedPersonId ? 1 : searchBarOpacity,
            }}
          >
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
                placeholderTextColor="#24212199"
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
                    <Ionicons name="close-circle" size={20} color="#24212199" />
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
    left: 12,
    right: 12,
    // Remove fixed height to allow expansion for results
    zIndex: 10001,
    elevation: 1001,
  },
  searchBarContainer: {
    // Subtle unified shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // Pure white for contrast with Al-Jass White background
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
    color: "#242121", // Sadu Night
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
    maxHeight: "70%", // Use percentage of screen height instead of fixed pixels
    overflow: "visible", // Allow content to be fully visible
    paddingTop: 12,
    paddingBottom: 0, // Remove container padding, use content padding instead
    // Matching shadow system (slightly lighter)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultsList: {
    flexGrow: 0, // Prevent list from growing unnecessarily
    backgroundColor: "transparent",
  },
  resultsContent: {
    paddingTop: 0,
    paddingBottom: 20, // Increased bottom padding to ensure last item is fully visible
    paddingHorizontal: 12,
  },
  // Clean card design - no borders
  resultCard: {
    backgroundColor: "#D1BBA310", // Camel Hair Beige 10%
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    overflow: "visible", // Allow content to be fully visible
    borderWidth: 0, // No borders, ultra-clean
  },
  resultCardPressed: {
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20% when pressed
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
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
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
    color: "#F9F7F3", // Al-Jass White
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
    color: "#242121", // Sadu Night
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
    backgroundColor: "#D58C4A20", // Desert Ochre 20%
    borderRadius: 4,
  },
  fuzzyBadgeText: {
    fontSize: 11,
    color: "#D58C4A", // Desert Ochre
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  // Minimal chevron - on left edge
  chevronContainer: {
    paddingLeft: 0,
  },
  chevron: {
    fontSize: 18,
    color: "#24212140", // Sadu Night 25%
    fontWeight: "300",
    opacity: 0.5,
  },
};

export default SearchBar;
