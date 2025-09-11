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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
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
  const resultsTranslateY = useRef(new Animated.Value(-10)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;

  // Create a local shared value for opacity that always exists
  // This ensures the SearchBar is visible even before profileSheetProgress is initialized
  const searchBarOpacity = useSharedValue(1);

  // Update opacity based on profile sheet progress
  useAnimatedReaction(
    () => {
      if (!profileSheetProgress) {
        return 1; // Fully visible when no sheet tracker exists
      }

      // Start fading when sheet is 30% open, fully fade at 70% open
      const fadeStart = 0.3;
      const fadeEnd = 0.7;

      if (profileSheetProgress.value > fadeStart) {
        const fadeProgress =
          (profileSheetProgress.value - fadeStart) / (fadeEnd - fadeStart);
        return Math.max(0, 1 - fadeProgress);
      }
      return 1;
    },
    (targetOpacity) => {
      searchBarOpacity.value = withTiming(targetOpacity, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
    },
    [profileSheetProgress],
  );

  // Animated style that always uses our local shared value
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: searchBarOpacity.value,
    };
  });

  // Get user info on mount
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Get user profile for photo
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile(profile);
      }
    };
    getUser();
  }, []);

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
            // Animate results in
            Animated.parallel([
              Animated.timing(resultsOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.spring(resultsTranslateY, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
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
    [resultsOpacity, resultsTranslateY],
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
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(resultsOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowResults(false);
      resultsTranslateY.setValue(-10);
    });
  };

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

    // Premium desert/sepia colors for Arabian aesthetic
    const getDesertColor = (name) => {
      const desertPalette = [
        "#C19A6B", // Desert Sand
        "#A0826D", // Tan
        "#966F33", // Wood Brown
        "#8B7355", // Dark Tan
        "#704214", // Sepia Brown
        "#826644", // Raw Umber
        "#8B7D6B", // Bisque
        "#79443B", // Rustic Brown
      ];
      const index = name ? name.charCodeAt(0) % desertPalette.length : 0;
      return desertPalette[index];
    };

    const desertColor = getDesertColor(item.name);

    return (
      <Pressable
        onPress={() => handleSelectResult(item)}
        style={({ pressed }) => [
          styles.elegantCard,
          {
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.elegantContent}>
          {/* Clean text hierarchy - RTL layout */}
          <View style={styles.textSection}>
            <Text style={styles.nameChain} numberOfLines={2}>
              {item.name_chain || item.name || "بدون اسم"}
            </Text>
            <Text style={styles.generation}>
              الجيل {toArabicNumerals(item.generation?.toString() || "0")}
            </Text>
          </View>

          {/* Circular photo on the right for RTL */}
          <View style={styles.avatarSection}>
            {item.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={styles.circularPhoto}
                defaultSource={require("../../assets/icon.png")}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: desertColor },
                ]}
              >
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            )}
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
      {/* Animated Backdrop */}
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

      <Reanimated.View style={[styles.container, style, animatedStyle]}>
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
                transform: [{ translateY: resultsTranslateY }],
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
      </Reanimated.View>
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
  resultsContainer: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16, // More rounded like Google Maps
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: 400,
    overflow: "hidden",
  },
  resultsList: {
    maxHeight: 400,
  },
  resultsContent: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  // Ultra-elegant minimal card
  elegantCard: {
    marginHorizontal: 8,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    // Premium subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  elegantContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    minHeight: 72,
  },
  textSection: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12, // Space from right edge
  },
  nameChain: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Roboto",
    color: "#1A1A1A",
    marginBottom: 3,
    lineHeight: 21,
    textAlign: "right", // RTL alignment
  },
  generation: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Roboto",
    color: "#7A7A7A",
    fontWeight: "400",
    textAlign: "right", // RTL alignment
  },
  avatarSection: {
    marginLeft: 12, // Photo on the left in RTL
  },
  circularPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24, // Perfect circle
    backgroundColor: "#F8F9FA",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24, // Perfect circle
    alignItems: "center",
    justifyContent: "center",
    // Desert color set dynamically
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Roboto",
  },
};

export default SearchBar;
