import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  Fragment,
} from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import SearchResultCard from "./search/SearchResultCard";

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

  // Render skeleton card while loading
  const renderSkeletonCard = ({ index }) => {
    return (
      <Animated.View
        entering={FadeIn.delay(index * 50)}
        style={styles.modernCard}
      >
        <View style={styles.visualSection}>
          <Animated.View
            style={[
              styles.skeletonAvatar,
              useAnimatedStyle(() => ({
                opacity: withSequence(
                  withTiming(0.3, { duration: 1000 }),
                  withTiming(0.7, { duration: 1000 }),
                  withTiming(0.3, { duration: 1000 }),
                ),
              })),
            ]}
          />
        </View>
        <View style={styles.contentSection}>
          <Animated.View
            style={[
              styles.skeletonLine,
              { width: "60%", height: 18, marginBottom: 6 },
              useAnimatedStyle(() => ({
                opacity: withSequence(
                  withTiming(0.3, { duration: 1000 }),
                  withTiming(0.7, { duration: 1000 }),
                  withTiming(0.3, { duration: 1000 }),
                ),
              })),
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonLine,
              { width: "80%", height: 14, marginBottom: 6 },
              useAnimatedStyle(() => ({
                opacity: withSequence(
                  withTiming(0.3, { duration: 1000 }),
                  withTiming(0.7, { duration: 1000 }),
                  withTiming(0.3, { duration: 1000 }),
                ),
              })),
            ]}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Animated.View
              style={[
                styles.skeletonLine,
                { width: 60, height: 24 },
                useAnimatedStyle(() => ({
                  opacity: withSequence(
                    withTiming(0.3, { duration: 1000 }),
                    withTiming(0.7, { duration: 1000 }),
                    withTiming(0.3, { duration: 1000 }),
                  ),
                })),
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonLine,
                { width: 80, height: 24 },
                useAnimatedStyle(() => ({
                  opacity: withSequence(
                    withTiming(0.3, { duration: 1000 }),
                    withTiming(0.7, { duration: 1000 }),
                    withTiming(0.3, { duration: 1000 }),
                  ),
                })),
              ]}
            />
          </View>
        </View>
      </Animated.View>
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

          {/* Results List with Enhanced UX */}
          <FlatList
            data={loading ? [1, 2, 3] : results}
            keyExtractor={(item) => (loading ? `skeleton-${item}` : item.id)}
            renderItem={
              loading
                ? renderSkeletonCard
                : ({ item, index }) => (
                    <SearchResultCard
                      item={item}
                      index={index}
                      onPress={() => handleSelectResult(item)}
                      showRelevanceScore={true}
                      enableAnimation={true}
                    />
                  )
            }
            contentContainerStyle={styles.modernResultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading &&
              nameInputs[0].value && (
                <View style={styles.modernEmptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="search" size={32} color="#007AFF" />
                  </View>
                  <Text style={styles.emptyTitle}>لم نجد نتائج مطابقة</Text>
                  <Text style={styles.emptySubtitle}>
                    جرب إضافة المزيد من الأسماء أو تعديل البحث
                  </Text>
                </View>
              )
            }
            // Add bounce effect
            bounces={true}
            bouncesZoom={true}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
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
  modernResultsList: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  // Modern empty state
  modernEmptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "SF Arabic",
    textAlign: "center",
    lineHeight: 20,
  },
  // Skeleton loading styles
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E8E8E8",
  },
  skeletonLine: {
    borderRadius: 4,
    backgroundColor: "#E8E8E8",
  },
  // Error styles
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
};

export default SearchModal;
