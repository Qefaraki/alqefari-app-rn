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
  ActivityIndicator,
  Animated,
  StatusBar,
  Modal,
  FlatList,
  I18nManager,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { OtpInput } from "react-native-otp-entry";
import DuolingoProgressBar from "../../components/DuolingoProgressBar";

import { phoneAuthService } from "../../services/phoneAuth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  alJassWhite: "#F9F7F3",
  camelHairBeige: "#D1BBA3",
  saduNight: "#242121",
  najdiCrimson: "#A13333",
  desertOchre: "#D58C4A",
  focus: "#957EB5",
};

// Country codes list - English numbers only
const countryCodes = [
  { code: "+966", country: "السعودية", flag: "🇸🇦", key: "SA" },
  { code: "+971", country: "الإمارات", flag: "🇦🇪", key: "AE" },
  { code: "+965", country: "الكويت", flag: "🇰🇼", key: "KW" },
  { code: "+973", country: "البحرين", flag: "🇧🇭", key: "BH" },
  { code: "+974", country: "قطر", flag: "🇶🇦", key: "QA" },
  { code: "+968", country: "عُمان", flag: "🇴🇲", key: "OM" },
  { code: "+20", country: "مصر", flag: "🇪🇬", key: "EG" },
  { code: "+962", country: "الأردن", flag: "🇯🇴", key: "JO" },
  { code: "+1", country: "أمريكا", flag: "🇺🇸", key: "US" },
  { code: "+44", country: "بريطانيا", flag: "🇬🇧", key: "GB" },
];

