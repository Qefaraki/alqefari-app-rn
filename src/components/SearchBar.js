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
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";

const SearchBar = ({ onSelectResult, style }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);
  const inputRef = useRef(null);

  const resultsHeight = useSharedValue(0);

  const resultsStyle = useAnimatedStyle(() => ({
    maxHeight: resultsHeight.value,
    opacity: resultsHeight.value > 0 ? 1 : 0,
  }));

  const performSearch = useCallback(
    async (searchText) => {
      if (!searchText || searchText.length < 2) {
        setResults([]);
        setShowResults(false);
        resultsHeight.value = withTiming(0, { duration: 200 });
        return;
      }

      setLoading(true);

      try {
        // Split the query by spaces to create name chain
        const names = searchText
          .trim()
          .split(/\s+/)
          .filter((name) => name.length > 0);

        const { data, error } = await supabase.rpc("search_name_chain", {
          p_names: names,
          p_limit: 10,
        });

        if (error) {
          console.error("Search error:", error);
          setResults([]);
        } else {
          setResults(data || []);
          setShowResults((data || []).length > 0);
          resultsHeight.value = withTiming(
            Math.min(350, (data || []).length * 70 + 10),
            { duration: 200 },
          );
        }
      } catch (err) {
        console.error("Search exception:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [resultsHeight],
  );

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
      resultsHeight.value = withTiming(0, { duration: 200 });
      Keyboard.dismiss();
      onSelectResult(item);
    },
    [onSelectResult, resultsHeight],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    resultsHeight.value = withTiming(0, { duration: 200 });
    inputRef.current?.focus();
  }, [resultsHeight]);

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
          {item.photo_url ? (
            <Image
              source={{ uri: item.photo_url }}
              style={styles.resultPhoto}
              defaultSource={require("../../assets/icon.png")}
            />
          ) : (
            <View style={styles.resultPhotoPlaceholder}>
              <Text style={styles.resultInitials}>{initials}</Text>
            </View>
          )}

          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.resultChain} numberOfLines={1}>
              {item.name_chain}
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
        resultsHeight.value = withTiming(0, { duration: 200 });
      }
    });

    return () => {
      keyboardHideListener.remove();
    };
  }, [query, resultsHeight]);

  return (
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

      <Animated.View style={[styles.resultsContainer, resultsStyle]}>
        {showResults && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = {
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#000000",
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingVertical: 4,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultItemPressed: {
    backgroundColor: "#F2F2F7",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
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
    marginRight: 8,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
    marginBottom: 2,
  },
  resultChain: {
    fontSize: 12,
    color: "#8A8A8E",
    fontFamily: "SF Arabic",
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
