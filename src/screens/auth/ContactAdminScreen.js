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
import { router, useLocalSearchParams } from "expo-router";
import adminContactService from "../../services/adminContact";

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

export default function ContactAdminScreen() {
  const params = useLocalSearchParams();
  const { user: userString, nameChain } = params;
  const user = userString ? JSON.parse(userString) : null;
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingMessage, setExistingMessage] = useState(null);

  // Check for existing message
  useEffect(() => {
    checkExistingMessage();
  }, []);

  const checkExistingMessage = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("admin_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "unread")
        .single();

      if (data && !error) {
        setExistingMessage(data);
        Alert.alert(
          "رسالة موجودة",
          "لديك رسالة قيد المراجعة بالفعل. سيتم التواصل معك قريباً.",
          [{ text: "موافق", onPress: () => router.back() }],
        );
      }
    } catch (err) {
      // No existing message, which is fine
      console.log("No existing message");
    }
  };

  const handleSubmitMessage = async () => {
    if (!message.trim()) {
      Alert.alert("خطأ", "يرجى كتابة رسالة");
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Submit message to admin_messages table
      const { data, error } = await supabase.from("admin_messages").insert({
        user_id: user.id,
        phone: user.phone || "",
        name_chain: nameChain || "",
        message: message.trim(),
        type: "no_profile_found",
        status: "unread",
      });

      if (error) throw error;

      // Notify admins (if notification service is available)
      try {
        const { notifyAdminsOfNewRequest } = await import("../../services/notifications");
        await notifyAdminsOfNewRequest({
          type: "no_profile_found",
          name_chain: nameChain,
          message: message,
        });
      } catch (notifError) {
        console.log("Notification error (non-critical):", notifError);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "تم الإرسال",
        "تم إرسال رسالتك للمشرف. سيتم التواصل معك قريباً عبر WhatsApp.",
        [
          {
            text: "موافق",
            onPress: () => router.push("/(auth)/"),
          },
        ],
      );
    } catch (error) {
      console.error("Error submitting message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل إرسال الرسالة. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const message = `مرحباً، لم أجد ملفي في الشجرة\nالاسم: ${nameChain}\nرقم الجوال: ${user?.phone || ""}`;

    const result = await adminContactService.openAdminWhatsApp(message);

    if (!result.success) {
      Alert.alert("خطأ", "لا يمكن فتح WhatsApp. تأكد من تثبيت التطبيق.");
    }
  };

  if (existingMessage) {
    return null; // Will navigate back after alert
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <DuolingoProgressBar currentStep={5} totalSteps={5} />
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} color={colors.primary} />
        </View>

        {/* Title */}
        <Text style={styles.title}>تواصل مع المشرف</Text>
        <Text style={styles.subtitle}>
          لم نجد ملفك في شجرة العائلة. اترك رسالة للمشرف وسيتم التواصل معك لإضافة ملفك.
        </Text>

        {/* Name Display */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>الاسم المُدخل</Text>
          <Text style={styles.infoValue}>{nameChain || "غير محدد"}</Text>
        </View>

        {/* Phone Display */}
        {user?.phone && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>رقم الجوال</Text>
            <Text style={styles.infoValue}>{user.phone}</Text>
          </View>
        )}

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>رسالة إضافية (اختياري)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="أي معلومات إضافية تساعد في التعرف عليك..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{message.length}/500</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={handleSubmitMessage}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>إرسال الرسالة</Text>
              </>
            )}
          </TouchableOpacity>

          {/* WhatsApp Button */}
          <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
            <Text style={styles.whatsappButtonText}>تواصل عبر WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressContainer: {
    marginTop: 60,
    marginBottom: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: "SF Arabic",
  },
  infoCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontFamily: "SF Arabic",
  },
  infoValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  textArea: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    minHeight: 120,
    fontFamily: "SF Arabic",
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "left",
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  whatsappButton: {
    backgroundColor: colors.whatsapp,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  whatsappButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: "SF Arabic",
  },
});