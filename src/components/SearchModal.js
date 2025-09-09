import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { supabase } from "../services/supabase";
import { toArabicNumerals } from "../utils/dateUtils";

const SearchModal = ({ visible, onClose, onSelectResult }) => {
  // State for progressive name inputs
  const [nameInputs, setNameInputs] = useState([
    { id: Date.now(), value: "", placeholder: "الاسم الأول" },
  ]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTimer, setSearchTimer] = useState(null);

  // Animation values
  const resultScale = useSharedValue(1);

  // Placeholders for progressive inputs
  const placeholders = [
    "الاسم الأول",
    "اسم الأب",
    "اسم الجد",
    "اسم جد الأب",
    "اسم جد الجد",
    "الاسم السادس",
    "الاسم السابع",
    "الاسم الثامن",
    "الاسم التاسع",
    "الاسم العاشر",
  ];

  // Clean input text
  const cleanName = useCallback((text) => {
    // Remove invisible characters and normalize spaces
    return text
      .replace(/[\u200B-\u200F\u202A-\u202E\u00A0]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Update input value
  const updateInput = useCallback(
    (index, text) => {
      const cleaned = cleanName(text);
      const newInputs = [...nameInputs];
      newInputs[index].value = cleaned;

      // Auto-add new input if typing in last field and not at max
      if (
        cleaned &&
        index === nameInputs.length - 1 &&
        nameInputs.length < 10
      ) {
        newInputs.push({
          id: Date.now(),
          value: "",
          placeholder: placeholders[nameInputs.length] || "اسم آخر",
        });
      }

      setNameInputs(newInputs);

      // Trigger search with debounce
      if (searchTimer) clearTimeout(searchTimer);
      const timer = setTimeout(() => {
        performSearch(newInputs);
      }, 500);
      setSearchTimer(timer);
    },
    [nameInputs, searchTimer],
  );

  // Perform search
  const performSearch = useCallback(async (inputs) => {
    // Get non-empty names
    const names = inputs
      .map((input) => input.value)
      .filter((name) => name.length > 0);

    if (names.length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the search function
      const { data, error: searchError } = await supabase.rpc(
        "search_name_chain",
        {
          p_names: names,
          p_limit: 50,
        },
      );

      if (searchError) {
        console.error("Search error:", searchError);
        setError("حدث خطأ في البحث");
        setResults([]);
      } else {
        setResults(data || []);
      }
    } catch (err) {
      console.error("Search exception:", err);
      setError("فشل الاتصال بقاعدة البيانات");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle result selection
  const handleSelectResult = useCallback(
    (item) => {
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Animate selection
      resultScale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      );

      // Close modal and navigate
      setTimeout(() => {
        onSelectResult(item);
        onClose();
      }, 200);
    },
    [onSelectResult, onClose, resultScale],
  );

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setNameInputs([
        { id: Date.now(), value: "", placeholder: "الاسم الأول" },
      ]);
      setResults([]);
      setError(null);
    }
  }, [visible]);

  // Render search result card
  const renderResultCard = ({ item }) => {
    const initials = item.name ? item.name.charAt(0) : "؟";

    return (
      <Pressable onPress={() => handleSelectResult(item)}>
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.resultCard}>
            {/* Photo */}
            <View style={styles.photoContainer}>
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.photo}
                  defaultSource={require("../../assets/icon.png")}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoContainer}>
              <Text style={styles.primaryName}>{item.name}</Text>
              <Text style={styles.nameChain} numberOfLines={2}>
                {item.name_chain}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.generationBadge}>
                  <Text style={styles.generationText}>
                    الجيل {toArabicNumerals(item.generation?.toString() || "0")}
                  </Text>
                </View>
                {item.birth_year_hijri && (
                  <Text style={styles.yearText}>
                    {toArabicNumerals(item.birth_year_hijri.toString())} هـ
                  </Text>
                )}
              </View>
            </View>

            {/* Arrow */}
            <Ionicons name="chevron-forward" size={20} color="#8A8A8E" />
          </View>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </Pressable>
            <Text style={styles.title}>البحث بسلسلة الأسماء</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Instructions */}
          <Text style={styles.instructions}>
            أدخل الأسماء بالترتيب من الأحدث إلى الأقدم
          </Text>

          {/* Progressive Name Inputs */}
          <ScrollView
            style={styles.inputsContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {nameInputs.map((input, index) => (
              <Animated.View
                key={input.id}
                entering={SlideInDown.delay(index * 50)}
                style={styles.inputRow}
              >
                <TextInput
                  style={styles.nameInput}
                  placeholder={input.placeholder}
                  placeholderTextColor="#8A8A8E"
                  value={input.value}
                  onChangeText={(text) => updateInput(index, text)}
                  autoFocus={index === 0 && visible}
                  autoCorrect={false}
                  autoCapitalize="none"
                  textAlign="right"
                />
                {input.value.length > 0 && (
                  <Animated.View entering={FadeIn} style={styles.checkmark}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#34C759"
                    />
                  </Animated.View>
                )}
              </Animated.View>
            ))}
          </ScrollView>

          {/* Results Count */}
          {results.length > 0 && !loading && (
            <Animated.View entering={FadeIn} style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                عدد النتائج: {toArabicNumerals(results.length.toString())}
              </Text>
              {results.length > 20 && (
                <Text style={styles.hint}>
                  أضف المزيد من الأسماء لتضييق النتائج
                </Text>
              )}
            </Animated.View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Results List */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResultCard}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading &&
              nameInputs[0].value && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#8A8A8E" />
                  <Text style={styles.emptyText}>لا توجد نتائج</Text>
                </View>
              )
            }
          />

          {/* Loading Overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>جاري البحث...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
  },
  instructions: {
    fontSize: 14,
    color: "#8A8A8E",
    textAlign: "center",
    paddingVertical: 12,
    fontFamily: "SF Arabic",
  },
  inputsContainer: {
    maxHeight: 200,
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  nameInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#000000",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  checkmark: {
    marginLeft: 8,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
  },
  hint: {
    fontSize: 12,
    color: "#8A8A8E",
    marginTop: 4,
    fontFamily: "SF Arabic",
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  photoContainer: {
    marginRight: 12,
  },
  photo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F2F2F7",
  },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  infoContainer: {
    flex: 1,
  },
  primaryName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#000000",
    marginBottom: 2,
  },
  nameChain: {
    fontSize: 13,
    color: "#8A8A8E",
    fontFamily: "SF Arabic",
    marginBottom: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  generationBadge: {
    backgroundColor: "#007AFF15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  generationText: {
    fontSize: 11,
    color: "#007AFF",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  yearText: {
    fontSize: 11,
    color: "#8A8A8E",
    fontFamily: "SF Arabic",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#8A8A8E",
    marginTop: 12,
    fontFamily: "SF Arabic",
  },
  errorContainer: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "SF Arabic",
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#007AFF",
    fontFamily: "SF Arabic",
  },
};

export default SearchModal;
