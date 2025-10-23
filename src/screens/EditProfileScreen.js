import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import profilesService from "../services/profiles";
import { handleSupabaseError, supabase } from "../services/supabase";
import HeaderBar from "../components/ui/HeaderBar";
import Surface from "../components/ui/Surface";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import SegmentedControl from "../components/ui/SegmentedControl";
import tokens from "../components/ui/tokens";
import NameEditor from "../components/admin/fields/NameEditor";
import PhotoEditor from "../components/admin/fields/PhotoEditor";
import DateEditor from "../components/admin/fields/DateEditor";
import FatherSelector from "../components/admin/fields/FatherSelector";
import MotherSelector from "../components/admin/fields/MotherSelector";
import DraggableChildrenList from "../components/admin/DraggableChildrenList";
import MarriageEditor from "../components/admin/MarriageEditor";
import { validateDates } from "../utils/dateUtils";
import { useAdminMode } from "../contexts/AdminModeContext";

const EditProfileScreen = ({ visible, profile, onClose, onSave }) => {
  const { isAdmin } = useAdminMode();

  const [formData, setFormData] = useState({
    name: "",
    hid: "",
    gender: "male",
    birth_year: "",
    death_year: "",
    bio: "",
    photo_url: "",
    dob_data: null,
    dod_data: null,
    father_id: null,
    mother_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [dateErrors, setDateErrors] = useState({ dob: null, dod: null });
  const [initial, setInitial] = useState(null);

  // Relationship data
  const [marriages, setMarriages] = useState([]);
  const [children, setChildren] = useState([]);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  useEffect(() => {
    if (profile) {
      const birthYear =
        profile?.dob_data?.gregorian?.year ||
        profile?.dob_data?.hijri?.year ||
        profile?.birth_year ||
        "";

      const deathYear =
        profile?.dod_data?.gregorian?.year ||
        profile?.dod_data?.hijri?.year ||
        profile?.death_year ||
        "";

      const initialData = {
        name: profile.name || "",
        hid: profile.hid || "",
        gender: profile.gender || "male",
        birth_year: birthYear,
        death_year: deathYear,
        bio: profile.bio || "",
        photo_url: profile.photo_url || "",
        dob_data: profile.dob_data || null,
        dod_data: profile.dod_data || null,
        father_id: profile.father_id || null,
        mother_id: profile.mother_id || null,
      };

      setFormData(initialData);
      setInitial(initialData);

      // Load relationships
      loadRelationships();
    }
  }, [profile]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "الاسم مطلوب";
    }

    if (!formData.hid.trim()) {
      newErrors.hid = "HID مطلوب";
    }

    if (
      formData.birth_year &&
      (isNaN(formData.birth_year) ||
        Number(formData.birth_year) < 1800 ||
        Number(formData.birth_year) > new Date().getFullYear())
    ) {
      newErrors.birth_year = "سنة الميلاد غير صحيحة";
    }

    if (formData.death_year) {
      if (
        isNaN(formData.death_year) ||
        Number(formData.death_year) < 1800 ||
        Number(formData.death_year) > new Date().getFullYear()
      ) {
        newErrors.death_year = "سنة الوفاة غير صحيحة";
      }
      if (
        formData.birth_year &&
        Number(formData.death_year) < Number(formData.birth_year)
      ) {
        newErrors.death_year = "سنة الوفاة يجب أن تكون بعد سنة الميلاد";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValid = useMemo(() => {
    return (
      formData.name.trim().length > 1 &&
      formData.hid.trim().length > 0 &&
      (!formData.birth_year ||
        (!isNaN(formData.birth_year) && Number(formData.birth_year) >= 1800)) &&
      (!formData.death_year ||
        (!isNaN(formData.death_year) && Number(formData.death_year) >= 1800)) &&
      (!formData.death_year ||
        !formData.birth_year ||
        Number(formData.death_year) >= Number(formData.birth_year)) &&
      !dateErrors.dob &&
      !dateErrors.dod
    );
  }, [formData, dateErrors]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      initial.name !== formData.name ||
      initial.gender !== formData.gender ||
      initial.birth_year !== formData.birth_year ||
      initial.death_year !== formData.death_year ||
      initial.bio !== formData.bio ||
      initial.photo_url !== formData.photo_url ||
      initial.father_id !== formData.father_id ||
      initial.mother_id !== formData.mother_id ||
      JSON.stringify(initial.dob_data) !== JSON.stringify(formData.dob_data) ||
      JSON.stringify(initial.dod_data) !== JSON.stringify(formData.dod_data)
    );
  }, [initial, formData]);

  // Load relationships data
  const loadRelationships = async () => {
    if (!profile?.id) return;

    setLoadingRelationships(true);
    try {
      // Load marriages
      if (profile.gender === "male") {
        const { data: marriageData, error: marriageError } = await supabase.rpc(
          "admin_get_person_marriages",
          { person_id: profile.id },
        );

        if (!marriageError && marriageData) {
          setMarriages(marriageData);
        }
      }

      // Load children
      const { data: childrenData, error: childrenError } = await supabase
        .from("profiles")
        .select(
          `
          id, name, gender, hid, birth_date, death_date, 
          status, sibling_order, dob_data, dod_data, father_id, mother_id,
          mother:profiles!mother_id(id, name)
        `,
        )
        .or(`father_id.eq.${profile.id},mother_id.eq.${profile.id}`)
        .order("sibling_order", { ascending: true });

      if (!childrenError && childrenData) {
        setChildren(childrenData);
      }
    } catch (error) {
      console.error("Error loading relationships:", error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  // Handle date changes with validation
  const handleDateChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Validate dates
    const errors = validateDates(newFormData.dob_data, newFormData.dod_data);
    setDateErrors({
      dob: errors.dob || null,
      dod: errors.dod || null,
    });
  };

  // Handle parent changes
  const handleParentChange = async (parentType, parentId) => {
    setFormData({ ...formData, [parentType]: parentId });
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const updateData = {
        name: formData.name.trim(),
        gender: formData.gender, // 'male' | 'female'
        bio: formData.bio?.trim() || null,
        photo_url: formData.photo_url?.trim() || null,
        father_id: formData.father_id,
        mother_id: formData.mother_id,
        dob_data:
          formData.dob_data ||
          (formData.birth_year
            ? { gregorian: { year: parseInt(formData.birth_year, 10) } }
            : null),
        dod_data:
          formData.dod_data ||
          (formData.death_year
            ? { gregorian: { year: parseInt(formData.death_year, 10) } }
            : null),
      };

      // Use admin RPC for profile updates with optimistic version
      const currentVersion = profile?.version || 1;
      const { data, error } = await profilesService.updateProfile(
        profile.id,
        currentVersion,
        updateData,
      );

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (onSave) onSave(data);
      onClose();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "خطأ",
        handleSupabaseError(error) || "فشل تحديث الملف الشخصي",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <HeaderBar
            title="تعديل الملف الشخصي"
            onClose={onClose}
            rightSlot={
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading || !isValid || !isDirty}
                accessibilityLabel="حفظ"
                style={{ opacity: loading || !isValid || !isDirty ? 0.5 : 1 }}
              >
                <Text
                  style={{
                    color: tokens.colors.accent,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  حفظ
                </Text>
              </TouchableOpacity>
            }
          />

          {/* Form */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero section */}
            <Surface style={styles.heroCard}>
              <View style={styles.heroContent}>
                <PhotoEditor
                  value={formData.photo_url || ""}
                  onChange={(url) =>
                    setFormData({ ...formData, photo_url: url })
                  }
                  currentPhotoUrl={formData.photo_url}
                  personName={formData.name || profile?.name || "الشخص"}
                  profileId={profile?.id}
                />
                <View style={{ marginTop: 12 }}>
                  <NameEditor
                    value={formData.name}
                    onChange={(text) =>
                      setFormData({ ...formData, name: text })
                    }
                    placeholder="الاسم الكامل"
                  />
                  {!!errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>
              </View>
            </Surface>

            {/* Identity section */}
            <Surface style={styles.sectionCard}>
              <Field
                label="HID (للقراءة فقط)"
                value={formData.hid}
                onChangeText={() => {}}
                inputStyle={styles.readOnlyInput}
                editable={false}
              />

              <View style={styles.inlineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>الجنس</Text>
                  <SegmentedControl
                    value={formData.gender}
                    onChange={(val) =>
                      setFormData({ ...formData, gender: val })
                    }
                    options={[
                      { label: "ذكر", id: "male" },
                      { label: "أنثى", id: "female" },
                    ]}
                  />
                </View>
              </View>
            </Surface>

            {/* Dates */}
            <Surface style={styles.sectionCard}>
              <DateEditor
                label="تاريخ الميلاد"
                value={formData.dob_data}
                onChange={(value) => handleDateChange("dob_data", value)}
                error={dateErrors.dob}
              />
              <View style={{ marginTop: 16 }}>
                <DateEditor
                  label="تاريخ الوفاة"
                  value={formData.dod_data}
                  onChange={(value) => handleDateChange("dod_data", value)}
                  error={dateErrors.dod}
                />
              </View>
            </Surface>

            {/* Bio */}
            <Surface style={styles.sectionCard}>
              <Field
                label="نبذة"
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="أي معلومات إضافية"
                multiline
                numberOfLines={4}
              />
            </Surface>

            {/* Parents Section */}
            {isAdmin && (
              <Surface style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>الوالدين</Text>
                <View style={styles.parentSelectors}>
                  <FatherSelector
                    value={formData.father_id}
                    onChange={(id) => handleParentChange("father_id", id)}
                    currentPersonId={profile?.id}
                    excludeIds={[profile?.id]}
                  />
                  <View style={{ marginTop: 12 }}>
                    <MotherSelector
                      value={formData.mother_id}
                      onChange={(id) => handleParentChange("mother_id", id)}
                      currentPersonId={profile?.id}
                      excludeIds={[profile?.id]}
                    />
                  </View>
                </View>
              </Surface>
            )}

            {/* Marriages Section - Only for males */}
            {profile?.gender === "male" && isAdmin && (
              <Surface style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>الزوجات</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowMarriageEditor(true)}
                  >
                    <Text style={styles.addButtonText}>+ إضافة زواج</Text>
                  </TouchableOpacity>
                </View>
                {loadingRelationships ? (
                  <ActivityIndicator style={{ padding: 20 }} />
                ) : marriages.length > 0 ? (
                  <View style={styles.marriagesList}>
                    {marriages.map((marriage) => (
                      <View key={marriage.id} style={styles.marriageItem}>
                        <Text style={styles.marriageText}>
                          {marriage.wife_name || "غير محدد"}
                        </Text>
                        {marriage.is_current && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentText}>حالي</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>لا توجد حالات زواج مسجلة</Text>
                )}
              </Surface>
            )}

            {/* Children Section */}
            {profile?.id && (
              <Surface style={[styles.sectionCard, { paddingBottom: 0 }]}>
                <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>
                  الأبناء
                </Text>
                {loadingRelationships ? (
                  <ActivityIndicator style={{ padding: 20 }} />
                ) : (
                  <DraggableChildrenList
                    initialChildren={children}
                    parentProfile={profile}
                    onUpdate={loadRelationships}
                    isAdmin={isAdmin}
                  />
                )}
              </Surface>
            )}
          </ScrollView>

          {/* Footer removed – Save is in header */}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Marriage Editor Modal */}
      {showMarriageEditor && (
        <MarriageEditor
          visible={showMarriageEditor}
          onClose={() => setShowMarriageEditor(false)}
          husbandId={profile?.id}
          onSave={() => {
            setShowMarriageEditor(false);
            loadRelationships();
          }}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.colors.textMuted,
    marginBottom: 8,
    textAlign: "right",
  },
  readOnlyInput: {
    backgroundColor: "#F7F7FA",
    color: "#9CA3AF",
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  parentSelectors: {
    gap: 12,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  marriagesList: {
    gap: 8,
  },
  marriageItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F7F7FA",
    borderRadius: 8,
    gap: 8,
  },
  marriageText: {
    flex: 1,
    fontSize: 16,
    color: tokens.colors.text,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#E8F5E9",
    borderRadius: 4,
  },
  currentText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    textAlign: "center",
    padding: 20,
  },
});

export default EditProfileScreen;
