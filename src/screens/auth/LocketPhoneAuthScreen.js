import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  SafeAreaView,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { phoneAuthService } from "../../services/phoneAuth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textMuted: "#24212199",
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  white: "#FFFFFF",
  error: "#DC2626",
  success: "#10B981",
};

export default function LocketPhoneAuthScreen({ navigation }) {
  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [otp, setOTP] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Refs for OTP inputs
  const otpInputs = useRef([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatPhoneDisplay = (value) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");

    // Format as Saudi number: 05XX XXX XXXX
    if (cleaned.length <= 4) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    } else {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (value) => {
    // Convert Arabic/Persian numerals to Western
    const normalized = phoneAuthService.normalizeArabicNumerals(value);
    const formatted = formatPhoneDisplay(normalized);
    setPhone(formatted);
    setError("");
  };

  const handleSendOTP = async () => {
    if (!phone || phone.replace(/\s/g, "").length < 10) {
      setError("الرجاء إدخال رقم جوال صحيح");
      shakeError();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanPhone = phone.replace(/\s/g, "");
      const { success, error } = await phoneAuthService.sendOTP(cleanPhone);

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep("otp");
        // Reset animations for OTP screen
        fadeAnim.setValue(0);
        slideAnim.setValue(30);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        setError(error || "حدث خطأ في إرسال رمز التحقق");
        shakeError();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      setError("حدث خطأ غير متوقع");
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (value, index) => {
    const normalized = phoneAuthService.normalizeArabicNumerals(value);
    const newOTP = [...otp];
    newOTP[index] = normalized.slice(-1); // Only take last character
    setOTP(newOTP);

    // Auto-focus next input
    if (normalized && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (index === 5 && normalized) {
      const fullOTP = [...newOTP.slice(0, 5), normalized].join("");
      if (fullOTP.length === 6) {
        handleVerifyOTP(fullOTP);
      }
    }
  };

  const handleOTPKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode = null) => {
    const code = otpCode || otp.join("");
    if (code.length !== 6) {
      setError("الرجاء إدخال رمز التحقق كاملاً");
      shakeError();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanPhone = phone.replace(/\s/g, "");
      const { success, user, error } = await phoneAuthService.verifyOTP(
        cleanPhone,
        code,
      );

      if (success) {
        // Success animation
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.spring(successScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start(() => {
          // Navigate to name chain entry
          navigation.replace("NameChainEntry", { phone: cleanPhone });
        });
      } else {
        setError(error || "رمز التحقق غير صحيح");
        shakeError();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      setError("حدث خطأ في التحقق");
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <Animated.View
      style={[
        styles.content,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
        },
      ]}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="call" size={32} color={colors.white} />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>رقم الجوال</Text>
      <Text style={styles.subtitle}>سنرسل لك رمز التحقق</Text>

      {/* Phone Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.countryCode}>+966</Text>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="05XX XXX XXXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={13}
          textAlign="right"
          autoFocus
        />
      </View>

      {/* Error */}
      {error && (
        <Animated.Text style={[styles.error, { opacity: fadeAnim }]}>
          {error}
        </Animated.Text>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderOTPStep = () => (
    <Animated.View
      style={[
        styles.content,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
        },
      ]}
    >
      {/* Success Check (hidden initially) */}
      <Animated.View
        style={[
          styles.successCheck,
          {
            transform: [{ scale: successScale }],
            opacity: successScale,
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={80} color={colors.success} />
      </Animated.View>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.secondary }]}
        >
          <Ionicons name="lock-closed" size={32} color={colors.white} />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>رمز التحقق</Text>
      <Text style={styles.subtitle}>أدخل الرمز المرسل إلى {phone}</Text>

      {/* OTP Inputs */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpInputs.current[index] = ref)}
            style={[styles.otpInput, digit && styles.otpInputFilled]}
            value={digit}
            onChangeText={(value) => handleOTPChange(value, index)}
            onKeyPress={(e) => handleOTPKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Error */}
      {error && (
        <Animated.Text style={[styles.error, { opacity: fadeAnim }]}>
          {error}
        </Animated.Text>
      )}

      {/* Resend */}
      <TouchableOpacity onPress={() => setStep("phone")}>
        <Text style={styles.resendText}>إعادة الإرسال</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Back Button */}
          {step === "otp" && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep("phone")}
            >
              <Ionicons name="arrow-forward" size={24} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Content */}
          {step === "phone" ? renderPhoneStep() : renderOTPStep()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.container + "40",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 40,
    fontFamily: "SF Arabic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  countryCode: {
    fontSize: 18,
    color: colors.text,
    marginRight: 12,
    fontFamily: "SF Arabic",
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  otpContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    backgroundColor: colors.white,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.container + "40",
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  resendText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: "SF Arabic",
    textDecorationLine: "underline",
  },
  successCheck: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
  },
});
