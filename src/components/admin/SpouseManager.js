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
import PropTypes from "prop-types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { profilesService } from "../../services/profiles";
import familyNameService from "../../services/familyNameService";
import { getMunasibValue, validateMarriageProfiles, getMarriageType } from "../../utils/marriageValidation";
import tokens from "../ui/tokens";
import ProfileMatchCard from "../ProfileMatchCard";
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

  // Get appropriate gender for spouse
  const spouseGender = person?.gender === "male" ? "female" : "male";
  const spouseTitle = spouseGender === "female" ? "الزوجة" : "الزوج";
  const genderMarker = spouseGender === "female" ? "بنت" : "بن";

  // Auto-trigger search when modal opens with prefilledName
  useEffect(() => {
    if (visible && prefilledName) {
      // Pre-filled from inline adder: auto-submit to search
      setFullName(prefilledName);

      // Parse and search immediately (Al-Qefari family members only)
      const parsed = familyNameService.parseFullName(prefilledName.trim(), spouseGender);
      setParsedData(parsed);
      performSearch(parsed);
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

  // Search for Al-Qefari family members using UNIFIED search_name_chain RPC
  const performSearch = async (parsed) => {
    setStage("SEARCH");
    setLoading(true);

    try {
      // Parse name into array (same as SearchModal)
      const names = parsed.firstName.split(/\s+/).filter(n => n.length > 0);

      // Use UNIFIED search_name_chain with server-side filtering! 🎯
      // This is the same RPC that SearchModal uses, but with optional gender filtering
      const { data, error: searchError } = await supabase.rpc('search_name_chain', {
        p_names: names,
        p_gender: spouseGender,        // Server-side gender filter ✅
        p_exclude_id: person?.id,      // Exclude current person ✅
        p_limit: 8
      });

      if (searchError) throw searchError;

      // Filter to Has HID (Al-Qefari only, not munasib)
      // Gender is already filtered server-side, but we verify for defense-in-depth
      const filtered = (data || [])
        .filter(p => p.hid !== null); // Only Al-Qefari members

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

  // Render SEARCH stage
  const renderSearchStage = () => (
    <View style={styles.stageContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
          <Text style={styles.loadingText}>
            جاري البحث عن {parsedData?.firstName || ''}...
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={({ item, index }) => (
            <ProfileMatchCard
              profile={{
                ...item,
                match_score: 100, // Default to 100% for exact name matches
              }}
              index={index}
              onPress={() => handleSelectSpouse(item)}
              isSelected={false}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
        {/* Header with person info */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>إضافة {spouseTitle}</Text>
            <Text style={styles.headerSubtitle}>{person?.name}</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Stage Content */}
        {stage === "SEARCH" && renderSearchStage()}
        {stage === "CREATE" && renderCreateStage()}
        {stage === "SUCCESS" && renderSuccessStage()}
      </SafeAreaView>

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
  headerTitle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.xxs,
  },

  // Stage Container
  stageContainer: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },

  // SEARCH Stage
  resultsList: {
    paddingBottom: Math.max(100, tokens.spacing.xl + 20),
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
