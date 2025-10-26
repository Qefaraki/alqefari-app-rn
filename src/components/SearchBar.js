import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  Keyboard,
  Animated,
  Platform,
  Image,
  Easing,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAnimatedReaction, runOnJS, runOnUI } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../services/supabase";
import { useTreeStore } from "../stores/useTreeStore";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useNetworkGuard } from "../hooks/useNetworkGuard";
import useDynamicTypography from "../hooks/useDynamicTypography";
import SearchResultCard from "./search/SearchResultCard";
import tokens from "./ui/tokens";

const SearchBar = ({ onSelectResult, onClearHighlight, onNavigate, nodes = [], style }) => {
  const [query, setQuery] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const resultsMaxHeight = Math.min(windowHeight * 0.55, 420);
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const { isOffline } = useNetworkGuard();
  const inputRef = useRef(null);
  const getTypography = useDynamicTypography();
  const fontFamilyBase = Platform.OS === "ios" ? "System" : "Roboto";
  const fontFamilyArabic = Platform.OS === "ios" ? "SF Arabic" : "Roboto";

  // Navigation pills data extraction
  const navigationData = useMemo(() => {
    if (!nodes || nodes.length === 0 || !onNavigate) {
      return { rootNode: null, g2Branches: [], hasData: false };
    }

    // Find root node (generation 1, no father_id)
    const rootNode = nodes.find(n => !n.father_id && n.generation === 1);

    // Find main G2 branches (generation 2 with children, sorted by sibling order)
    const g2Branches = nodes
      .filter(n => n.generation === 2 && (n._hasChildren || hasDescendants(n.id, nodes)))
      .sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0))
      .map(node => ({
        id: node.id,
        name: extractFirstName(node.name),
        fullName: node.name
      }));

    const hasData = rootNode || g2Branches.length > 0;
    return { rootNode, g2Branches, hasData };
  }, [nodes, onNavigate]);

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
  // Note: profileSheetProgress (shared value) not in dependency array.
  // Per Reanimated docs, dependencies only needed without Babel plugin.
  // Worklet tracks .value changes internally.
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
    [],
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
      if (profileSheetProgress) {
        runOnUI(() => {
          'worklet';
          if (profileSheetProgress.value !== 0) {
            profileSheetProgress.value = 0;
          }
        })();
      }
    }
  }, [selectedPersonId]);

  const showBackdrop = useCallback(() => {
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [backdropOpacity]);

  const hideBackdrop = useCallback(() => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.in(Easing.quad),
    }).start();
  }, [backdropOpacity]);

  const hideResults = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(resultsOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(containerScale, {
        toValue: 0.95,
        duration: 150,
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

      // NETWORK CHECK: Show error if offline
      if (isOffline) {
        setResults([]);
        setShowResults(false);
        console.log('Search not available - user is offline');
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

        console.log("🔍 Searching for:", names, "| Min length:", names.length > 0 ? Math.min(...names.map(n => n.length)) : 0);

        // Use search service (uses search_name_chain RPC with partial matching)
        const { data, error } =
          await enhancedSearchService.searchWithFuzzyMatching(names, {
            limit: 20,
          });

        if (error) {
          console.error("❌ Search error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          setResults([]);
          setShowResults(false);
        } else {
          console.log("✅ Search results:", data?.length || 0, "items");
          if (data && data.length > 0) {
            console.log("First result:", {
              name: data[0].name,
              name_chain: data[0].name_chain,
              hasTitle: !!data[0].professional_title
            });
          }
          setResults(data || []);
          if ((data || []).length > 0) {
            setShowResults(true);
            // Apple-style smooth entrance
            Animated.parallel([
              Animated.timing(resultsOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
              }),
              Animated.timing(resultsTranslateY, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
                easing: Easing.out(Easing.quad),
              }),
              Animated.timing(containerScale, {
                toValue: 1,
                duration: 180,
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

  const inputTypography = useMemo(
    () =>
      getTypography("body", {
        fontFamily: fontFamilyBase,
        fontWeight: "400",
      }),
    [getTypography, fontFamilyBase],
  );

  const dynamicInputStyle = useMemo(() => {
    const length = query.trim().length;
    const baseSize = inputTypography.fontSize;
    const ratio =
      inputTypography.fontSize > 0 && inputTypography.lineHeight
        ? inputTypography.lineHeight / inputTypography.fontSize
        : 1.3;

    if (length <= 24) {
      return null;
    }

    if (length > 44) {
      const newSize = Math.max(13, Math.round(baseSize * 0.82));
      return {
        fontSize: newSize,
        lineHeight: Math.round(newSize * ratio),
        letterSpacing: -0.3,
      };
    }

    if (length > 36) {
      const newSize = Math.max(14, Math.round(baseSize * 0.88));
      return {
        fontSize: newSize,
        lineHeight: Math.round(newSize * ratio),
        letterSpacing: -0.25,
      };
    }

    if (length > 28) {
      const newSize = Math.max(15, Math.round(baseSize * 0.94));
      return {
        fontSize: newSize,
        lineHeight: Math.round(newSize * ratio),
        letterSpacing: -0.2,
      };
    }

    return null;
  }, [query, inputTypography]);

  const handleChangeText = useCallback(
    (text) => {
      const sanitizedText = text.replace(/\n/g, " ");
      const trimmed = sanitizedText.trim();

      setQuery(sanitizedText);

      // Animate clear button
      Animated.timing(clearButtonOpacity, {
        toValue: trimmed.length > 0 ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();

      // Clear previous timer
      if (searchTimer) clearTimeout(searchTimer);

      // If text is cleared, hide results immediately
      if (!trimmed) {
        hideResults();
        return;
      }

      // Debounce search
      const timer = setTimeout(() => {
        performSearch(trimmed);
      }, 300);
      setSearchTimer(timer);
    },
    [searchTimer, performSearch, clearButtonOpacity],
  );

  const handleSelectResult = useCallback(
    (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Fill search bar with name chain (search results already have full chain)
      const nameChain = (item.name_chain || item.name || "").replace(/\n/g, " ");
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

  // Navigation pills handler
  const handlePillPress = useCallback((nodeId, nodeName) => {
    if (onNavigate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log('🧭 Navigation pill pressed:', nodeName);
      onNavigate(nodeId);
    }
  }, [onNavigate]);

  const handleFocus = () => {
    setIsFocused(true);
    // Subtle press animation like Google Maps
    Animated.timing(searchBarScale, {
      toValue: 0.97,
      duration: 150,
      useNativeDriver: true,
    }).start();
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
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  // Show backdrop when results appear
  useEffect(() => {
    if (showResults && results.length > 0) {
      showBackdrop();
    } else {
      hideBackdrop();
    }
  }, [showResults, results, showBackdrop, hideBackdrop]);

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
        pointerEvents={showResults && results.length > 0 ? "auto" : "none"}
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

      <View
        pointerEvents="box-none"
        style={[styles.container, { top: insets.top + 16 }, style]}
      >
        <Animated.View
          style={[
            styles.searchBarContainer,
            { transform: [{ scale: searchBarScale }] },
          ]}
        >
          <Animated.View
            style={{
              opacity: searchBarOpacity,
            }}
          >
            <Pressable
              style={styles.searchBar}
              onPress={() => inputRef.current?.focus()}
              accessibilityRole="search"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {/* Family emblem on left (RTL) */}
              <Image
                source={require("../../assets/logo/Alqefari Emblem (Transparent).png")}
                style={styles.familyEmblemLeft}
                resizeMode="contain"
              />

              <TextInput
                ref={inputRef}
                style={[styles.input, inputTypography, dynamicInputStyle]}
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
                multiline={false}
                numberOfLines={1}
                ellipsizeMode="tail"
                allowFontScaling
              />

              {/* Clear button on the right with fade animation */}
              {query.length > 0 && (
                <Animated.View style={{ opacity: clearButtonOpacity }}>
                  <Pressable
                    onPress={handleClear}
                    style={styles.clearButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons
                      name={Platform.OS === "ios" ? "close-circle" : "close-circle"}
                      size={20}
                      color="#24212199"
                    />
                  </Pressable>
                </Animated.View>
              )}
            </Pressable>
          </Animated.View>

          {/* Navigation Pills - Same opacity as SearchBar */}
          {navigationData.hasData && (
            <View style={styles.pillsContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsContent}
                style={styles.pillsScrollView}
              >
                {/* Root Node Pill */}
                {navigationData.rootNode && (
                  <TouchableOpacity
                    style={[styles.pill, styles.rootPill]}
                    onPress={() => handlePillPress(navigationData.rootNode.id, getRootDisplayName(navigationData.rootNode))}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`الانتقال إلى ${navigationData.rootNode.name}`}
                  >
                    <Text style={[styles.pillText, styles.rootPillText]} numberOfLines={1}>
                      {getRootDisplayName(navigationData.rootNode)}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Divider */}
                {navigationData.rootNode && navigationData.g2Branches.length > 0 && (
                  <View style={styles.pillDivider} />
                )}

                {/* G2 Branch Pills */}
                {navigationData.g2Branches.map((branch) => (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.pill, styles.branchPill]}
                    onPress={() => handlePillPress(branch.id, branch.name)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`الانتقال إلى فرع ${branch.fullName}`}
                  >
                    <Text style={[styles.pillText, styles.branchPillText]} numberOfLines={1}>
                      {branch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

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
                maxHeight: resultsMaxHeight,
              },
            ]}
          >
            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContentWrapper}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {results.map((item, index) => (
                <SearchResultCard
                  key={String(item.id ?? index)}
                  item={item}
                  index={index}
                  onPress={handleSelectResult}
                  isLast={index === results.length - 1}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </>
  );
};

// Helper function to get root node display name
const getRootDisplayName = (rootNode) => {
  if (!rootNode || !rootNode.name) return 'الجذر';
  
  // For root node, show the full name including parentheses
  // Example: "سليمان (ابو القفارات)" -> "سليمان (ابو القفارات)"
  return rootNode.name.trim();
};

// Helper function to extract first name from full Arabic name
const extractFirstName = (fullName) => {
  if (!fullName) return '';
  // Split by space and take the first part
  return fullName.trim().split(' ')[0];
};

// Helper function to check if a node has descendants
const hasDescendants = (nodeId, nodes) => {
  return nodes.some(node => 
    node.father_id === nodeId || 
    node.mother_id === nodeId
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.03)", // Lighter scrim behind results
    zIndex: 8,
    elevation: 8,
  },
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    // Remove fixed height to allow expansion for results
    zIndex: 12,
    elevation: 12,
  },
  searchBarContainer: {
    // Subtle unified shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // Pure white for contrast with Al-Jass White background
    borderRadius: 22, // iOS search pill radius for 44pt height
    paddingHorizontal: 16, // iOS standard horizontal padding
    height: 44, // Align with iOS search bar height
    borderWidth: 0,
  },
  familyEmblemLeft: {
    width: 30, // 25% larger emblem for clearer branding
    height: 30,
    marginRight: 8,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    color: "#242121", // Sadu Night
    paddingVertical: 0,
    paddingHorizontal: 4,
    height: "100%",
  },
  clearButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
  },
  // Unified results container - flows from search bar
  resultsContainer: {
    marginTop: 6,
    marginHorizontal: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    paddingTop: 0, // iOS continuous list style
    paddingBottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    // Matching shadow system (slightly lighter)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  resultsScroll: {
    flexGrow: 0,
  },
  resultsContentWrapper: {
    paddingVertical: 4,
  },
  // Navigation Pills styles
  pillsContainer: {
    marginTop: 8,
  },
  pillsScrollView: {
    flexGrow: 0,
  },
  pillsContent: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    backgroundColor: `${tokens.colors.najdi.background}95`, // Semi-transparent Al-Jass White
    borderRadius: 20,
    
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 32,
    
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rootPill: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  branchPill: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    textAlign: 'center',
  },
  rootPillText: {
    color: tokens.colors.surface,
  },
  branchPillText: {
    color: tokens.colors.najdi.text,
  },
  pillDivider: {
    width: 1,
    height: 20,
    backgroundColor: `${tokens.colors.najdi.textMuted}30`,
    marginHorizontal: 4,
  },
});

export default SearchBar;
