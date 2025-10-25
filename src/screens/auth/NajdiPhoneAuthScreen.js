import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
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
import { PhoneInputField } from "../../components/ui/PhoneInputField";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { phoneAuthService } from "../../services/phoneAuth";
import { useNetworkGuard } from "../../hooks/useNetworkGuard";
import { router } from "expo-router";

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

// Default Saudi country code (used as initial selection)
const DEFAULT_COUNTRY = { code: "+966", country: "السعودية", flag: "🇸🇦", key: "SA" };

export default function NajdiPhoneAuthScreen({ onOTPSent }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY); // Saudi default
  const [otp, setOtp] = useState(""); // Changed to string for the library
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const { checkBeforeAction } = useNetworkGuard();

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

  // Convert Arabic numerals to Western numerals (for OTP only)
  const convertArabicToWestern = (text) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const westernNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    let converted = text;
    for (let i = 0; i < arabicNumerals.length; i++) {
      converted = converted.replace(new RegExp(arabicNumerals[i], 'g'), westernNumerals[i]);
    }
    return converted;
  };

  const handleSendOTP = async () => {
    if (phoneNumber.length < 7) {
      setError("يرجى إدخال رقم هاتف صحيح");
      shakeError();
      return;
    }

    // NETWORK CHECK: Verify connection before sending OTP
    if (!checkBeforeAction('إرسال رمز التحقق')) {
      return; // User already shown alert
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

    // Convert Arabic numerals to Western first
    const convertedValue = convertArabicToWestern(value);
    // Only allow digits and limit to 4
    const digits = convertedValue.replace(/\D/g, "").slice(0, 4);
    setOtp(digits);

    // Auto-submit when 4 digits entered
    if (digits.length === 4) {
      Keyboard.dismiss();
      handleVerifyOTP(digits); // Pass the string directly
    }
  };

  const handleVerifyOTP = async (otpCode = otp) => {
    // otpCode is now already a string
    if (otpCode.length !== 4) {
      setError("يرجى إدخال رمز التحقق كاملاً (٦ أرقام)");
      shakeError();
      return;
    }

    // NETWORK CHECK: Verify connection before verifying OTP
    if (!checkBeforeAction('التحقق من الرمز')) {
      return; // User already shown alert
    }

    setLoading(true);
    setError("");

    const fullNumber = selectedCountry.code + phoneNumber;
    const result = await phoneAuthService.verifyOTP(fullNumber, otpCode);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // The AuthContext and NavigationController will handle all navigation
      // DO NOT manually navigate - let the state machine control the flow
      console.log('[DEBUG OTP] OTP verification successful');
      console.log('[DEBUG OTP] State machine and NavigationController will handle navigation');
      console.log('[DEBUG OTP] User will be automatically navigated to the correct screen');

      // Just set loading to false and let the auth state machine handle the rest
      setLoading(false);
      // Navigation happens automatically via NavigationController based on auth state
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

      <View style={styles.avoidingView}>
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
                    {/* Progress bar - FIRST so it appears on LEFT in RTL */}
                    <View style={styles.progressBarContainer}>
                      <DuolingoProgressBar
                        currentStep={step === "phone" ? 1 : 2}
                        totalSteps={5}
                        showStepCount={false}
                      />
                    </View>

                    {/* Back button - SECOND so it appears on RIGHT in RTL */}
                    <TouchableOpacity
                      style={styles.backButtonNew}
                      onPress={() => {
                        if (step === "otp") {
                          // Go back to phone step
                          setStep("phone");
                          setOtp("");
                          setError("");
                          setCountdown(0);
                        } else {
                          // Go back to onboarding
                          router.back();
                        }
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={28}
                        color={`${colors.alJassWhite  }CC`}
                      />
                    </TouchableOpacity>
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

                        <PhoneInputField
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          selectedCountry={selectedCountry}
                          onCountryChange={setSelectedCountry}
                          disabled={loading}
                          error={error}
                        />

                        <TouchableOpacity
                          testID="send-code-button"
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
                          numberOfDigits={4}
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
                          testID="verify-button"
                          style={[
                            styles.primaryButton,
                            (otp.length !== 4 || loading) &&
                              styles.buttonDisabled,
                          ]}
                          onPress={() => handleVerifyOTP()}
                          disabled={otp.length !== 4 || loading}
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
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              </BlurView>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
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
    marginBottom: 32,
    marginTop: 0,
    marginHorizontal: 0,
    height: 44, // Fixed height to match back button
  },
  backButtonNew: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8, // Small spacing between button and progress bar
  },
  progressBarContainer: {
    flex: 1,
    height: 44,
    justifyContent: "center", // Center progress bar vertically
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: "30%", // Push content up by 30% of screen height
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
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
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
    backgroundColor: `${colors.najdiCrimson  }20`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${colors.najdiCrimson  }40`,
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
    color: `${colors.alJassWhite  }99`,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  phoneDisplay: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.najdiCrimson,
  },
  otpContainer: {
    flexDirection: "row-reverse", // RTL direction
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
    width: "100%",
    paddingHorizontal: 20, // Add padding to match button width
  },
  otpInput: {
    width: 60, // Larger width for 4 digits
    height: 60, // Square boxes
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  otpInputFilled: {
    borderColor: `${colors.najdiCrimson  }80`,
    backgroundColor: `${colors.najdiCrimson  }15`,
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
    color: `${colors.alJassWhite  }60`,
  },
  resendText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.najdiCrimson,
  },
});
