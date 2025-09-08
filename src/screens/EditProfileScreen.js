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
  SafeAreaView,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import profilesService from "../services/profiles";
import { handleSupabaseError } from "../services/supabase";
import HeaderBar from "../components/ui/HeaderBar";
import Surface from "../components/ui/Surface";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import SegmentedControl from "../components/ui/SegmentedControl";
import tokens from "../components/ui/tokens";
import NameEditor from "../components/admin/fields/NameEditor";
import PhotoEditor from "../components/admin/fields/PhotoEditor";
import DateEditor from "../components/admin/fields/DateEditor";
import { validateDates } from "../utils/dateUtils";

const EditProfileScreen = ({ visible, profile, onClose, onSave }) => {
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
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [dateErrors, setDateErrors] = useState({ dob: null, dod: null });
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    if (profile) {
      const birthYear =
        profile?.dob_data?.gregorian?.year ||
        profile?.dob_data?.hijri?.year ||
        "";
      const deathYear =
        profile?.dod_data?.gregorian?.year ||
        profile?.dod_data?.hijri?.year ||
        "";
      const next = {
        name: profile.name || "",
        hid: profile.hid || "",
        gender: profile.gender || "male",
        birth_year: birthYear ? String(birthYear) : "",
        death_year: deathYear ? String(deathYear) : "",
        bio: profile.bio || profile.biography || "",
        photo_url: profile.photo_url || "",
        dob_data: profile.dob_data || null,
        dod_data: profile.dod_data || null,
      };
      setFormData(next);
      setInitial(next);
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
      JSON.stringify(initial.dob_data) !== JSON.stringify(formData.dob_data) ||
      JSON.stringify(initial.dod_data) !== JSON.stringify(formData.dod_data)
    );
  }, [initial, formData]);

  // Handle date changes with validation
  const handleDateChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Validate dates
    const errors = validateDates(newFormData.dob_data, newFormData.dod_data);
    setDateErrors(errors);
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
                      { label: "ذكر", value: "male" },
                      { label: "أنثى", value: "female" },
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
          </ScrollView>

          {/* Footer removed – Save is in header */}
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    fontSize: 12,
    color: tokens.colors.danger,
    marginTop: 4,
    textAlign: "right",
  },
  yearRow: {
    flexDirection: "row",
  },
  inlineRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },
  footer: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
  },
  footerRow: { flexDirection: "row-reverse", alignItems: "center" },
  sectionCard: { padding: 16, marginBottom: 12 },
  heroCard: { padding: 16, marginBottom: 12 },
  heroContent: { alignItems: "center" },
});

export default EditProfileScreen;
