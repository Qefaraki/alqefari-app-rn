import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PropTypes from "prop-types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { profilesService } from "../../services/profiles";
import familyNameService from "../../services/familyNameService";
import { getMunasibValue, validateMarriageProfiles, getMarriageType } from "../../utils/marriageValidation";
import tokens from "../ui/tokens";
import SearchResultCard from "../search/SearchResultCard";
import BranchTreeModal from "../BranchTreeModal";

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

// Helper: Filter out gender markers (بنت, بن) from name chain
const filterGenderMarkers = (nameArray) => {
  const genderMarkers = ['بنت', 'بن'];
  return nameArray.filter(word => !genderMarkers.includes(word));
};

export default function SpouseManager({ visible, person, onClose, onSpouseAdded, prefilledName }) {
  // Simplified 3-state machine
  const [stage, setStage] = useState("SEARCH"); // SEARCH, CREATE, SUCCESS
  const [fullName, setFullName] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSpouse, setSelectedSpouse] = useState(null);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);

  // Get appropriate gender for spouse
  const spouseGender = person?.gender === "male" ? "female" : "male";
  const spouseTitle = spouseGender === "female" ? "زوجة" : "زوج";
  const modalTitle = spouseGender === "female" ? "إضافة زوجة من القفاري" : "إضافة زوج من القفاري";
  const genderMarker = spouseGender === "female" ? "بنت" : "بن";

  // Auto-trigger search when modal opens with prefilledName
  useEffect(() => {
    if (visible && prefilledName) {
      // Parse full name for search
      const parsed = familyNameService.parseFullName(prefilledName.trim(), spouseGender);

      // Display clean name chain: firstName + middle names (no بنت/بن, no surname)
      const cleanNames = [parsed.firstName, ...filterGenderMarkers(parsed.middleChain)];
      setFullName(cleanNames.join(' '));

      setParsedData(parsed);
      performSearch(parsed);
    }
  }, [visible, prefilledName]);

  // Live search with gender & marriage status filtering
  const performLiveSearch = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      const enhancedSearchService = require("../../services/enhancedSearchService").default;

      // Split query for name chain search
      const names = searchText
        .trim()
        .split(/\s+/)
        .filter((name) => name.length > 0);

      // Use search service
      const { data, error } = await enhancedSearchService.searchWithFuzzyMatching(names, {
        limit: 20,
      });

      if (error) {
        console.error("❌ Search error:", error);
        setSearchResults([]);
      } else {
        // Filter results: correct gender + not married + not deleted
        const filtered = (data || []).filter(
          (profile) => profile.gender === spouseGender && !profile.currently_married && !profile.deleted_at
        );
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error("Search exception:", err);
      setSearchResults([]);
    }
  }, [spouseGender]);

  // Debounced search handler (300ms like SearchBar)
  const handleSearchTextChange = useCallback((text) => {
    setFullName(text);

    // Clear previous timer
    if (searchTimer) clearTimeout(searchTimer);

    // If text cleared, clear results immediately
    if (!text || text.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    // Debounce search - wait 300ms after user stops typing
    const timer = setTimeout(() => {
      performLiveSearch(text);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer, performLiveSearch]);

  // Handle SearchBar result selection
  const handleSearchBarSelect = (item) => {
    if (!item) return;

    // Validate selected profile is unmarried and correct gender
    if (item.gender !== spouseGender) {
      Alert.alert("خطأ", `يجب أن يكون ${spouseTitle} من نفس النوع الاجتماعي`);
      return;
    }

    if (item.currently_married) {
      Alert.alert("خطأ", `${item.name_chain} متزوج بالفعل`);
      return;
    }

    // Handle selected spouse
    handleSelectSpouse(item);
  };

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

  // Search for Al-Qefari family members using search_name_chain RPC
  // Gender and person exclusion filtering applied client-side
  const performSearch = async (parsed) => {
    setStage("SEARCH");
    setLoading(true);

    try {
      // Build full name array: firstName + middle names (no gender markers like بنت/بن)
      const cleanNames = [parsed.firstName, ...filterGenderMarkers(parsed.middleChain)];
      const names = cleanNames.filter(n => n.length > 0);

      // Call RPC with correct 3-parameter signature
      // Note: p_gender and p_exclude_id were rolled back in migration 20251025142017
      const { data, error: searchError } = await supabase.rpc('search_name_chain', {
        p_names: names,
        p_limit: 50  // Increased to provide buffer for filtering
      });

      if (searchError) throw searchError;

      // Apply client-side filters:
      // 1. Has HID (Al-Qefari only, not munasib)
      // 2. Correct gender (with null check for safety)
      // 3. Exclude current person (with null check for safety)
      // 4. Limit to 8 results after filtering
      const filtered = (data || [])
        .filter(p => p.hid !== null)                          // Only Al-Qefari members
        .filter(p => p.gender && p.gender === spouseGender)   // Gender filter + null check
        .filter(p => person?.id && p.id !== person.id)        // Exclude current person + null check
        .slice(0, 8);                                         // Limit to 8 results after all filters

      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("خطأ", "فشل البحث في الشجرة", [
        { text: "حسناً", onPress: () => onClose() }
      ]);
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
          onPress: () => onClose(), // Close modal on cancel
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

  // Handle selecting a search result - opens tree modal for confirmation
  const handleSelectSpouse = (spouse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSpouse(spouse);
    setTimeout(() => {
      setShowTreeModal(true);
    }, 100);
  };

  // Handle confirmation from tree modal - "هذا أنا" button clicked
  const handleConfirmFromModal = async (profile) => {
    setShowTreeModal(false);
    // Wait for modal to close
    await new Promise(resolve => setTimeout(resolve, 300));
    // Proceed with marriage creation
    await handleLinkSpouse();
  };

  // Link existing Al-Qefari profile
  const handleLinkSpouse = async () => {
    if (!selectedSpouse) return;

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Re-fetch both profiles to get latest data (prevent race conditions)
      const { data: latestPerson, error: personFetchError } = await supabase
        .from('profiles')
        .select('id, hid, family_origin, deleted_at, name, gender')
        .eq('id', person.id)
        .single();

      if (personFetchError || !latestPerson) {
        Alert.alert('خطأ', 'تعذر التحقق من بياناتك. يرجى المحاولة مرة أخرى.');
        setSubmitting(false);
        return;
      }

      if (latestPerson.deleted_at) {
        Alert.alert('خطأ', 'ملفك الشخصي محذوف. لا يمكن إضافة زواج.');
        setSubmitting(false);
        return;
      }

      const { data: latestSpouse, error: spouseFetchError } = await supabase
        .from('profiles')
        .select('id, hid, family_origin, deleted_at, name, gender')
        .eq('id', selectedSpouse.id)
        .single();

      if (spouseFetchError || !latestSpouse) {
        Alert.alert('خطأ', 'تعذر التحقق من بيانات الزوج. يرجى المحاولة مرة أخرى.');
        setSubmitting(false);
        return;
      }

      if (latestSpouse.deleted_at) {
        Alert.alert('خطأ', 'هذا الملف الشخصي محذوف. لا يمكن إضافة زواج.');
        setSubmitting(false);
        return;
      }

      // Validate marriage profiles with latest data (throws on error)
      const { husbandId, wifeId } = validateMarriageProfiles(latestPerson, latestSpouse);

      // Safety: Check for duplicate marriage
      const { data: existingMarriage } = await supabase
        .from('marriages')
        .select('id')
        .eq('husband_id', husbandId)
        .eq('wife_id', wifeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingMarriage) {
        Alert.alert("تنبيه", "يوجد زواج مسجل مسبقاً بين هذين الشخصين");
        setSubmitting(false);
        return;
      }

      // Calculate munasib value using centralized helper (with latest data for both profiles)
      const munasibValue = getMunasibValue(latestPerson, latestSpouse);
      const marriageType = getMarriageType(latestPerson, latestSpouse);

      if (__DEV__) {
        console.log('[SpouseManager] Creating marriage:', {
          marriageType,
          currentPerson: latestPerson.name,
          currentHID: latestPerson.hid || 'NULL',
          spouse: latestSpouse.name,
          spouseHID: latestSpouse.hid || 'NULL',
          munasib: munasibValue,
        });
      }

      const { data, error } = await profilesService.createMarriage({
        husband_id: husbandId,
        wife_id: wifeId,
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
    let newPersonId = null; // Track created profile for cleanup

    try {
      // 🎯 CRITICAL: Check for duplicate marriage BEFORE creating profile
      // This prevents orphaned profiles if marriage already exists
      const husband_id_pre = person.gender === "male" ? person.id : null;
      const wife_id_pre = person.gender === "female" ? person.id : null;

      const { data: existingMarriage } = await supabase
        .from('marriages')
        .select('id')
        // We can't check by exact spouse ID yet (doesn't exist), but we can
        // at least validate the person record is valid for marriage
        .limit(1);

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
      newPersonId = newPerson.id; // Save for cleanup if needed

      // Create marriage IDs
      const husband_id = person.gender === "male" ? person.id : newPerson.id;
      const wife_id = person.gender === "female" ? person.id : newPerson.id;

      // Safety: Check for duplicate marriage with newly created person
      const { data: duplicateMarriage } = await supabase
        .from('marriages')
        .select('id')
        .eq('husband_id', husband_id)
        .eq('wife_id', wife_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (duplicateMarriage) {
        // Cleanup: Soft-delete the newly created orphaned profile
        if (newPersonId) {
          await supabase
            .from('profiles')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', newPersonId);

          if (__DEV__) {
            console.log('[SpouseManager] Cleaned up orphaned profile:', newPersonId);
          }
        }

        Alert.alert("تنبيه", "يوجد زواج مسجل مسبقاً بين هذين الشخصين");
        setSubmitting(false);
        return;
      }

      const { data: marriage, error: marriageError } =
        await profilesService.createMarriage({
          husband_id,
          wife_id,
          munasib: parsed.familyOrigin || parsed.familyName,
        });

      if (marriageError) {
        // Cleanup: Soft-delete orphaned profile on marriage creation failure
        if (newPersonId) {
          await supabase
            .from('profiles')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', newPersonId);

          if (__DEV__) {
            console.log('[SpouseManager] Cleaned up orphaned profile after marriage error:', newPersonId);
          }
        }
        throw marriageError;
      }

      // Success!
      setStage("SUCCESS");
      setTimeout(() => {
        if (onSpouseAdded) onSpouseAdded(marriage);
        onClose();
      }, 1500);
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء الإضافة");
      setSubmitting(false);
      onClose(); // Close modal on error
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
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop - 50% opacity black covering top 50%, dismissed on press */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Modal Container - 50% height, bottom aligned */}
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.safeAreaContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
              </TouchableOpacity>
              <Text style={styles.title}>{modalTitle}</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Conditional Content Based on Stage */}
            {stage === "SEARCH" ? (
              /* Search Results - FlatList with TextInput as header */
              <FlatList
                  data={searchResults}
                  renderItem={({ item, index }) => (
                    <SearchResultCard
                      item={item}
                      index={index}
                      onPress={() => handleSearchBarSelect(item)}
                      showRelevanceScore={false}
                      enableAnimation={false}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.resultsList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  ListHeaderComponent={
                    <View style={styles.inputContainer}>
                      <View style={styles.inputWrapper}>
                        <Ionicons
                          name="search-outline"
                          size={20}
                          color={tokens.colors.najdi.textMuted}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          value={fullName}
                          onChangeText={handleSearchTextChange}
                          placeholder={`ابحث عن ${spouseTitle}`}
                          placeholderTextColor={tokens.colors.najdi.textMuted}
                          style={styles.textInput}
                          returnKeyType="search"
                          autoCorrect={false}
                          autoCapitalize="none"
                        />
                        {fullName.length > 0 && (
                          <TouchableOpacity onPress={() => {
                            setFullName("");
                            setSearchResults([]);
                          }} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={20} color={tokens.colors.najdi.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  }
                  ListEmptyComponent={
                    fullName.length > 0 ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={tokens.colors.najdi.textMuted} />
                        <Text style={styles.emptyText}>لا توجد نتائج</Text>
                        <Text style={styles.emptyHint}>
                          {spouseGender === "female"
                            ? "قد تكون غير موجودة في الشجرة. أضفها كملف شخصي لتظهر هنا"
                            : "قد يكون غير موجود في الشجرة. أضفه كملف شخصي ليظهر هنا"}
                        </Text>
                      </View>
                    ) : null
                  }
                />
            ) : (
              /* CREATE/SUCCESS Stages - Use ScrollView */
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {stage === "CREATE" && renderCreateStage()}
                {stage === "SUCCESS" && renderSuccessStage()}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Pressable>

      {/* Tree Modal for spouse confirmation */}
      {selectedSpouse && showTreeModal && (
        <BranchTreeModal
          visible={true}
          profile={selectedSpouse}
          onClose={() => {
            setShowTreeModal(false);
            setSelectedSpouse(null);
          }}
          onConfirm={handleConfirmFromModal}
          confirmText={selectedSpouse.gender === "female" ? "هذه هي" : "هذا هو"}
          cancelText={selectedSpouse.gender === "female" ? "ليست هي" : "ليس هو"}
        />
      )}
    </Modal>
  );
}

// PropTypes validation for type safety
SpouseManager.propTypes = {
  visible: PropTypes.bool.isRequired,
  person: PropTypes.shape({
    id: PropTypes.string.isRequired,
    gender: PropTypes.oneOf(['male', 'female']).isRequired,
    generation: PropTypes.number,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSpouseAdded: PropTypes.func,
  prefilledName: PropTypes.string,
};

SpouseManager.defaultProps = {
  onSpouseAdded: null,
  prefilledName: null,
};

const styles = StyleSheet.create({
  // Modal styling
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end', // Align modal to bottom
  },
  modalContainer: {
    height: '50%', // Half-screen height
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  safeAreaContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: tokens.spacing.lg,
  },

  // TextInput Container
  inputContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // Pure white (matches SearchBar)
    borderRadius: 22, // iOS search pill radius (matches SearchBar)
    paddingHorizontal: 16, // iOS standard padding
    height: 44, // iOS standard height
    borderWidth: 0, // No border (matches SearchBar)
  },
  inputIcon: {
    marginRight: tokens.spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
    paddingVertical: tokens.spacing.xs,
    textAlign: "right", // RTL support
  },
  clearButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.xs,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${tokens.colors.najdi.text  }20`,
    backgroundColor: tokens.colors.najdi.background, // Match modal background (Al-Jass White)
  },
  closeButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
    flex: 1,
    textAlign: "center",
  },

  // Stage Container
  stageContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },

  // SEARCH Stage
  resultsList: {
    paddingBottom: tokens.spacing.md,
    flexGrow: 0,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16, // Allow text to wrap across 2 lines
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
    backgroundColor: `${tokens.colors.najdi.primary  }10`,
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
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40, // Reduced from 120
    minHeight: 150, // Reduced from 300
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.md,
  },

  // Success
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60, // Reduced from 100
    minHeight: 150, // Reduced from 300
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
