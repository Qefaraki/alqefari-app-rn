import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  Alert,
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { profilesService } from "../../services/profiles";
import { familyNameService } from "../../services/familyNameService";
import tokens from "../ui/tokens";

/**
 * SpouseManager - Redesigned with single-input simplicity
 *
 * Flow:
 * 1. User enters full name: "فاطمة بنت محمد العتيبي"
 * 2. System parses surname on submit
 * 3. If Al-Qefari → Search tree first
 * 4. If non-Qefari → Confirm and create munasib
 * 5. Success animation → auto-dismiss
 */

export default function SpouseManager({ visible, person, onClose, onSpouseAdded, prefilledName }) {
  // Simplified 4-state machine (not 7)
  const [stage, setStage] = useState("INPUT"); // INPUT, SEARCH, CREATE, SUCCESS
  const [fullName, setFullName] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSpouse, setSelectedSpouse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Get appropriate gender for spouse
  const spouseGender = person?.gender === "male" ? "female" : "male";
  const spouseTitle = spouseGender === "female" ? "الزوجة" : "الزوج";
  const genderMarker = spouseGender === "female" ? "بنت" : "بن";

  // Reset state when modal opens, or auto-submit if pre-filled
  useEffect(() => {
    if (visible) {
      if (prefilledName) {
        // Pre-filled from inline adder: auto-submit to search
        setFullName(prefilledName);

        // Parse and search immediately (Al-Qefari family members only)
        const parsed = familyNameService.parseFullName(prefilledName.trim(), spouseGender);
        setParsedData(parsed);
        performSearch(parsed);
      } else {
        // Normal flow: start at INPUT
        setStage("INPUT");
        setFullName("");
        setParsedData(null);
        setSearchResults([]);
        setSelectedSpouse(null);
      }
    }
  }, [visible, prefilledName]);

  // Handle name submission with validation and smart detection
  const handleSubmit = async () => {
    // Validate: minimum 2 words (name + surname)
    const words = fullName.trim().split(/\s+/);
    if (words.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الكامل مع اسم العائلة");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Parse name components
    const parsed = familyNameService.parseFullName(fullName.trim(), spouseGender);
    setParsedData(parsed);

    // Branch based on surname
    if (familyNameService.isAlQefariFamily(parsed.familyName)) {
      // Al-Qefari: Always search first (even if no results)
      await performSearch(parsed);
    } else {
      // Non-Qefari: Confirm munasib creation
      confirmMunasibCreation(parsed);
    }
  };

  // Search for Al-Qefari family members
  const performSearch = async (parsed) => {
    setStage("SEARCH");
    setLoading(true);

    try {
      // Build search query from first name only (not full chain)
      const searchQuery = parsed.firstName;

      const { data, error } = await profilesService.searchProfiles(
        searchQuery,
        20,
        0
      );

      if (error) throw error;

      // Filter to:
      // 1. Correct gender
      // 2. Has HID (Al-Qefari only, not munasib)
      // 3. Not current person
      const filtered = (data || [])
        .filter(p => p.gender === spouseGender)
        .filter(p => p.hid !== null) // Only Al-Qefari members
        .filter(p => p.id !== person?.id)
        .slice(0, 8); // Max 8 results

      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("خطأ", "فشل البحث في الشجرة");
      setStage("INPUT");
    } finally {
      setLoading(false);
    }
  };

  // Confirm munasib creation for non-Al-Qefari
  const confirmMunasibCreation = (parsed) => {
    Alert.alert(
      "تأكيد الإضافة",
      `هل تريد إضافة ${parsed.firstName} من عائلة ${parsed.familyName}؟`,
      [
        {
          text: "إلغاء",
          style: "cancel",
          onPress: () => setStage("INPUT"),
        },
        {
          text: "نعم",
          onPress: () => {
            setStage("CREATE");
            createMunasib(parsed);
          },
        },
      ]
    );
  };

  // Handle selecting a search result
  const handleSelectSpouse = (spouse) => {
    setSelectedSpouse(spouse);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Link existing Al-Qefari profile
  const handleLinkSpouse = async () => {
    if (!selectedSpouse) return;

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const husband_id = person.gender === "male" ? person.id : selectedSpouse.id;
      const wife_id = person.gender === "female" ? person.id : selectedSpouse.id;

      // CRITICAL FIX: Cousin marriage handling
      // If selectedSpouse has HID (is Al-Qefari), munasib must be NULL
      // If selectedSpouse has no HID (is munasib), use family_origin
      const munasibValue = selectedSpouse.hid !== null
        ? null  // Al-Qefari member (cousin marriage)
        : (selectedSpouse.family_origin || null);  // Munasib

      const { data, error } = await profilesService.createMarriage({
        husband_id,
        wife_id,
        munasib: munasibValue,
      });

      if (error) throw error;

      // Success!
      setStage("SUCCESS");
      setTimeout(() => {
        if (onSpouseAdded) onSpouseAdded(data);
        onClose();
      }, 1500); // Auto-dismiss after 1.5s
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء إضافة الزواج");
      setSubmitting(false);
    }
  };

  // Create new munasib profile
  const createMunasib = async (parsed) => {
    setSubmitting(true);

    try {
      // Create munasib profile using secure RPC
      const { data: newPerson, error: createError } = await supabase
        .rpc('admin_create_munasib_profile', {
          p_name: fullName.trim(),
          p_gender: spouseGender,
          p_generation: person.generation,
          p_family_origin: parsed.familyOrigin || parsed.familyName,
          p_sibling_order: 0,
          p_status: 'alive',
          p_phone: null,
        });

      if (createError) throw createError;

      // Create marriage
      const husband_id = person.gender === "male" ? person.id : newPerson.id;
      const wife_id = person.gender === "female" ? person.id : newPerson.id;

      const { data: marriage, error: marriageError } =
        await profilesService.createMarriage({
          husband_id,
          wife_id,
          munasib: parsed.familyOrigin || parsed.familyName,
        });

      if (marriageError) throw marriageError;

      // Success!
      setStage("SUCCESS");
      setTimeout(() => {
        if (onSpouseAdded) onSpouseAdded(marriage);
        onClose();
      }, 1500);
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء الإضافة");
      setStage("INPUT");
      setSubmitting(false);
    }
  };

  // Handle "add as new" from empty search results
  const handleAddAsNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "إضافة كشخص جديد",
      `هل تريد إضافة ${parsedData?.firstName} كشخص جديد على الشجرة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "نعم",
          onPress: () => {
            setStage("CREATE");
            createMunasib(parsedData);
          },
        },
      ]
    );
  };

  // Render search result card (ParentProfileCard pattern)
  const renderSearchResult = ({ item }) => {
    const isSelected = selectedSpouse?.id === item.id;
    const initials = item.name ? item.name.split(" ")[0].charAt(0) : "؟";

    return (
      <TouchableOpacity
        style={[styles.resultCard, isSelected && styles.resultCardSelected]}
        onPress={() => handleSelectSpouse(item)}
        activeOpacity={0.85}
      >
        <View style={styles.resultAvatar}>
          {item.photo_url ? (
            <Image
              source={{ uri: item.photo_url }}
              style={styles.resultAvatarImage}
            />
          ) : (
            <View style={styles.resultAvatarFallback}>
              <Text style={styles.resultAvatarInitial}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name}
          </Text>
          {/* Display father name with gender marker ONCE */}
          {item.father_name && (
            <Text style={styles.resultChain} numberOfLines={1}>
              {genderMarker} {item.father_name}
            </Text>
          )}
          {/* Display generation */}
          <Text style={styles.resultGeneration}>
            الجيل {item.generation || "؟"}
          </Text>
        </View>

        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={tokens.colors.najdi.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  // Render INPUT stage
  const renderInputStage = () => (
    <View style={styles.stageContainer}>
      <View style={styles.iconContainer}>
        <Ionicons
          name="moon"
          size={32}
          color={tokens.colors.najdi.secondary}
        />
      </View>

      <Text style={styles.questionText}>ما اسم {spouseTitle} الكاملة؟</Text>

      <TextInput
        style={styles.nameInput}
        placeholder={`مثال: فاطمة ${genderMarker} محمد العتيبي`}
        value={fullName}
        onChangeText={setFullName}
        placeholderTextColor={tokens.colors.najdi.text + "40"}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <Text style={styles.hintText}>
        يجب أن يتضمن الاسم اسم العائلة
      </Text>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[
          styles.primaryButton,
          fullName.trim().length < 3 && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={fullName.trim().length < 3}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>التالي</Text>
        <Ionicons name="arrow-back" size={20} color={tokens.colors.surface} />
      </TouchableOpacity>
    </View>
  );

  // Render SEARCH stage
  const renderSearchStage = () => (
    <View style={styles.stageContainer}>
      <View style={styles.searchHeader}>
        <TouchableOpacity
          onPress={() => setStage("INPUT")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-forward" size={24} color={tokens.colors.najdi.text} />
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.searchTitle}>
        نتائج البحث عن: {parsedData?.firstName}
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
          <Text style={styles.loadingText}>جاري البحث...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="search-outline"
                size={48}
                color={tokens.colors.najdi.textMuted}
              />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
              <Text style={styles.emptyHint}>
                لم نجد {spouseTitle} بهذا الاسم في الشجرة
              </Text>
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={handleAddAsNew}
              >
                <Text style={styles.addNewButtonText}>
                  إضافة كشخص جديد
                </Text>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={tokens.colors.najdi.primary}
                />
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {selectedSpouse && !loading && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleLinkSpouse}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={tokens.colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>ربط الزواج</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render CREATE stage (loading)
  const renderCreateStage = () => (
    <View style={styles.stageContainer}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
        <Text style={styles.loadingText}>جاري الإضافة...</Text>
      </View>
    </View>
  );

  // Render SUCCESS stage
  const renderSuccessStage = () => (
    <View style={styles.stageContainer}>
      <View style={styles.successContainer}>
        <View style={styles.successIconContainer}>
          <Ionicons name="checkmark-circle" size={120} color="#34C759" />
        </View>
        <Text style={styles.successTitle}>تم إضافة {spouseTitle} بنجاح</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
          </TouchableOpacity>
          <Text style={styles.title}>إضافة {spouseTitle}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Person Info */}
        <View style={styles.personInfo}>
          <Text style={styles.personSubtext}>إضافة {spouseTitle} لـ</Text>
          <Text style={styles.personName}>{person?.name}</Text>
        </View>

        {/* Stage Content */}
        {stage === "INPUT" && renderInputStage()}
        {stage === "SEARCH" && renderSearchStage()}
        {stage === "CREATE" && renderCreateStage()}
        {stage === "SUCCESS" && renderSuccessStage()}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.najdi.container + "40",
  },
  closeButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },
  personInfo: {
    alignItems: "center",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.najdi.container + "10",
  },
  personSubtext: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xxs,
  },
  personName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },

  // Stage Container
  stageContainer: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
  },

  // INPUT Stage
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.najdi.secondary + "15",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: tokens.spacing.lg,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
    textAlign: "center",
    marginBottom: tokens.spacing.xl,
  },
  nameInput: {
    backgroundColor: tokens.colors.najdi.container + "20",
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + "40",
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    fontSize: 17,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
    minHeight: 52,
    textAlign: "right",
  },
  hintText: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    textAlign: "center",
    marginTop: tokens.spacing.xs,
  },

  // SEARCH Stage
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },
  searchTitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.md,
  },
  resultsList: {
    paddingBottom: 100,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + "33",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  resultCardSelected: {
    borderColor: tokens.colors.najdi.primary,
    borderWidth: 2,
    backgroundColor: tokens.colors.najdi.primary + "08",
  },
  resultAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + "40",
    overflow: "hidden",
  },
  resultAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
  },
  resultAvatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.najdi.container + "40",
  },
  resultAvatarInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
  },
  resultInfo: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  resultName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },
  resultChain: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
  resultGeneration: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    marginTop: tokens.spacing.md,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.xs,
    textAlign: "center",
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.najdi.primary + "10",
    borderRadius: tokens.radii.sm,
  },
  addNewButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: tokens.colors.najdi.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.md,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successIconContainer: {
    marginBottom: tokens.spacing.xl,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },

  // Footer
  footer: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  primaryButton: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.sm,
    paddingVertical: 14,
    paddingHorizontal: tokens.spacing.xxl,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    shadowColor: tokens.colors.najdi.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: tokens.colors.surface,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
