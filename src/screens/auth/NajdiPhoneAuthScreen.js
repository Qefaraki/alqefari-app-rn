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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import SaduNightBackdrop from "../../components/ui/SaduNightBackdrop";
import { phoneAuthService } from "../../services/phoneAuth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  alJassWhite: "#F9F7F3",
  camelHairBeige: "#D1BBA3",
  saduNight: "#242121",
  najdiCrimson: "#A13333",
  desertOchre: "#D58C4A",
  focus: "#957EB5",
};

// Country codes list
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

export default function NajdiPhoneAuthScreen({ navigation }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]); // Saudi default
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  const otpInputs = useRef([]);
  const countdownInterval = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const vignetteOpacity = useRef(new Animated.Value(0)).current;

  // Screen entry animation
  useEffect(() => {
    // Entry animation sequence
    Animated.sequence([
      // Wait a moment
      Animated.delay(100),
      // Fade in vignette
      Animated.timing(vignetteOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Card entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Step transition animation
  useEffect(() => {
    Animated.spring(stepSlide, {
      toValue: step === "otp" ? -SCREEN_WIDTH : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
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
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, "");

    // Format based on length
    let formatted = "";
    if (cleaned.length <= 2) {
      formatted = cleaned;
    } else if (cleaned.length <= 5) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    } else if (cleaned.length <= 9) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    } else {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)}`;
    }

    return formatted;
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
    } else {
      setError(result.error || "حدث خطأ في إرسال الرمز");
      shakeError();
    }

    setLoading(false);
  };

  const handleOtpChange = (value, index) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && digit) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        Keyboard.dismiss();
        handleVerifyOTP(newOtp);
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpArray = otp) => {
    const otpCode = otpArray.join("");
    if (otpCode.length !== 6) {
      setError("يرجى إدخال رمز التحقق كاملاً");
      shakeError();
      return;
    }

    setLoading(true);
    setError("");

    const fullNumber = selectedCountry.code + phoneNumber;
    const result = await phoneAuthService.verifyOTP(fullNumber, otpCode);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.hasProfile) {
        navigation.replace("Main");
      } else {
        navigation.replace("NameChainEntry", { user: result.user });
      }
    } else {
      setError(result.error || "رمز التحقق غير صحيح");
      shakeError();
      setOtp(["", "", "", "", "", ""]);
      otpInputs.current[0]?.focus();
    }

    setLoading(false);
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
  };

  const toArabicNumerals = (str) => {
    const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
    const westernNumerals = "0123456789";

    let result = str || "";
    for (let i = 0; i < 10; i++) {
      const regex = new RegExp(westernNumerals[i], "g");
      result = result.replace(regex, arabicNumerals[i]);
    }
    return result;
  };

  const CountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>اختر رمز الدولة</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color={colors.saduNight} />
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
                <Text style={styles.countryCode}>
                  {toArabicNumerals(item.code)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Starry Night Background */}
      <SaduNightBackdrop
        starCount={120}
        starOpacity={0.56}
        parallaxOffset={20}
      />

      {/* Dark Vignette at bottom */}
      <Animated.View
        style={[styles.vignette, { opacity: vignetteOpacity }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.85)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.avoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={colors.alJassWhite}
            />
          </TouchableOpacity>

          <View style={styles.contentContainer}>
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { scale: cardScale },
                    { translateX: errorShake },
                  ],
                },
              ]}
            >
              {/* Progress indicator */}
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressDot,
                    step === "phone" && styles.progressDotActive,
                  ]}
                />
                <View style={styles.progressLine} />
                <View
                  style={[
                    styles.progressDot,
                    step === "otp" && styles.progressDotActive,
                  ]}
                />
              </View>

              {/* Sliding container for steps */}
              <View style={styles.stepWrapper}>
                <Animated.View
                  style={[
                    styles.stepContainer,
                    {
                      transform: [{ translateX: stepSlide }],
                    },
                  ]}
                >
                  {/* Phone Number Step */}
                  <View style={styles.step}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="call"
                        size={28}
                        color={colors.najdiCrimson}
                      />
                    </View>

                    <Text style={styles.title}>أدخل رقم هاتفك</Text>
                    <Text style={styles.subtitle}>
                      سنرسل لك رمز التحقق للدخول
                    </Text>

                    <View style={styles.phoneInputWrapper}>
                      {/* Country Code Selector */}
                      <TouchableOpacity
                        style={styles.countrySelector}
                        onPress={() => setShowCountryPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.countryFlag}>
                          {selectedCountry.flag}
                        </Text>
                        <Text style={styles.countryCodeText}>
                          {toArabicNumerals(selectedCountry.code)}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={colors.saduNight}
                        />
                      </TouchableOpacity>

                      {/* Phone Number Input */}
                      <TextInput
                        style={[styles.phoneInput, { textAlign: "left" }]} // Force LTR for numbers
                        placeholder="50 123 4567"
                        placeholderTextColor={colors.saduNight + "40"}
                        value={formatPhoneDisplay(phoneNumber)}
                        onChangeText={handlePhoneChange}
                        keyboardType="number-pad"
                        maxLength={11} // 9 digits + 2 spaces
                        returnKeyType="done"
                        onSubmitEditing={handleSendOTP}
                      />
                    </View>

                    {error && step === "phone" && (
                      <Text style={styles.errorText}>{error}</Text>
                    )}

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
                        <ActivityIndicator color={colors.alJassWhite} />
                      ) : (
                        <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => navigation.replace("Main")}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.skipText}>تخطي - المشاهدة فقط</Text>
                    </TouchableOpacity>
                  </View>

                  {/* OTP Step */}
                  <View style={styles.step}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="shield-checkmark"
                        size={28}
                        color={colors.desertOchre}
                      />
                    </View>

                    <Text style={styles.title}>أدخل رمز التحقق</Text>
                    <Text style={styles.subtitle}>
                      تم إرسال الرمز إلى{"\n"}
                      <Text style={styles.phoneDisplay}>
                        {toArabicNumerals(
                          selectedCountry.code +
                            " " +
                            formatPhoneDisplay(phoneNumber),
                        )}
                      </Text>
                    </Text>

                    <View style={styles.otpContainer}>
                      {otp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(ref) => (otpInputs.current[index] = ref)}
                          style={[
                            styles.otpInput,
                            digit && styles.otpInputFilled,
                          ]}
                          value={digit}
                          onChangeText={(value) =>
                            handleOtpChange(value, index)
                          }
                          onKeyPress={(e) => handleOtpKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={1}
                          textAlign="center"
                        />
                      ))}
                    </View>

                    {error && step === "otp" && (
                      <Text style={styles.errorText}>{error}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (otp.join("").length !== 6 || loading) &&
                          styles.buttonDisabled,
                      ]}
                      onPress={() => handleVerifyOTP()}
                      disabled={otp.join("").length !== 6 || loading}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.alJassWhite} />
                      ) : (
                        <Text style={styles.buttonText}>تحقق</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.resendContainer}>
                      {countdown > 0 ? (
                        <Text style={styles.countdownText}>
                          إعادة الإرسال بعد{" "}
                          {toArabicNumerals(countdown.toString())} ثانية
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
                        setOtp(["", "", "", "", "", ""]);
                        setCountdown(0);
                        setError("");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changeNumberText}>
                        تغيير رقم الهاتف
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
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
    backgroundColor: "#000",
  },
  avoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.25,
    zIndex: 1,
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(249, 247, 243, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.alJassWhite,
    borderRadius: 16,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.camelHairBeige + "40",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.camelHairBeige + "40",
  },
  progressDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.najdiCrimson,
  },
  progressLine: {
    width: 40,
    height: 1,
    backgroundColor: colors.camelHairBeige + "40",
    marginHorizontal: 8,
  },
  stepWrapper: {
    overflow: "hidden",
    height: 400,
  },
  stepContainer: {
    flexDirection: "row",
    width: SCREEN_WIDTH * 2 - 48,
  },
  step: {
    width: SCREEN_WIDTH - 80,
    paddingHorizontal: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.camelHairBeige + "20",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.camelHairBeige + "40",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.saduNight,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.saduNight + "99",
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
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.camelHairBeige + "20",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.camelHairBeige + "40",
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.saduNight,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.camelHairBeige + "20",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.saduNight,
    borderWidth: 1,
    borderColor: colors.camelHairBeige + "40",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  otpInput: {
    width: 42,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.camelHairBeige + "40",
    backgroundColor: colors.camelHairBeige + "20",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.saduNight,
  },
  otpInputFilled: {
    borderColor: colors.najdiCrimson,
    backgroundColor: colors.najdiCrimson + "08",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: colors.najdiCrimson,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 48,
    shadowColor: colors.najdiCrimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  skipButton: {
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.saduNight + "99",
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.saduNight + "60",
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
    color: colors.saduNight,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.alJassWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
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
    color: colors.saduNight,
  },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.camelHairBeige + "20",
  },
  countryItemSelected: {
    backgroundColor: colors.najdiCrimson + "08",
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
    color: colors.saduNight,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.saduNight + "99",
  },
});
