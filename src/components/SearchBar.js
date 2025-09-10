import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";

const SearchBar = ({ onSelectResult, style }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const inputRef = useRef(null);

  const performSearch = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);

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
        console.log("First result:", data?.[0]);
        setResults(data || []);
        setShowResults((data || []).length > 0);
        console.log("showResults will be:", (data || []).length > 0);
      }
    } catch (err) {
      console.error("Search exception:", err);
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback(
    (text) => {
      setQuery(text);

      // Clear previous timer
      if (searchTimer) clearTimeout(searchTimer);

      // Debounce search
      const timer = setTimeout(() => {
        performSearch(text);
      }, 300);
      setSearchTimer(timer);
    },
    [searchTimer, performSearch],
  );

  const handleSelectResult = useCallback(
    (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery("");
      setShowResults(false);
      Keyboard.dismiss();
      onSelectResult(item);
    },
    [onSelectResult],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, []);

  const renderResult = ({ item }) => {
    console.log("Rendering item:", item.name);
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

  // Dismiss results when tapping outside
  useEffect(() => {
    const keyboardHideListener = Keyboard.addListener("keyboardDidHide", () => {
      if (query.length === 0) {
        setShowResults(false);
      }
    });

    return () => {
      keyboardHideListener.remove();
    };
  }, [query]);

  return (
    <>
      {/* Backdrop when results are showing */}
      {showResults && (
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setShowResults(false);
            Keyboard.dismiss();
          }}
        />
      )}

      <View style={[styles.container, style]}>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={20}
              color="#8A8A8E"
              style={styles.searchIcon}
            />

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="ابحث بالأسماء... محمد عبدالله سالم"
              placeholderTextColor="#8A8A8E"
              value={query}
              onChangeText={handleChangeText}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              textAlign="right"
            />

            {query.length > 0 && (
              <Pressable onPress={handleClear} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#8A8A8E" />
              </Pressable>
            )}

            {loading && (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={styles.loader}
              />
            )}
          </View>
        </View>

        {showResults && results.length > 0 && (
          <View style={styles.resultsContainer}>
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
          </View>
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
    top: 50, // Move higher up
    left: 12,
    right: 12,
    zIndex: 10000, // Much higher z-index
    elevation: 1000, // For Android
  },
  searchBarContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22, // More rounded for modern look
    paddingHorizontal: 16,
    height: 48, // Slightly taller
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: "SF Arabic",
    color: "#000000",
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  loader: {
    marginLeft: 8,
  },
  resultsContainer: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: 400,
    minHeight: 200, // Ensure minimum height
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  resultsList: {
    maxHeight: 350,
    minHeight: 100,
  },
  resultsContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  resultItemPressed: {
    backgroundColor: "#F2F2F7",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
  },
  resultPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  resultPhotoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultInitials: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  resultInfo: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: "center",
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
    marginBottom: 4,
  },
  resultChain: {
    fontSize: 13,
    color: "#666666",
    fontFamily: "SF Arabic",
    lineHeight: 18,
  },
  resultMeta: {
    backgroundColor: "#007AFF15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  generationText: {
    fontSize: 10,
    color: "#007AFF",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
};

export default SearchBar;
