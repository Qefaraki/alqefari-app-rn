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
import { phoneAuthService } from "../../services/phoneAuth";
import familyNameService from "../../services/familyNameService";
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

  // Search for Al-Qefari family members using name chain search
  const performSearch = async (parsed) => {
    setStage("SEARCH");
    setLoading(true);

    try {
      // Build search query from first name
      const searchQuery = parsed.firstName;

      // Use phoneAuthService which returns profiles WITH name chain data
      const result = await phoneAuthService.searchProfilesByNameChain(searchQuery);

      if (!result.success) {
        throw new Error(result.error || "فشل البحث");
      }

      // Filter to:
      // 1. Correct gender
      // 2. Has HID (Al-Qefari only, not munasib)
      // 3. Not current person
      const filtered = (result.profiles || [])
        .filter(p => p.gender === spouseGender)
        .filter(p => p.hid !== null) // Only Al-Qefari members
        .filter(p => p.id !== person?.id)
        .slice(0, 8); // Max 8 results

      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("خطأ", "فشل البحث في الشجرة");
      onClose(); // Close modal on search error
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
      const husband_id = person.gender === "male" ? person.id : selectedSpouse.id;
      const wife_id = person.gender === "female" ? person.id : selectedSpouse.id;

      // Safety: Check for duplicate marriage
      const { data: existingMarriage } = await supabase
        .from('marriages')
        .select('id')
        .eq('husband_id', husband_id)
        .eq('wife_id', wife_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingMarriage) {
        Alert.alert("تنبيه", "يوجد زواج مسجل مسبقاً بين هذين الشخصين");
        setSubmitting(false);
        return;
      }

      // CRITICAL FIX: Cousin marriage handling
      // DEFENSIVE: Must check if BOTH spouses have HID to confirm cousin marriage
      // - Al-Qefari member: hid !== null (e.g., "R1.2.1.1")
      // - Munasib: hid === null AND family_origin !== null
      // NOTE: Simple hid check fails because munasib also have hid === null!

      // Check if current person is Al-Qefari (has HID)
      const currentPersonIsAlQefari = person.hid !== null && person.hid !== undefined && person.hid.trim() !== '';

      // Check if selected spouse is Al-Qefari (has HID)
      const selectedSpouseIsAlQefari = selectedSpouse.hid !== null && selectedSpouse.hid !== undefined && selectedSpouse.hid.trim() !== '';

      // Cousin marriage: BOTH must have HID
      // Regular marriage: At least one has no HID
      let munasibValue;

      if (currentPersonIsAlQefari && selectedSpouseIsAlQefari) {
        // TRUE cousin marriage: Both are Al-Qefari family members
        munasibValue = null;
        if (__DEV__) {
          console.log('[SpouseManager] Cousin marriage detected:', {
            currentPerson: person.name,
            currentHID: person.hid,
            spouse: selectedSpouse.name,
            spouseHID: selectedSpouse.hid,
          });
        }
      } else {
        // Regular marriage: Use family_origin from spouse (munasib)
        munasibValue = selectedSpouse.family_origin || null;
        if (__DEV__) {
          console.log('[SpouseManager] Regular marriage detected:', {
            currentPerson: person.name,
            currentHID: person.hid || 'NULL',
            spouse: selectedSpouse.name,
            spouseHID: selectedSpouse.hid || 'NULL',
            familyOrigin: munasibValue,
          });
        }
      }

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

      // Safety: Check for duplicate marriage
      const { data: existingMarriage } = await supabase
        .from('marriages')
        .select('id')
        .eq('husband_id', husband_id)
        .eq('wife_id', wife_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingMarriage) {
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

      if (marriageError) throw marriageError;

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
        <>
          <Text style={styles.searchTitle}>
            نتائج البحث عن: {parsedData?.firstName}
          </Text>
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
        </>
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

  // SEARCH Stage
  searchTitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.md,
  },
  resultsList: {
    paddingBottom: 100,
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