export default function NajdiPhoneAuthScreen({ navigation, onOTPSent }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]); // Saudi default
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [otp, setOtp] = useState(""); // Changed to string for the library
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  // Ref for OTP input
  const otpRef = useRef(null);
  const countdownInterval = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const stepProgress = useRef(new Animated.Value(0)).current;

  // Screen entry animation
  useEffect(() => {
    // Always show content immediately
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Step transition
  useEffect(() => {
    Animated.timing(stepProgress, {
      toValue: step === "otp" ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // The new library handles auto-focus
  }, [step]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [countdown]);

  const shakeError = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(errorShake, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatPhoneDisplay = (text) => {
    // Simply return the digits without spacing for display
    // This prevents confusing cursor jumps while typing
    return text;
  };

  const handlePhoneChange = (text) => {
    // Only allow digits
    const digitsOnly = text.replace(/\D/g, "");
    setPhoneNumber(digitsOnly.slice(0, 9)); // Max 9 digits for Saudi numbers
  };

  const handleSendOTP = async () => {
    if (phoneNumber.length < 7) {
      setError("يرجى إدخال رقم هاتف صحيح");
      shakeError();
      return;
    }

    setLoading(true);
    setError("");

    // Add country code to phone number
    const fullNumber = selectedCountry.code + phoneNumber;
    const result = await phoneAuthService.sendOTP(fullNumber);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
      setCountdown(60);
      // Trigger shooting star immediately when OTP is sent
      if (onOTPSent) onOTPSent();
    } else {
      setError(result.error || "حدث خطأ في إرسال الرمز");
      shakeError();
    }

    setLoading(false);
    buttonPulse.stopAnimation();
    buttonPulse.setValue(1);
  };

  const handleOtpChange = (value) => {
    // Clear error when user starts typing
    if (error) setError("");

    // Only allow digits and limit to 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);

    // Auto-submit when 6 digits entered
    if (digits.length === 6) {
      Keyboard.dismiss();
      handleVerifyOTP(digits); // Pass the string directly
    }
  };

  const handleVerifyOTP = async (otpCode = otp) => {
    // otpCode is now already a string
    if (otpCode.length !== 6) {
      setError("يرجى إدخال رمز التحقق كاملاً (٦ أرقام)");
      shakeError();
      return;
    }

    setLoading(true);
    setError("");

    const fullNumber = selectedCountry.code + phoneNumber;
    const result = await phoneAuthService.verifyOTP(fullNumber, otpCode);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate immediately without delay
      navigation.navigate("NameChainEntry", { user: result.user });
    } else {
      // Better error messages
      let errorMessage = "رمز التحقق غير صحيح";
      if (result.error?.includes("expired")) {
        errorMessage = "انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد";
      } else if (result.error?.includes("attempts")) {
        errorMessage = "تم تجاوز عدد المحاولات المسموح، يرجى الانتظار قليلاً";
      } else if (result.error?.includes("invalid")) {
        errorMessage = "رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى";
      }

      setError(errorMessage);
      shakeError();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Clear OTP and refocus immediately
      setOtp("");
      if (otpRef.current) {
        otpRef.current.clear();
        setTimeout(() => otpRef.current?.focus(), 100);
      }
    }

    setLoading(false);
    buttonPulse.stopAnimation();
    buttonPulse.setValue(1);
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setError("");

    const result = await phoneAuthService.resendOTP();

    if (result.success) {
      setCountdown(60);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setError(result.error || "حدث خطأ في إعادة الإرسال");
      shakeError();
    }

    setLoading(false);
    buttonPulse.stopAnimation();
    buttonPulse.setValue(1);
  };

  const CountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCountryPicker(false)}
      >
        <BlurView intensity={80} style={styles.modalBlur}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر رمز الدولة</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.alJassWhite} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCodes}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.key === item.key &&
                      styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.country}</Text>
                  </View>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );

  // Phone step opacity/transform
  const phoneStepStyle = {
    opacity: stepProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateX: stepProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
  };

  // OTP step opacity/transform
  const otpStepStyle = {
    opacity: stepProgress,
    transform: [
      {
        translateX: stepProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.avoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <Animated.View
              style={[
                styles.cardWrapper,
                {
                  opacity: fadeAnim,
                  transform: [
                    { scale: cardScale },
                    { translateY: slideAnim },
                    { translateX: errorShake },
                  ],
                },
              ]}
            >
              {/* Glass card with blur */}
              <BlurView intensity={20} tint="dark" style={styles.card}>
                <Animated.View
                  style={[styles.cardInner, { opacity: contentOpacity }]}
                >
                  {/* Header row with back button and progress bar */}
                  <View style={styles.headerRow}>
                    {/* Back button - on RIGHT in RTL */}
                    <TouchableOpacity
                      style={styles.backButtonNew}
                      onPress={() => navigation.goBack()}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={28}
                        color={colors.alJassWhite + "CC"}
                      />
                    </TouchableOpacity>

                    {/* Progress bar - fills remaining space */}
                    <View style={styles.progressBarContainer}>
                      <DuolingoProgressBar
                        currentStep={step === "phone" ? 1 : 2}
                        totalSteps={5}
                        showStepCount={true}
                      />
                    </View>
                  </View>

                  {/* Step container */}
                  <View style={styles.stepContainer}>
                    {/* Phone Number Step */}
                    {step === "phone" && (
                      <Animated.View style={[styles.step, phoneStepStyle]}>
                        <View style={styles.iconContainer}>
                          <Image
                            source={require("../../../assets/logo/AlqefariEmblem.png")}
                            style={styles.logoIcon}
                            resizeMode="contain"
                          />
                        </View>

                        <Text style={styles.title}>أدخل رقم هاتفك</Text>
                        <Text style={styles.subtitle}>
                          سنرسل لك رمز التحقق للدخول
                        </Text>

                        <View style={styles.phoneInputWrapper}>
                          {/* Phone Number Input */}
                          <TextInput
                            style={[
                              styles.phoneInput,
                              {
                                textAlign: "left",
                                writingDirection: "ltr",
                              },
                            ]}
                            placeholder="50 123 4567"
                            placeholderTextColor={colors.alJassWhite + "40"}
                            value={formatPhoneDisplay(phoneNumber)}
                            onChangeText={handlePhoneChange}
                            keyboardType="number-pad"
                            maxLength={11} // 9 digits + 2 spaces
                            returnKeyType="done"
                            onSubmitEditing={handleSendOTP}
                          />

                          {/* Country Code Selector */}
                          <TouchableOpacity
                            style={styles.countrySelector}
                            onPress={() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              setShowCountryPicker(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.countryFlag}>
                              {selectedCountry.flag}
                            </Text>
                            <Text style={styles.countryCodeText}>
                              {selectedCountry.code}
                            </Text>
                            <Ionicons
                              name="chevron-down"
                              size={16}
                              color={colors.alJassWhite + "99"}
                            />
                          </TouchableOpacity>
                        </View>

                        {error && <Text style={styles.errorText}>{error}</Text>}

                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            (!phoneNumber || loading) && styles.buttonDisabled,
                          ]}
                          onPress={handleSendOTP}
                          disabled={!phoneNumber || loading}
                          activeOpacity={0.8}
                        >
                          {loading ? (
                            <Animated.Text
                              style={[
                                styles.buttonText,
                                { opacity: buttonPulse },
                              ]}
                            >
                              جاري الإرسال...
                            </Animated.Text>
                          ) : (
                            <Text style={styles.buttonText}>
                              إرسال رمز التحقق
                            </Text>
                          )}
                        </TouchableOpacity>
                      </Animated.View>
                    )}

                    {/* OTP Step */}
                    {step === "otp" && (
                      <Animated.View style={[styles.step, otpStepStyle]}>
                        <View style={styles.iconContainer}>
                          <Image
                            source={require("../../../assets/logo/AlqefariEmblem.png")}
                            style={styles.logoIcon}
                            resizeMode="contain"
                          />
                        </View>

                        <Text style={styles.title}>أدخل رمز التحقق</Text>
                        <Text style={styles.subtitle}>
                          تم إرسال الرمز إلى{"\n"}
                          <Text style={styles.phoneDisplay}>
                            {selectedCountry.code}{" "}
                            {formatPhoneDisplay(phoneNumber)}
                          </Text>
                        </Text>

                        <OtpInput
                          ref={otpRef}
                          numberOfDigits={6}
                          focusColor={colors.alJassWhite}
                          focusStickBlinkingDuration={400}
                          onTextChange={handleOtpChange}
                          onFilled={(code) => handleVerifyOTP(code)}
                          type="numeric"
                          autoFocus={true}
                          hideStick={false}
                          blurOnFilled={false}
                          disabled={loading}
                          theme={{
                            containerStyle: styles.otpContainer,
                            pinCodeContainerStyle: styles.otpInput,
                            pinCodeTextStyle: styles.otpText,
                            focusStickStyle: styles.otpCursor,
                            focusedPinCodeContainerStyle:
                              styles.otpInputFocused,
                            filledPinCodeContainerStyle: styles.otpInputFilled,
                          }}
                          textInputProps={{
                            keyboardType: "number-pad",
                            textContentType: "oneTimeCode",
                            autoComplete: "one-time-code",
                          }}
                        />

                        {error && <Text style={styles.errorText}>{error}</Text>}

                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            (otp.length !== 6 || loading) &&
                              styles.buttonDisabled,
                          ]}
                          onPress={() => handleVerifyOTP()}
                          disabled={otp.length !== 6 || loading}
                          activeOpacity={0.8}
                        >
                          {loading ? (
                            <Animated.Text
                              style={[
                                styles.buttonText,
                                { opacity: buttonPulse },
                              ]}
                            >
                              جاري التحقق...
                            </Animated.Text>
                          ) : (
                            <Text style={styles.buttonText}>تحقق</Text>
                          )}
                        </TouchableOpacity>

                        <View style={styles.resendContainer}>
                          {countdown > 0 ? (
                            <Text style={styles.countdownText}>
                              إعادة الإرسال بعد {countdown} ثانية
                            </Text>
                          ) : (
                            <TouchableOpacity
                              onPress={handleResendOTP}
                              disabled={loading}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.resendText}>
                                إعادة إرسال الرمز
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.changeNumberButton}
                          onPress={() => {
                            setStep("phone");
                            setOtp("");
                            setCountdown(0);
                            setError("");
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.changeNumberText}>
                            تغيير رقم الهاتف
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              </BlurView>
            </Animated.View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <CountryPicker />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent", // Changed to transparent for persistent backdrop
  },
  avoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row", // Native RTL handles this - flows right-to-left
    alignItems: "center",
    marginBottom: 28,
    marginTop: -8,
    marginHorizontal: -8,
    height: 44, // Fixed height to match back button
  },
  backButtonNew: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12, // In native RTL, this becomes margin on the right side
  },
  progressBarContainer: {
    flex: 1,
    height: 44,
    justifyContent: "center", // Center progress bar vertically
    paddingRight: 12, // Add padding to keep progress bar away from edge
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardInner: {
    backgroundColor: "rgba(36, 33, 33, 0.4)",
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(249, 247, 243, 0.3)",
  },
  progressDotActive: {
    backgroundColor: colors.najdiCrimson,
    width: 24, // Elongated when active like NameChainEntry
  },
  progressDotCompleted: {
    backgroundColor: colors.desertOchre, // Desert Ochre for completed steps (matches our design)
    width: 8,
  },
  stepContainer: {
    minHeight: 380,
  },
  step: {
    alignItems: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.najdiCrimson + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.najdiCrimson + "40",
  },
  logoIcon: {
    width: 40,
    height: 40,
    tintColor: colors.alJassWhite,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite + "99",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  phoneDisplay: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.najdiCrimson,
  },
  phoneInputWrapper: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
    width: "100%",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  otpContainer: {
    flexDirection: "row-reverse", // RTL direction
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
    width: "100%",
  },
  otpInput: {
    width: 45,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpInputFilled: {
    borderColor: colors.najdiCrimson + "80",
    backgroundColor: colors.najdiCrimson + "15",
  },
  otpInputFocused: {
    borderColor: colors.alJassWhite, // Al-Jass White from our design system
    borderWidth: 2,
    backgroundColor: "rgba(249, 247, 243, 0.1)", // Al-Jass White with 10% opacity
  },
  otpInputError: {
    borderColor: "#FF6B6B",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
  },
  otpText: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
    textAlign: "center",
  },
  otpCursor: {
    width: 3,
    height: 24,
    backgroundColor: colors.alJassWhite,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 16,
    marginTop: 8,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  primaryButton: {
    backgroundColor: colors.najdiCrimson,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    minHeight: 52,
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite + "60",
  },
  resendText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.najdiCrimson,
  },
  changeNumberButton: {
    alignItems: "center",
  },
  changeNumberText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite + "99",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
  },
  modalBlur: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "rgba(36, 33, 33, 0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  countryItemSelected: {
    backgroundColor: colors.najdiCrimson + "15",
  },
  countryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countryName: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite + "99",
  },
});
