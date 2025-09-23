import React, { useState, useEffect } from "react";
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
import {
  validateSaudiPhone,
  sanitizeInput,
  checkRateLimit,
  formatPhoneNumber,
} from "../../utils/validationUtils";
import { APP_CONFIG, ERROR_MESSAGES } from "../../config/constants";

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
  error: "#F44336",
  whatsapp: "#25D366",
};

export default function ContactAdminScreen({ navigation, route }) {
  const { user, nameChain } = route.params || {};
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);

  // Check for existing pending request
  useEffect(() => {
    checkExistingRequest();
  }, []);

  const checkExistingRequest = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profile_creation_requests")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "reviewing"])
        .single();

      if (data && !error) {
        setExistingRequest(data);
        Alert.alert(
          "طلب موجود",
          "لديك طلب قيد المراجعة بالفعل. سيتم التواصل معك قريباً.",
          [{ text: "موافق", onPress: () => navigation.goBack() }],
        );
      }
    } catch (err) {
      // No existing request, which is fine
      console.log("No existing request");
    }
  };

  const validatePhone = (phone) => {
    setPhoneError("");
    if (!phone.trim()) {
      setPhoneError("يرجى إدخال رقم الهاتف");
      return false;
    }
    if (!validateSaudiPhone(phone)) {
      setPhoneError(ERROR_MESSAGES.PHONE_INVALID);
      return false;
    }
    return true;
  };

  const handleSubmitRequest = async () => {
    // Validate phone
    if (!validatePhone(phoneNumber)) {
      return;
    }

    // Check for existing request
    if (existingRequest) {
      Alert.alert("تنبيه", ERROR_MESSAGES.DUPLICATE_REQUEST);
      return;
    }

    // Rate limiting
    if (
      !checkRateLimit(user?.id || "anonymous", "profile_request", 3, 3600000)
    ) {
      Alert.alert("تنبيه", ERROR_MESSAGES.RATE_LIMIT);
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Sanitize inputs
      const sanitizedInfo = sanitizeInput(additionalInfo);
      const sanitizedNameChain = sanitizeInput(nameChain).substring(
        0,
        APP_CONFIG.MAX_NAME_CHAIN_LENGTH,
      );
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Create profile creation request
      const { data, error } = await supabase
        .from("profile_creation_requests")
        .insert({
          user_id: user?.id,
          name_chain: sanitizedNameChain,
          phone_number: formattedPhone,
          additional_info: sanitizedInfo || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          throw new Error(ERROR_MESSAGES.DUPLICATE_REQUEST);
        }
        throw error;
      }

      // Notify admins (audit log - phone number excluded for privacy)
      await supabase.from("audit_log").insert({
        action_type: "profile_creation_request",
        actor_id: user?.id || null,
        details: {
          request_id: data.id,
          name_chain: sanitizedNameChain,
          // Phone number excluded from audit log for privacy
          has_additional_info: !!sanitizedInfo,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "تم إرسال الطلب ✓",
        `سيتم التواصل معك خلال ${APP_CONFIG.DEFAULT_REVIEW_TIME_HOURS} ساعة`,
        [
          {
            text: "موافق",
            onPress: () => navigation.navigate("Onboarding"),
          },
        ],
      );
    } catch (error) {
      console.error("Error submitting request:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const errorMessage = error.message || ERROR_MESSAGES.GENERIC_ERROR;
      Alert.alert("خطأ", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!APP_CONFIG.ENABLE_WHATSAPP) {
      Alert.alert("غير متاح", "خدمة WhatsApp غير متاحة حالياً");
      return;
    }

    // Validate phone first
    if (!validatePhone(phoneNumber)) {
      return;
    }

    const adminNumber = APP_CONFIG.ADMIN_WHATSAPP;
    // Sanitize message content to prevent injection
    const sanitizedName = sanitizeInput(nameChain);
    const sanitizedPhone = formatPhoneNumber(phoneNumber);
    const sanitizedInfo = sanitizeInput(additionalInfo);

    const message = encodeURIComponent(
      `السلام عليكم\n\nأرغب في إضافة ملفي إلى شجرة العائلة:\nالاسم: ${sanitizedName}\nرقم الهاتف: ${sanitizedPhone}${sanitizedInfo ? `\nمعلومات إضافية: ${sanitizedInfo}` : ""}`,
    );

    const url = `whatsapp://send?phone=${adminNumber}&text=${message}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Linking.openURL(url);
        } else {
          Alert.alert("خطأ", "WhatsApp غير مثبت على هذا الجهاز");
        }
      })
      .catch((err) => {
        console.error("Error opening WhatsApp:", err);
        Alert.alert("خطأ", "لا يمكن فتح WhatsApp");
      });
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
              style={[styles.input, phoneError ? styles.inputError : null]}
              placeholder="05XXXXXXXX"
              placeholderTextColor={colors.textMuted}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setPhoneError(""); // Clear error on change
              }}
              onBlur={() => validatePhone(phoneNumber)}
              keyboardType="phone-pad"
              textAlign="left"
              maxLength={10}
              accessibilityLabel="رقم الهاتف"
              accessibilityHint="أدخل رقم هاتفك السعودي"
              editable={!existingRequest}
            />
            {phoneError ? (
              <Text style={styles.errorText}>{phoneError}</Text>
            ) : null}
          </View>

          {/* Additional Info */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              معلومات إضافية (اختياري) - {additionalInfo.length}/
              {APP_CONFIG.MAX_ADDITIONAL_INFO_LENGTH}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="أي معلومات قد تساعد في التحقق من هويتك..."
              placeholderTextColor={colors.textMuted}
              value={additionalInfo}
              onChangeText={(text) => {
                if (text.length <= APP_CONFIG.MAX_ADDITIONAL_INFO_LENGTH) {
                  setAdditionalInfo(text);
                }
              }}
              multiline
              numberOfLines={4}
              textAlign="left"
              maxLength={APP_CONFIG.MAX_ADDITIONAL_INFO_LENGTH}
              accessibilityLabel="معلومات إضافية"
              accessibilityHint="أضف أي معلومات قد تساعد في التحقق من هويتك"
              editable={!existingRequest}
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
              disabled={submitting || existingRequest}
              activeOpacity={0.8}
              accessibilityLabel="إرسال الطلب"
              accessibilityHint="اضغط لإرسال طلب إنشاء ملف شخصي"
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={colors.background} />
                  <Text style={styles.primaryButtonText}>إرسال الطلب</Text>
                </>
              )}
            </TouchableOpacity>

            {/* WhatsApp Button */}
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
              accessibilityLabel="تواصل عبر واتساب"
              accessibilityHint="اضغط لفتح واتساب والتواصل مع المشرف"
              accessibilityRole="button"
            >
              <Ionicons
                name="logo-whatsapp"
                size={20}
                color={colors.background}
              />
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
    textAlign: "left", // Native RTL will flip this
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

  // Buttons - Following CLAUDE.md button specs
  buttonContainer: {
    gap: 16, // 8px grid
    marginTop: 32, // 8px grid (4*8)
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14, // From CLAUDE.md
    paddingHorizontal: 32, // From CLAUDE.md
    minHeight: 48, // CRITICAL: From CLAUDE.md
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8, // 8px grid
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
    color: colors.background, // Al-Jass White from CLAUDE.md
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    fontFamily: "SF Arabic",
    textAlign: "left", // Native RTL will flip this
  },
  whatsappButton: {
    backgroundColor: colors.whatsapp,
    borderRadius: 10,
    paddingVertical: 14, // From CLAUDE.md
    paddingHorizontal: 32, // From CLAUDE.md
    minHeight: 48, // CRITICAL: From CLAUDE.md
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8, // 8px grid
  },
  whatsappButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.background, // Al-Jass White from CLAUDE.md
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
