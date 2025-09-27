import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import * as Haptics from "expo-haptics";

// Najdi Sadu Design System Colors
const COLORS = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  textLight: "#24212199", // Sadu Night 60%
  textMedium: "#242121CC", // Sadu Night 80%
  success: "#22C55E",
  error: "#EF4444",
};

const SuggestionModal = ({
  visible,
  onClose,
  profile,
  permissionLevel,
  onSuccess,
}) => {
  const [selectedField, setSelectedField] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Available fields for editing/suggestions
  const editableFields = [
    { key: "name", label: "الاسم", type: "text" },
    { key: "bio", label: "السيرة الذاتية", type: "text", multiline: true },
    { key: "phone", label: "رقم الهاتف", type: "phone" },
    { key: "email", label: "البريد الإلكتروني", type: "email" },
    { key: "current_residence", label: "مكان الإقامة", type: "text" },
    { key: "occupation", label: "المهنة", type: "text" },
    { key: "education", label: "التعليم", type: "text" },
  ];

  // Load current value when field is selected
  const handleFieldSelect = (field) => {
    setSelectedField(field.key);
    setCurrentValue(profile[field.key] || "");
    setNewValue(profile[field.key] || "");
  };

  // Submit suggestion
  const handleSubmit = async () => {
    if (!selectedField || !newValue || newValue === currentValue) {
      Alert.alert("خطأ", "يرجى اختيار الحقل وإدخال قيمة جديدة مختلفة");
      return;
    }

    setSubmitting(true);
    try {
      // If user has full permission, update directly
      if (permissionLevel === "full") {
        const updates = {
          [selectedField]: newValue,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", profile.id);

        if (error) throw error;

        Alert.alert("نجاح", "تم حفظ التعديل بنجاح");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        // Create a suggestion
        const { data: user } = await supabase.auth.getUser();

        const suggestion = {
          profile_id: profile.id,
          suggested_by: user.user?.id,
          field_name: selectedField,
          old_value: currentValue ? { value: currentValue } : null,
          new_value: { value: newValue },
          reason: reason || null,
          status: "pending",
        };

        const { error } = await supabase
          .from("profile_edit_suggestions")
          .insert(suggestion);

        if (error) throw error;

        Alert.alert(
          "تم الإرسال",
          "تم إرسال اقتراح التعديل للمراجعة. سيتم إشعارك عند الموافقة."
        );
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
      }
    } catch (error) {
      console.error("Error submitting:", error);
      Alert.alert("خطأ", "فشل في إرسال التعديل. حاول مرة أخرى.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const handleClose = () => {
    setSelectedField("");
    setCurrentValue("");
    setNewValue("");
    setReason("");
    onClose();
  };

  if (!profile) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.headerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {permissionLevel === "full" ? "تعديل الملف" : "اقتراح تعديل"}
            </Text>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                styles.headerButton,
                (!selectedField || !newValue || newValue === currentValue) &&
                  styles.disabledButton,
              ]}
              disabled={
                !selectedField || !newValue || newValue === currentValue || submitting
              }
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text
                  style={[
                    styles.submitText,
                    (!selectedField || !newValue || newValue === currentValue) &&
                      styles.disabledText,
                  ]}
                >
                  {permissionLevel === "full" ? "حفظ" : "إرسال"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileId}>#{profile.hid}</Text>
            </View>

            {/* Field Selection */}
            {!selectedField ? (
              <View style={styles.fieldSelection}>
                <Text style={styles.sectionTitle}>اختر الحقل للتعديل:</Text>
                {editableFields.map((field) => (
                  <TouchableOpacity
                    key={field.key}
                    style={styles.fieldOption}
                    onPress={() => handleFieldSelect(field)}
                  >
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldValue} numberOfLines={1}>
                      {profile[field.key] || "غير محدد"}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.textLight}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.editSection}>
                {/* Selected Field Header */}
                <TouchableOpacity
                  style={styles.selectedFieldHeader}
                  onPress={() => setSelectedField("")}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={COLORS.primary}
                  />
                  <Text style={styles.selectedFieldLabel}>
                    {editableFields.find((f) => f.key === selectedField)?.label}
                  </Text>
                </TouchableOpacity>

                {/* Current Value */}
                <View style={styles.valueSection}>
                  <Text style={styles.valueSectionTitle}>القيمة الحالية:</Text>
                  <View style={styles.currentValueBox}>
                    <Text style={styles.currentValueText}>
                      {currentValue || "غير محدد"}
                    </Text>
                  </View>
                </View>

                {/* New Value */}
                <View style={styles.valueSection}>
                  <Text style={styles.valueSectionTitle}>القيمة الجديدة:</Text>
                  <TextInput
                    style={[
                      styles.input,
                      editableFields.find((f) => f.key === selectedField)
                        ?.multiline && styles.multilineInput,
                    ]}
                    value={newValue}
                    onChangeText={setNewValue}
                    placeholder="أدخل القيمة الجديدة"
                    placeholderTextColor={COLORS.textLight}
                    multiline={
                      editableFields.find((f) => f.key === selectedField)
                        ?.multiline
                    }
                    textAlign="right"
                    autoFocus
                  />
                </View>

                {/* Reason (for suggestions only) */}
                {permissionLevel === "suggest" && (
                  <View style={styles.valueSection}>
                    <Text style={styles.valueSectionTitle}>
                      سبب التعديل (اختياري):
                    </Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={reason}
                      onChangeText={setReason}
                      placeholder="اشرح سبب اقتراحك لهذا التعديل"
                      placeholderTextColor={COLORS.textLight}
                      multiline
                      numberOfLines={3}
                      textAlign="right"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Info Message */}
            {permissionLevel === "suggest" && !selectedField && (
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={COLORS.secondary}
                />
                <Text style={styles.infoText}>
                  ستتم مراجعة اقتراحك من قبل المشرفين قبل اعتماده
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "40",
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textMedium,
  },
  submitText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileInfo: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "40",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  profileId: {
    fontSize: 14,
    color: COLORS.textMedium,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 16,
    textAlign: "right",
  },
  fieldSelection: {
    marginBottom: 24,
  },
  fieldOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginRight: 8,
  },
  fieldValue: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
    textAlign: "right",
  },
  editSection: {
    marginBottom: 24,
  },
  selectedFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  selectedFieldLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginLeft: 12,
  },
  valueSection: {
    marginBottom: 20,
  },
  valueSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMedium,
    marginBottom: 8,
    textAlign: "right",
  },
  currentValueBox: {
    backgroundColor: COLORS.container + "20",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  currentValueText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: "right",
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary + "10",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginLeft: 8,
    flex: 1,
    textAlign: "right",
  },
});

export default SuggestionModal;