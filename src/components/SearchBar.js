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
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing as ReanimatedEasing,
} from "react-native-reanimated";

import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";
import { useTreeStore } from "../stores/useTreeStore";

const SearchBar = ({ onSelectResult, style }) => {
  console.log("SearchBar rendering"); // DEBUG: Verify component mounts
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

  // Single animated style that includes ALL styles (fixes Reanimated init bug)
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";

    // Calculate opacity based on profile sheet progress
    let opacity = 1;

    if (profileSheetProgress?.value !== undefined) {
      const progress = profileSheetProgress.value;
      const fadeStart = 0.3;
      const fadeEnd = 0.7;

      if (progress > fadeStart) {
        const fadeProgress = (progress - fadeStart) / (fadeEnd - fadeStart);
        opacity = Math.max(0, 1 - fadeProgress);
      }
    }

    // Return style object with opacity only
    // Reanimated.View now wraps the Pressable directly
    return {
      opacity: opacity, // Direct value, no animation wrapper
    };
  });

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
        // Split the query by spaces to create name chain
        const names = searchText
          .trim()
          .split(/\s+/)
          .filter((name) => name.length > 0);

        console.log("Searching for:", names);

        const { data, error } = await supabase.rpc("search_name_chain", {
          p_names: names,
          p_limit: 20,
          p_offset: 0,
        });

        if (error) {
          console.error("Search error:", error);
          setResults([]);
          setShowResults(false);
        } else {
          console.log("Search results:", data?.length || 0, "items");
          setResults(data || []);
          if ((data || []).length > 0) {
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
    if (query.length > 0) {
      showBackdrop();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Animate scale back to normal
    Animated.timing(searchBarScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const renderResult = ({ item, index }) => {
    const initials = item.name ? item.name.charAt(0) : "؟";
    const isLast = index === results.length - 1;

    // Premium gradient colors
    const getGradientColors = (name) => {
      const gradients = [
        ["#667EEA", "#764BA2"], // Purple gradient
        ["#F093FB", "#F5576C"], // Pink gradient
        ["#4FACFE", "#00F2FE"], // Blue gradient
        ["#43E97B", "#38F9D7"], // Green gradient
        ["#FA709A", "#FEE140"], // Sunset gradient
        ["#30CED8", "#3E65F2"], // Ocean gradient
        ["#FDC830", "#F37335"], // Orange gradient
        ["#A8E6CF", "#7FD8BE"], // Mint gradient
      ];
      const index = name ? name.charCodeAt(0) % gradients.length : 0;
      return gradients[index];
    };

    const [color1, color2] = getGradientColors(item.name);

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
          {/* Beautiful gradient avatar */}
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
                  styles.avatarGradient,
                  {
                    backgroundColor: color1,
                  },
                ]}
              >
                <Text style={styles.avatarLetter}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarRing, { borderColor: color1 }]} />
          </View>

          {/* Elegant text content */}
          <View style={styles.textContainer}>
            <Text style={styles.nameText} numberOfLines={1}>
              {item.name_chain || item.name || "بدون اسم"}
            </Text>
            <View style={styles.metaContainer}>
              <View
                style={[
                  styles.generationBadge,
                  { backgroundColor: color1 + "15" },
                ]}
              >
                <Text style={[styles.generationText, { color: color1 }]}>
                  الجيل {toArabicNumerals(item.generation?.toString() || "0")}
                </Text>
              </View>
            </View>
          </View>

          {/* Chevron indicator */}
          <View style={styles.chevronContainer}>
            <Text style={styles.chevron}>›</Text>
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
      {/* Backdrop when search is active */}
      {showResults && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={showResults ? "auto" : "none"}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              hideResults();
              Keyboard.dismiss();
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
          <Reanimated.View style={animatedStyle}>
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
          </Reanimated.View>
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 9999,
    elevation: 999,
  },
  container: {
    position: "absolute",
    top: 90, // Moved down to avoid Dynamic Island
    left: 12,
    right: 12,
    height: 48, // Fixed height matching search bar
    backgroundColor: "red", // DEBUG: Temporary to test visibility
    zIndex: 10000,
    elevation: 1000,
  },
  searchBarContainer: {
    height: 48, // Explicit height needed!
    // Google Maps strong shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
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
  // Beautiful results container
  resultsContainer: {
    marginTop: 8,
    backgroundColor: "transparent",
    maxHeight: 440,
    overflow: "hidden",
  },
  resultsList: {
    maxHeight: 440,
    backgroundColor: "transparent",
  },
  resultsContent: {
    paddingVertical: 0,
    paddingHorizontal: 12,
  },
  // Modern card design
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 0,
    marginBottom: 8,
    overflow: "hidden",
    // Beautiful shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  resultCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.12,
  },
  lastCard: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: "row-reverse", // RTL layout
    alignItems: "center",
    padding: 12,
    minHeight: 72,
  },
  // Avatar styling
  avatarContainer: {
    position: "relative",
    marginLeft: 12,
  },
  avatarPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F7",
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor set dynamically
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "SF Pro Display" : "Roboto",
  },
  avatarRing: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 2,
    opacity: 0.2,
    // borderColor set dynamically
  },
  // Text styling
  textContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    alignItems: "flex-end", // RTL alignment
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Pro Display" : "Roboto",
    color: "#1C1C1E",
    marginBottom: 6,
    textAlign: "right",
    letterSpacing: -0.3,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  generationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    // backgroundColor set dynamically with opacity
  },
  generationText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    // color set dynamically
  },
  // Chevron
  chevronContainer: {
    paddingLeft: 8,
  },
  chevron: {
    fontSize: 24,
    color: "#C7C7CC",
    fontWeight: "300",
  },
};

export default SearchBar;
