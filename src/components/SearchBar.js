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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";

const SearchBar = ({ onSelectResult, style }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const resultsTranslateY = useRef(new Animated.Value(-10)).current;

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
    [searchTimer, performSearch],
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
    setQuery("");
    setResults([]);
    hideResults();
    inputRef.current?.focus();
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length > 0) {
      showBackdrop();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const renderResult = ({ item }) => {
    const initials = item.name ? item.name.charAt(0) : "؟";

    return (
      <Pressable
        onPress={() => handleSelectResult(item)}
        style={({ pressed }) => [
          styles.resultItem,
          pressed && styles.resultItemPressed,
        ]}
      >
        <View style={styles.resultContent}>
          <View style={styles.resultPhotoPlaceholder}>
            <Text style={styles.resultInitials}>{initials}</Text>
          </View>

          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.name || "بدون اسم"}
            </Text>
            <Text style={styles.resultChain} numberOfLines={2}>
              {item.name_chain || ""}
            </Text>
          </View>

          <View style={styles.resultMeta}>
            <Text style={styles.generationText}>
              ج{toArabicNumerals(item.generation?.toString() || "0")}
            </Text>
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

      <View style={[styles.container, style]}>
        <View
          style={[
            styles.searchBarContainer,
            isFocused && styles.searchBarFocused,
          ]}
        >
          <View style={styles.searchBar}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder=""
              placeholderTextColor="#8A8A8E"
              value={query}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              textAlign="right"
            />

            {/* Clear button on the left */}
            {query.length > 0 ? (
              <Pressable onPress={handleClear} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color="#C7C7CC" />
              </Pressable>
            ) : null}

            {/* Search icon on the right - always gray */}
            <Ionicons
              name="search"
              size={20}
              color="#8A8A8E"
              style={styles.searchIcon}
            />
          </View>
        </View>

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
              showsVerticalScrollIndicator={true}
              style={styles.resultsList}
              contentContainerStyle={styles.resultsContent}
              nestedScrollEnabled={true}
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
    top: 100, // Much higher, near the top
    left: 16,
    right: 16,
    zIndex: 10000,
    elevation: 1000,
  },
  searchBarContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  searchBarFocused: {
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12, // Slightly rounded
    paddingHorizontal: 12,
    height: 42, // Compact height
    borderWidth: 0.5,
    borderColor: "#E5E5EA",
  },
  searchIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#000000",
    paddingVertical: 0,
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  resultsContainer: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 400,
    overflow: "hidden",
  },
  resultsList: {
    maxHeight: 400,
  },
  resultsContent: {
    paddingVertical: 4,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5EA",
  },
  resultItemPressed: {
    backgroundColor: "#F2F2F7",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  resultPhotoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultInitials: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  resultInfo: {
    flex: 1,
    marginHorizontal: 8,
    justifyContent: "center",
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#000000",
    marginBottom: 2,
  },
  resultChain: {
    fontSize: 13,
    color: "#666666",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    lineHeight: 18,
  },
  resultMeta: {
    backgroundColor: "#007AFF15",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  generationText: {
    fontSize: 11,
    color: "#007AFF",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    fontWeight: "600",
  },
};

export default SearchBar;
