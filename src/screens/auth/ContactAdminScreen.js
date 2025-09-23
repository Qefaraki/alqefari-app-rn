import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import DuolingoProgressBar from "../../components/DuolingoProgressBar";
import * as Haptics from "expo-haptics";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#242121CC", // Sadu Night 80%
  textMuted: "#24212199", // Sadu Night 60%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  accent: "#957EB5", // Lavender Haze
  inputBg: "rgba(209, 187, 163, 0.1)", // Container 10%
  inputBorder: "rgba(209, 187, 163, 0.4)", // Container 40%
  success: "#4CAF50",
  whatsapp: "#25D366",
};

export default function ContactAdminScreen({ navigation, route }) {
  const { user, nameChain } = route.params || {};
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitRequest = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("خطأ", "يرجى إدخال رقم الهاتف");
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Create profile creation request
      const { data, error } = await supabase
        .from("profile_creation_requests")
        .insert({
          user_id: user?.id,
          name_chain: nameChain,
          phone_number: phoneNumber,
          additional_info: additionalInfo || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Notify admins (using existing audit log for now)
      await supabase.from("audit_log").insert({
        action_type: "profile_creation_request",
        actor_id: user?.id || null,
        details: {
          request_id: data.id,
          name_chain: nameChain,
          phone_number: phoneNumber,
          additional_info: additionalInfo,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert("تم إرسال الطلب ✓", "سيتم التواصل معك قريباً من قبل المشرف", [
        {
          text: "موافق",
          onPress: () => navigation.navigate("Onboarding"),
        },
      ]);
    } catch (error) {
      console.error("Error submitting request:", error);
      Alert.alert("خطأ", "حدث خطأ في إرسال الطلب. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    // Admin WhatsApp number - should be configured in environment
    const adminNumber = "+966501234567"; // Replace with actual admin number
    const message = encodeURIComponent(
      `السلام عليكم\n\nأرغب في إضافة ملفي إلى شجرة العائلة:\nالاسم: ${nameChain}\nرقم الهاتف: ${phoneNumber}\n${additionalInfo ? `معلومات إضافية: ${additionalInfo}` : ""}`,
    );
    const url = `whatsapp://send?phone=${adminNumber}&text=${message}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("خطأ", "WhatsApp غير مثبت على هذا الجهاز");
        }
      })
      .catch((err) => console.error("Error opening WhatsApp:", err));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Progress Bar - Step 5 of 5 */}
          <View style={styles.progressWrapper}>
            <DuolingoProgressBar currentStep={5} totalSteps={5} />
          </View>

          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="person-add-outline"
              size={48}
              color={colors.secondary}
            />
          </View>

          <Text style={styles.title}>طلب إضافة ملف شخصي</Text>
          <Text style={styles.subtitle}>
            سنتواصل معك لإضافة ملفك الشخصي إلى شجرة العائلة
          </Text>

          {/* Name Chain Display */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>الاسم المدخل</Text>
            <Text style={styles.infoValue}>{nameChain}</Text>
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>رقم الهاتف *</Text>
            <TextInput
              style={styles.input}
              placeholder="05XXXXXXXX"
              placeholderTextColor={colors.textMuted}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              textAlign="right"
              maxLength={10}
            />
          </View>

          {/* Additional Info */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>معلومات إضافية (اختياري)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="أي معلومات قد تساعد في التحقق من هويتك..."
              placeholderTextColor={colors.textMuted}
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={4}
              textAlign="right"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Submit Request Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                submitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmitRequest}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.primaryButtonText}>إرسال الطلب</Text>
                </>
              )}
            </TouchableOpacity>

            {/* WhatsApp Button */}
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
              <Text style={styles.whatsappButtonText}>تواصل عبر واتساب</Text>
            </TouchableOpacity>
          </View>

          {/* Helper Text */}
          <View style={styles.helperContainer}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text style={styles.helperText}>
              سيقوم المشرف بمراجعة طلبك والتواصل معك خلال 24-48 ساعة
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressWrapper: {
    flex: 1,
    marginRight: 48, // Space for back button
  },
  backButton: {
    position: "absolute",
    right: 16,
    top: Platform.OS === "ios" ? 60 : 40,
    padding: 8,
  },

  // Main Content
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 24,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },

  // Input Fields
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: 8,
    textAlign: "right",
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 14,
  },

  // Buttons
  buttonContainer: {
    gap: 12,
    marginTop: 32,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  whatsappButton: {
    backgroundColor: colors.whatsapp,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  whatsappButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFF",
  },

  // Helper
  helperContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    lineHeight: 20,
  },
});
