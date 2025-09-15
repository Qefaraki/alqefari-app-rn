import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CardSurface from "../ios/CardSurface";
import Button from "../ui/Button";
import profilesService from "../../services/profiles";
import { handleSupabaseError } from "../../services/supabase";
import appConfig from "../../config/appConfig";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const StatusOptions = [
  { id: "married", label: "متزوج" },
  { id: "divorced", label: "مطلق" },
  { id: "widowed", label: "أرمل" },
];

export default function MarriageEditor({
  visible,
  onClose,
  person,
  onCreated,
}) {
  // Mode: 'create' for new spouse, 'link' for existing
  const [mode, setMode] = useState("create");

  // Search/Link mode states
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedSpouse, setSelectedSpouse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Create mode states
  const [spouseName, setSpouseName] = useState("");
  const [parsedName, setParsedName] = useState({
    firstName: "",
    middleChain: [],
    familyName: "",
  });

  // Family suggestion states
  const [showFamilySuggestion, setShowFamilySuggestion] = useState(false);
  const [suggestedSearchName, setSuggestedSearchName] = useState("");
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confirmationOpacity = useRef(new Animated.Value(0)).current;
  const suggestionAnim = useRef(new Animated.Value(0)).current;

  // Auto-determine spouse gender (opposite of person's gender)
  const spouseGender = useMemo(
    () => (person?.gender === "male" ? "female" : "male"),
    [person?.gender],
  );

  // Dynamic labels based on person's gender
  const modalTitle = useMemo(() => {
    if (!person) return "";
    return person.gender === "male"
      ? `إضافة زوجة لـ ${person.name}`
      : `إضافة زوج لـ ${person.name}`;
  }, [person]);

  const inputLabel = "الاسم الثلاثي";

  const spouseTitle = useMemo(
    () => (person?.gender === "male" ? "الزوجة" : "الزوج"),
    [person?.gender],
  );

  // Helper to get user-friendly error messages
  const getUserFriendlyError = (error) => {
    const errorMessage = error?.message || error;

    // Map technical errors to Arabic
    if (
      errorMessage?.includes("PCRST202") ||
      errorMessage?.includes("duplicate")
    ) {
      return "هذا الشخص موجود بالفعل في شجرة العائلة";
    }
    if (errorMessage?.includes("network") || errorMessage?.includes("fetch")) {
      return "تأكد من اتصال الإنترنت وحاول مرة أخرى";
    }
    if (errorMessage?.includes("23505")) {
      return "هذا الزواج مسجل مسبقاً";
    }

    // Use handleSupabaseError for other codes
    return handleSupabaseError(error) || "حدث خطأ. حاول مرة أخرى";
  };

  const parseName = useCallback((fullName) => {
    const trimmed = fullName?.trim() || "";
    if (!trimmed) return null;

    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 2) return null;

    return {
      firstName: words[0],
      middleChain: words.slice(1, -1),
      familyName: words[words.length - 1],
    };
  }, []);

  const formatDisplayName = useCallback(() => {
    if (!parsedName.firstName || !parsedName.familyName) return "";

    const { firstName, middleChain, familyName } = parsedName;
    const genderPrefix = spouseGender === "male" ? "بن" : "بنت";

    // Build the name with proper Arabic formatting
    let displayName = firstName;
    if (middleChain.length > 0) {
      displayName += ` ${genderPrefix} ${middleChain.join(" ")}`;
    }

    // Always show family name in the format "من عائلة X"
    displayName += ` من عائلة ${familyName}`;

    return displayName;
  }, [parsedName, spouseGender]);

  useEffect(() => {
    if (visible) {
      // reset on open
      setMode("create");
      setQuery("");
      setResults([]);
      setSelectedSpouse(null);
      setSpouseName("");
      setParsedName({
        firstName: "",
        middleChain: [],
        familyName: "",
      });
      setShowFamilySuggestion(false);
      setSuggestionDismissed(false);
      setSuggestedSearchName("");

      // Remove animation since Modal handles slide
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    } else {
      // Remove animation since Modal handles slide
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      confirmationOpacity.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim, confirmationOpacity]);

  const handleNameChange = useCallback(
    (input) => {
      setSpouseName(input);
      const parsed = parseName(input);

      if (parsed) {
        setParsedName(parsed);
        Animated.timing(confirmationOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();

        // Check if this is a family member name
        if (
          appConfig.family.enableSmartDetection &&
          !suggestionDismissed &&
          parsed.familyName &&
          parsed.firstName &&
          appConfig.family.familyNameVariations.some(
            (variant) =>
              parsed.familyName.toLowerCase() === variant.toLowerCase(),
          )
        ) {
          setSuggestedSearchName(input);
          setShowFamilySuggestion(true);
          Animated.spring(suggestionAnim, {
            toValue: 1,
            tension: 50,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      } else {
        setParsedName({
          firstName: "",
          middleChain: [],
          familyName: "",
        });
        Animated.timing(confirmationOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
    },
    [parseName, confirmationOpacity, suggestionDismissed, suggestionAnim],
  );

  const performSearch = useCallback(
    async (text) => {
      const q = text?.trim();
      if (!q || q.length < appConfig.search.minSearchLength) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await profilesService.searchProfiles(
          q,
          appConfig.search.maxResults,
          0,
        );
        if (error) throw new Error(error);
        const filtered = (data || [])
          .filter((p) => p.id !== person.id)
          .filter((p) => p.gender === spouseGender);
        setResults(filtered);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [person?.id, spouseGender],
  );

  useEffect(() => {
    if (mode === "link") {
      const t = setTimeout(
        () => performSearch(query),
        appConfig.search.debounceDelay,
      );
      return () => clearTimeout(t);
    }
  }, [query, performSearch, mode]);

  const handleCreateNewSpouse = async () => {
    if (!parsedName.firstName || !parsedName.familyName) {
      Alert.alert("تنبيه", "يرجى كتابة الاسم الكامل");
      return;
    }

    setSubmitting(true);
    try {
      // First, create the new person as Munasib (no HID)
      // Note: Currently the admin_create_profile function auto-generates HID
      // This will need to be handled differently when the database supports nullable HIDs
      const newPersonData = {
        name: spouseName.trim(),
        gender: spouseGender,
        generation: person.generation, // Same generation as spouse
        is_root: false,
        // TODO: Add is_munasib: true when database supports it
        // This flag would prevent HID generation for married-in spouses
      };

      const { data: newPerson, error: createError } =
        await profilesService.createProfile(newPersonData);
      if (createError) throw createError;

      // Then create the marriage
      const husband_id = person.gender === "male" ? person.id : newPerson.id;
      const wife_id = person.gender === "female" ? person.id : newPerson.id;
      const marriagePayload = {
        husband_id,
        wife_id,
      };

      const { data: marriage, error: marriageError } =
        await profilesService.createMarriage(marriagePayload);
      if (marriageError) throw marriageError;

      if (onCreated) onCreated(marriage);
      Alert.alert("نجح", "تم إضافة الزواج بنجاح");
      onClose();
    } catch (e) {
      Alert.alert("خطأ", getUserFriendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!selectedSpouse) {
      Alert.alert("تنبيه", "يرجى اختيار الزوج/الزوجة");
      return;
    }
    setSubmitting(true);
    try {
      const husband_id =
        person.gender === "male" ? person.id : selectedSpouse.id;
      const wife_id =
        person.gender === "female" ? person.id : selectedSpouse.id;
      const payload = {
        husband_id,
        wife_id,
      };
      const { data, error } = await profilesService.createMarriage(payload);
      if (error) throw new Error(error);
      if (onCreated) onCreated(data);
      Alert.alert("نجح", "تم إضافة الزواج بنجاح");
      onClose();
    } catch (e) {
      Alert.alert("خطأ", getUserFriendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const renderCreateMode = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formGroup}>
        <Text style={styles.label}>{inputLabel}</Text>
        <TextInput
          style={styles.input}
          placeholder="مثال: مريم محمد السعوي"
          placeholderTextColor="#999999"
          value={spouseName}
          onChangeText={handleNameChange}
          textAlign="right"
          autoCorrect={false}
          autoCapitalize="words"
        />
        <Text style={styles.helpText}>
          اكتب الاسم الثلاثي: الاسم الأول + اسم الأب + اسم العائلة
        </Text>
      </View>

      {parsedName.firstName && parsedName.familyName && (
        <Animated.View
          style={[
            styles.namePreview,
            {
              opacity: confirmationOpacity,
              transform: [
                {
                  translateY: confirmationOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <CardSurface radius={14} style={styles.previewCard}>
            <View style={styles.previewContent}>
              <View style={styles.previewIcon}>
                <Ionicons name="checkmark-circle" size={22} color="#93C5A9" />
              </View>
              <Text style={styles.previewText}>{formatDisplayName()}</Text>
            </View>
          </CardSurface>
        </Animated.View>
      )}

      {showFamilySuggestion && (
        <Animated.View
          style={[
            styles.suggestionCard,
            {
              opacity: suggestionAnim,
              transform: [
                {
                  translateY: suggestionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: suggestionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <CardSurface radius={14} style={styles.suggestionSurface}>
            <View style={styles.suggestionContent}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="information-circle" size={24} color="#FFCC80" />
                <Text style={styles.suggestionTitle}>
                  هذا الاسم من عائلة {appConfig.family.primaryFamilyName}
                </Text>
              </View>

              <Text style={styles.suggestionText}>
                تحقق أولاً من أنه غير موجود في الشجرة
              </Text>

              <View style={styles.suggestionActions}>
                <TouchableOpacity
                  style={styles.suggestionPrimaryButton}
                  onPress={() => {
                    // Transition to search mode with pre-filled query
                    setMode("link");
                    setQuery(suggestedSearchName);
                    setShowFamilySuggestion(false);
                    Animated.timing(suggestionAnim, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }).start();
                    // Trigger search after transition
                    setTimeout(() => {
                      performSearch(suggestedSearchName);
                    }, 300);
                  }}
                >
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                  <Text style={styles.suggestionPrimaryText}>
                    بحث في الشجرة
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionSecondaryButton}
                  onPress={() => {
                    setShowFamilySuggestion(false);
                    setSuggestionDismissed(true);
                    Animated.timing(suggestionAnim, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }).start();
                  }}
                >
                  <Text style={styles.suggestionSecondaryText}>
                    متابعة الإضافة
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </CardSurface>
        </Animated.View>
      )}
    </ScrollView>
  );

  const renderLinkMode = () => (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <CardSurface radius={12} style={styles.searchBarCard}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={22} color="#666666" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث بالاسم..."
              placeholderTextColor="#999999"
              value={query}
              onChangeText={setQuery}
              textAlign="right"
              returnKeyType="search"
            />
          </View>
        </CardSurface>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#007AFF" />
            <Text style={styles.loadingText}>جارِ البحث...</Text>
          </View>
        ) : results.length === 0 && query.length > 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color="#999999" />
            <Text style={styles.emptyStateText}>لم نجد نتائج</Text>
            <Text style={styles.emptyStateHint}>
              جرب اسماً آخر أو ارجع لإضافة شخص جديد
            </Text>
          </View>
        ) : (
          results.map((p) => {
            const isActive = selectedSpouse?.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.resultRow, isActive && styles.resultRowActive]}
                onPress={() => setSelectedSpouse(p)}
              >
                <CardSurface radius={12} style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.resultContent,
                      isActive && styles.resultContentActive,
                    ]}
                  >
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.resultName,
                          isActive && styles.resultNameActive,
                        ]}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={[
                          styles.resultMeta,
                          isActive && styles.resultMetaActive,
                        ]}
                      >
                        HID: {p.hid}
                      </Text>
                    </View>
                    {isActive && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                </CardSurface>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingTop: 12 }}>
        <TouchableOpacity
          style={styles.backToCreateButton}
          onPress={() => {
            setMode("create");
            setQuery("");
            setResults([]);
            setSelectedSpouse(null);
          }}
        >
          <Ionicons name="arrow-forward" size={20} color="#6B93B5" />
          <Text style={styles.backToCreateText}>العودة للإضافة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {}}
        >
          <Animated.View style={styles.modalContainer}>
            <View style={styles.modal}>
              {/* Modern iOS-style header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <View style={styles.closeButtonCircle}>
                    <Ionicons name="close" size={20} color="#666" />
                  </View>
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{modalTitle}</Text>
                  {mode === "link" && (
                    <Text style={styles.subtitle}>
                      ابحث عن {spouseTitle} في الشجرة
                    </Text>
                  )}
                </View>
                <View style={{ width: 44 }} />
              </View>

              <View style={styles.content}>
                {mode === "create" ? renderCreateMode() : renderLinkMode()}
              </View>

              {/* Modern iOS-style footer */}
              <View style={styles.footer}>
                <Button
                  title={
                    mode === "create"
                      ? parsedName.firstName && parsedName.familyName
                        ? "حفظ"
                        : "اكتب الاسم أولاً"
                      : selectedSpouse
                        ? "ربط الزواج"
                        : "اختر شخصاً أولاً"
                  }
                  onPress={
                    mode === "create"
                      ? handleCreateNewSpouse
                      : handleLinkExisting
                  }
                  loading={submitting}
                  disabled={
                    mode === "create"
                      ? !parsedName.firstName || !parsedName.familyName
                      : !selectedSpouse
                  }
                  style={{ width: "100%" }}
                  variant={
                    (mode === "create" &&
                      parsedName.firstName &&
                      parsedName.familyName) ||
                    (mode === "link" && selectedSpouse)
                      ? "primary"
                      : "secondary"
                  }
                />
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    justifyContent: "flex-end", // Align to bottom for slide animation
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH,
    maxWidth: 600,
    height: SCREEN_HEIGHT * 0.92, // 92% of screen height for better button visibility
    maxHeight: SCREEN_HEIGHT * 0.92,
    alignSelf: "center",
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    height: "100%",
    flex: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 16 : 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.08)",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(120, 120, 128, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "#8E8E93",
    textAlign: "center",
  },
  content: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  scrollContentContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 12,
    textAlign: "right",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 18,
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    minHeight: 60,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  helpText: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 8,
    textAlign: "right",
    lineHeight: 18,
    fontStyle: "normal",
  },
  namePreview: {
    marginBottom: 20,
  },
  previewCard: {
    backgroundColor: "rgba(147, 197, 169, 0.05)",
  },
  previewContent: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(147, 197, 169, 0.15)",
    borderRadius: 18,
  },
  previewText: {
    fontSize: 17,
    color: "#2C3E50",
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
  },
  searchBarCard: {
    backgroundColor: "#FFFFFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    marginLeft: 12,
    color: "#000",
    textAlign: "right",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
  },
  resultRow: {
    marginBottom: 10,
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultContentActive: {
    backgroundColor: "#9CC0D9",
  },
  resultName: {
    fontSize: 18,
    color: "#000",
    fontWeight: "500",
  },
  resultNameActive: {
    color: "#FFFFFF",
  },
  resultMeta: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 4,
  },
  resultMetaActive: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#666666",
    marginTop: 16,
    fontWeight: "500",
  },
  emptyStateHint: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
  },
  backToCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "rgba(156, 192, 217, 0.15)",
    borderRadius: 12,
  },
  backToCreateText: {
    fontSize: 15,
    color: "#6B93B5",
    fontWeight: "500",
  },
  suggestionCard: {
    marginBottom: 20,
    marginTop: 12,
  },
  suggestionSurface: {
    backgroundColor: "rgba(255, 237, 204, 0.9)",
  },
  suggestionContent: {
    padding: 16,
    position: "relative",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  suggestionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "right",
    lineHeight: 20,
  },
  suggestionActions: {
    flexDirection: "row",
    gap: 10,
  },
  suggestionPrimaryButton: {
    flex: 1,
    backgroundColor: "rgba(255, 204, 128, 0.8)",
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  suggestionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  suggestionSecondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255, 204, 128, 0.1)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 204, 128, 0.5)",
  },
  suggestionSecondaryText: {
    color: "#D4A574",
    fontSize: 15,
    fontWeight: "500",
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0, 0, 0, 0.08)",
  },
});
