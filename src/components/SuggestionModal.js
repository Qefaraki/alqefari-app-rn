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
import suggestionService from "../services/suggestionService";
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
    { key: "current_location", label: "مكان الإقامة", type: "text" },
    { key: "occupation", label: "المهنة", type: "text" },
    { key: "education", label: "التعليم", type: "text" },
    { key: "date_of_birth", label: "تاريخ الميلاد", type: "text" },
    { key: "place_of_birth", label: "مكان الميلاد", type: "text" },
    { key: "instagram", label: "إنستجرام", type: "text" },
    { key: "twitter", label: "تويتر", type: "text" },
    { key: "linkedin", label: "لينكد إن", type: "text" },
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
      // v4.2: Direct edit for admin, moderator, or inner circle
      if (['admin', 'moderator', 'inner'].includes(permissionLevel)) {
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
        // v4.2: Suggest-only for family or extended circle
        const result = await suggestionService.submitEditSuggestion(
          profile.id,
          selectedField,
          newValue,
          reason || null
        );

        // Show appropriate message based on permission level
        let message = "";
        let title = "تم الإرسال";

        if (permissionLevel === 'family') {
          message = "تم إرسال اقتراحك للمراجعة.\n\nسيتم الموافقة عليه تلقائياً خلال 48 ساعة إذا لم يتم رفضه.";
        } else if (permissionLevel === 'extended') {
          message = "تم إرسال اقتراحك للمراجعة.\n\nيحتاج موافقة المشرف قبل التطبيق.";
        } else {
          message = "تم إرسال اقتراح التعديل للمراجعة.";
        }

        Alert.alert(title, message);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
      }
    } catch (error) {
      console.error("Error submitting:", error);
      Alert.alert("خطأ", error.message || "فشل في إرسال التعديل. حاول مرة أخرى.");
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
              {['admin', 'moderator', 'inner'].includes(permissionLevel) ? "تعديل الملف" : "اقتراح تعديل"}
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
                  {['admin', 'moderator', 'inner'].includes(permissionLevel) ? "حفظ" : "إرسال"}
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

                {/* Reason (for suggestions only - family or extended) */}
                {['family', 'extended'].includes(permissionLevel) && (
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
            {['family', 'extended'].includes(permissionLevel) && !selectedField && (
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={COLORS.secondary}
                />
                <Text style={styles.infoText}>
                  {permissionLevel === 'family'
                    ? "ستتم مراجعة اقتراحك وسيتم الموافقة عليه تلقائياً خلال 48 ساعة"
                    : "ستتم مراجعة اقتراحك من قبل المشرفين قبل اعتماده"}
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
