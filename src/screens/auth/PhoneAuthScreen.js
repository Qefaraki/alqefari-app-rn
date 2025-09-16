import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas, Circle } from "@shopify/react-native-skia";
import { Ionicons } from "@expo/vector-icons";

import { phoneAuthService } from "../../services/phoneAuth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const createStarfield = (count) => {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 1.8 + 0.4,
      opacity: 0.25 + Math.random() * 0.4,
    });
  }
  return stars;
};

export default function PhoneAuthScreen({ navigation }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [focusedField, setFocusedField] = useState(null);

  const otpInputs = useRef([]);
  const countdownInterval = useRef(null);
  const backgroundPan = useRef(new Animated.Value(0)).current;
  const stepProgress = useRef(new Animated.Value(0)).current;

  const stars = useMemo(() => createStarfield(80), []);

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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundPan, {
          toValue: 1,
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundPan, {
          toValue: -1,
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
      backgroundPan.stopAnimation();
    };
  }, [backgroundPan]);

  useEffect(() => {
    Animated.timing(stepProgress, {
      toValue: step === "otp" ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, stepProgress]);

  const handleSendOTP = async () => {
    if (phoneNumber.length < 7) {
      Alert.alert("خطأ", "يرجى إدخال رقم هاتف صحيح");
      return;
    }

    setLoading(true);

    const result = await phoneAuthService.sendOTP(phoneNumber);

    if (result.success) {
      setStep("otp");
      setCountdown(60);

      const formattedForDisplay =
        result.formattedPhone ||
        phoneAuthService.formatPhoneNumber(phoneNumber);
      Alert.alert(
        "نجح",
        `تم إرسال رمز التحقق إلى ${toArabicNumerals(formattedForDisplay)}`,
      );
    } else {
      Alert.alert("خطأ", result.error);
    }

    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      Alert.alert("خطأ", "يرجى إدخال رمز التحقق كاملاً");
      return;
    }

    setLoading(true);
    const result = await phoneAuthService.verifyOTP(phoneNumber, otpCode);

    if (result.success) {
      if (result.hasProfile) {
        navigation.replace("Main");
      } else {
        navigation.replace("NameChainEntry", { user: result.user });
      }
    } else {
      Alert.alert("خطأ", result.error);
      setOtp(["", "", "", "", "", ""]);
      otpInputs.current[0]?.focus();
    }

    setLoading(false);
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setLoading(true);
    const result = await phoneAuthService.resendOTP();

    if (result.success) {
      setCountdown(60);
      Alert.alert("نجح", result.message);
    } else {
      Alert.alert("خطأ", result.error);
    }
    setLoading(false);
  };

  const handleOtpChange = (value, index) => {
    const normalizedValue = fromArabicNumerals(value);
    const digitOnly = normalizedValue.replace(/\D/g, "").slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digitOnly;
    setOtp(newOtp);

    if (digitOnly && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    if (index === 5 && digitOnly) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        Keyboard.dismiss();
        handleVerifyOTP();
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
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

  const fromArabicNumerals = (str) => {
    return phoneAuthService.convertArabicNumbers(str || "");
  };

  const formatPhoneDisplay = (phone) => {
    const normalized = fromArabicNumerals(phone);
    const cleaned = normalized.replace(/\D/g, "");

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

  const phoneStepStyle = {
    opacity: stepProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateX: stepProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -24],
        }),
      },
    ],
  };

  const otpStepStyle = {
    opacity: stepProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateX: stepProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const backgroundTranslate = {
    transform: [
      {
        translateX: backgroundPan.interpolate({
          inputRange: [-1, 1],
          outputRange: [-36, 36],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#030303", "#0d0d19", "#030303"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.starLayer, backgroundTranslate]}
      >
        <Canvas style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
          {stars.map((star, index) => (
            <Circle
              key={`star-${index}`}
              cx={star.x}
              cy={star.y}
              r={star.size}
              color={`rgba(249, 247, 243, ${star.opacity})`}
            />
          ))}
        </Canvas>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.avoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.headerCard}>
            <View style={styles.headerIconWrapper}>
              <Image
                source={require("../../../assets/logo/STAR_LOGO.png")}
                style={styles.headerIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.headerTitle}>شجرة عائلة القفاري</Text>
            <Text style={styles.headerSubtitle}>لكل عائلة حكاية تبدأ من هنا</Text>
          </View>

          <View style={styles.card}>
            <Animated.View
              pointerEvents={step === "phone" ? "auto" : "none"}
              style={[styles.stepContainer, phoneStepStyle]}
            >
              <Text style={styles.title}>أدخل رقم هاتفك المحمول</Text>
              <Text style={styles.description}>
                سنرسل لك رمز تحقق للتأكد من هويتك
              </Text>

              <View
                style={[
                  styles.phoneInputContainer,
                  focusedField === "phone" && styles.inputFocused,
                ]}
              >
                <View style={styles.countryCode}>
                  <Ionicons name="call" size={18} color="#A13333" />
                  <Text style={styles.countryCodeText}>+٩٦٦</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="٥٠ ١٢٣ ٤٥٦٧"
                  placeholderTextColor="rgba(36, 33, 33, 0.4)"
                  value={formatPhoneDisplay(phoneNumber)}
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(text) => {
                    const normalized = fromArabicNumerals(text);
                    const digitsOnly = normalized.replace(/\D/g, "");
                    setPhoneNumber(digitsOnly);
                  }}
                  keyboardType="phone-pad"
                  maxLength={15}
                  textAlign="right"
                />
              </View>

              <Text style={styles.helperText}>
                يمكنك إدخال الرقم بأي صيغة: ٠٥، ٥، +٩٦٦، ٠٠٩٦٦
              </Text>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!phoneNumber || loading) && styles.primaryButtonDisabled,
                ]}
                onPress={handleSendOTP}
                disabled={loading || !phoneNumber}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#F9F7F3" />
                ) : (
                  <Text style={styles.primaryButtonText}>إرسال رمز التحقق</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.replace("Main")}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>تخطي - المشاهدة فقط</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              pointerEvents={step === "otp" ? "auto" : "none"}
              style={[styles.stepContainer, styles.otpStep, otpStepStyle]}
            >
              <Text style={styles.title}>أدخل رمز التحقق</Text>
              <Text style={styles.description}>
                تم إرسال رمز مكون من ٦ أرقام إلى
              </Text>
              <Text style={styles.phoneDisplay}>
                {phoneAuthService.formatPhoneNumber(phoneNumber)}
              </Text>

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpInputs.current[index] = ref)}
                    style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled,
                      focusedField === `otp-${index}` && styles.inputFocused,
                    ]}
                    value={digit}
                    onFocus={() => setFocusedField(`otp-${index}`)}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(value) =>
                      handleOtpChange(value.replace(/\D/g, ""), index)
                    }
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (otp.join("").length !== 6 || loading) &&
                    styles.primaryButtonDisabled,
                ]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.join("").length !== 6}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#F9F7F3" />
                ) : (
                  <Text style={styles.primaryButtonText}>تحقق</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    إعادة الإرسال بعد {countdown} ثانية
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                    <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.changeNumberButton}
                onPress={() => {
                  setStep("phone");
                  setOtp(["", "", "", "", "", ""]);
                  setCountdown(0);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.changeNumberText}>تغيير رقم الهاتف</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030303",
  },
  avoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  starLayer: {
    opacity: 0.65,
  },
  headerCard: {
    marginTop: 32,
    alignItems: "center",
  },
  headerIconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(209, 187, 163, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(209, 187, 163, 0.4)",
  },
  headerIcon: {
    width: 56,
    height: 56,
    tintColor: "#F9F7F3",
  },
  headerTitle: {
    fontFamily: "SF Arabic",
    fontWeight: "700",
    fontSize: 22,
    letterSpacing: -0.5,
    color: "#F9F7F3",
    textAlign: "center",
    writingDirection: "rtl",
  },
  headerSubtitle: {
    fontFamily: "SF Arabic",
    fontWeight: "400",
    fontSize: 15,
    color: "rgba(249, 247, 243, 0.75)",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    writingDirection: "rtl",
  },
  card: {
    backgroundColor: "#F9F7F3",
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(209, 187, 163, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    minHeight: 360,
    justifyContent: "center",
  },
  stepContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  otpStep: {
    paddingTop: 12,
  },
  title: {
    fontFamily: "SF Arabic",
    fontWeight: "700",
    fontSize: 20,
    color: "#242121",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 12,
    writingDirection: "rtl",
  },
  description: {
    fontFamily: "SF Arabic",
    fontWeight: "400",
    fontSize: 15,
    color: "rgba(36, 33, 33, 0.7)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    writingDirection: "rtl",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(209, 187, 163, 0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(209, 187, 163, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: "rgba(209, 187, 163, 0.4)",
    marginRight: 12,
    gap: 6,
  },
  countryCodeText: {
    fontFamily: "SF Arabic",
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
  },
  phoneInput: {
    flex: 1,
    fontFamily: "SF Arabic",
    fontSize: 16,
    fontWeight: "500",
    color: "#242121",
    paddingVertical: 12,
    writingDirection: "rtl",
  },
  helperText: {
    fontFamily: "SF Arabic",
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(36, 33, 33, 0.6)",
    textAlign: "center",
    marginBottom: 24,
    writingDirection: "rtl",
  },
  primaryButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontFamily: "SF Arabic",
    fontSize: 16,
    fontWeight: "600",
    color: "#F9F7F3",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D1BBA3",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: "SF Arabic",
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    writingDirection: "rtl",
  },
  phoneDisplay: {
    fontFamily: "SF Arabic",
    fontSize: 18,
    fontWeight: "600",
    color: "#242121",
    textAlign: "center",
    marginBottom: 24,
    writingDirection: "rtl",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: "rgba(209, 187, 163, 0.4)",
    backgroundColor: "rgba(209, 187, 163, 0.2)",
    fontFamily: "SF Arabic",
    fontSize: 20,
    color: "#242121",
  },
  otpInputFilled: {
    borderColor: "#A13333",
    backgroundColor: "rgba(161, 51, 51, 0.08)",
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  countdownText: {
    fontFamily: "SF Arabic",
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(36, 33, 33, 0.6)",
    writingDirection: "rtl",
  },
  resendText: {
    fontFamily: "SF Arabic",
    fontSize: 15,
    fontWeight: "600",
    color: "#A13333",
    writingDirection: "rtl",
  },
  changeNumberButton: {
    alignItems: "center",
    marginTop: 8,
  },
  changeNumberText: {
    fontFamily: "SF Arabic",
    fontSize: 15,
    fontWeight: "600",
    color: "#242121",
    writingDirection: "rtl",
  },
  inputFocused: {
    borderColor: "#957EB5",
    shadowColor: "#957EB5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});
