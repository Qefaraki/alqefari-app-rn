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
  withTiming,
  Easing as ReanimatedEasing,
} from "react-native-reanimated";

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

    // Return single style object with opacity only
    // CRITICAL: Don't use withTiming here - it breaks initial render!
    // flex: 1 not needed - parent is absolutely positioned
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

    // Ultra-minimal, elegant color palette
    const getSubtleColor = (name) => {
      const elegantPalette = [
        "#6B7280", // Cool Gray
        "#7C3AED", // Modern Purple
        "#2563EB", // Deep Blue
        "#059669", // Emerald
        "#DC2626", // Crimson
        "#EA580C", // Orange
        "#CA8A04", // Amber
        "#0891B2", // Cyan
      ];
      const index = name ? name.charCodeAt(0) % elegantPalette.length : 0;
      return elegantPalette[index];
    };

    const subtleColor = getSubtleColor(item.name);

    return (
      <View key={item.id}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleSelectResult(item);
          }}
          style={({ pressed }) => [
            styles.resultRow,
            pressed && styles.resultRowPressed,
            isLast && styles.lastRow,
          ]}
        >
          <View style={styles.rowContent}>
            {/* Ultra-thin avatar on the left (RTL) */}
            <View style={styles.avatarSection}>
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.avatarImage}
                  defaultSource={require("../../assets/icon.png")}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { borderColor: subtleColor },
                  ]}
                >
                  <Text style={[styles.avatarInitial, { color: subtleColor }]}>
                    {initials}
                  </Text>
                </View>
              )}
            </View>

            {/* Text content - RTL layout with proper alignment */}
            <View style={styles.textSection}>
              <Text style={styles.resultName} numberOfLines={1}>
                {item.name_chain || item.name || "بدون اسم"}
              </Text>
              <Text style={styles.resultMeta}>
                الجيل {toArabicNumerals(item.generation?.toString() || "0")}
              </Text>
            </View>
          </View>
        </Pressable>
        {!isLast && <View style={styles.ultraThinDivider} />}
      </View>
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
        <View style={{ opacity: 1 }}>
          <Animated.View
            style={[
              styles.searchBarContainer,
              { transform: [{ scale: searchBarScale }] },
            ]}
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
    zIndex: 10000,
    elevation: 1000,
  },
  searchBarContainer: {
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
  // Apple-style unified container
  resultsContainer: {
    marginTop: 2, // Minimal gap from search bar
    backgroundColor: "#FFFFFF",
    borderRadius: 20, // Slightly less than search bar
    maxHeight: 400,
    overflow: "hidden",
    // Subtle Apple shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
  },
  resultsList: {
    maxHeight: 400,
    backgroundColor: "transparent",
  },
  resultsContent: {
    paddingVertical: 8,
  },
  // Apple-style row layout
  appleRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "transparent",
    minHeight: 64,
  },
  appleRowPressed: {
    backgroundColor: "#F5F5F7", // Apple's highlight gray
  },
  lastRow: {
    // No special styling for last row
  },
  appleRowContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  appleTextSection: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12,
  },
  appleName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Pro Display" : "Roboto",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  appleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  appleGeneration: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    color: "#8E8E93", // Apple secondary label color
    fontWeight: "400",
  },
  appleSeparator: {
    fontSize: 14,
    color: "#8E8E93",
    marginHorizontal: 6,
  },
  appleYear: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "SF Pro Text" : "Roboto",
    color: "#8E8E93",
    fontWeight: "400",
  },
  appleAvatarSection: {
    marginLeft: 12,
  },
  appleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F2F7",
    // Subtle inner border for definition
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.8)",
  },
  appleAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    // Color set dynamically
  },
  appleInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "SF Pro Display" : "Roboto",
  },
  appleDivider: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginLeft: 72, // Align with text, not avatar
  },
};

export default SearchBar;
