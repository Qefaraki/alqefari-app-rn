import React, { useState, useRef, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";

export default function PhoneAuthScreen({ navigation }) {
  const [step, setStep] = useState("phone"); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpInputs = useRef([]);
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [countdown]);

  const handleSendOTP = async () => {
    // Validate phone number - accept various lengths
    if (phoneNumber.length < 7) {
      Alert.alert("خطأ", "يرجى إدخال رقم هاتف صحيح");
      return;
    }

    setLoading(true);

    // The service will handle all formatting
    const result = await phoneAuthService.sendOTP(phoneNumber);

    if (result.success) {
      setStep("otp");
      setCountdown(60); // 60 seconds countdown

      // Show formatted number in success message
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
        // User has a linked profile, go to main app
        navigation.replace("Main");
      } else {
        // No profile linked, go to name chain entry
        navigation.replace("NameChainEntry", { user: result.user });
      }
    } else {
      Alert.alert("خطأ", result.error);
      // Clear OTP inputs
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
    // Convert Arabic numbers to Western
    const normalizedValue = fromArabicNumerals(value);
    const digitOnly = normalizedValue.replace(/\D/g, "").slice(-1); // Only keep last digit

    const newOtp = [...otp];
    newOtp[index] = digitOnly;
    setOtp(newOtp);

    // Auto-focus next input
    if (digitOnly && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
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

  /**
   * Convert Western numerals to Arabic numerals for display
   */
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

  /**
   * Convert Arabic numerals to Western for processing
   */
  const fromArabicNumerals = (str) => {
    return phoneAuthService.convertArabicNumbers(str || "");
  };

  const formatPhoneDisplay = (phone) => {
    // Convert Arabic numbers to Western for processing
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

    // Convert back to Arabic numerals for display if needed
    // You can toggle this based on user preference
    // return toArabicNumerals(formatted);
    return formatted;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Image
          source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
          style={styles.logo}
        />
        <Text style={styles.title}>شجرة عائلة القفاري</Text>
      </View>

      {step === "phone" ? (
        <View style={styles.content}>
          <Text style={styles.subtitle}>أدخل رقم هاتفك المحمول</Text>
          <Text style={styles.description}>
            سنرسل لك رمز تحقق للتأكد من هويتك
          </Text>

          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCode}>
              <Image
                source={{ uri: "https://flagcdn.com/w40/sa.png" }}
                style={styles.flag}
              />
              <Text style={styles.countryCodeText}>+٩٦٦</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="٥٠ ١٢٣ ٤٥٦٧"
              placeholderTextColor="#999"
              value={formatPhoneDisplay(phoneNumber)}
              onChangeText={(text) => {
                // Convert Arabic numbers to Western and keep only digits
                const normalized = fromArabicNumerals(text);
                const digitsOnly = normalized.replace(/\D/g, "");
                setPhoneNumber(digitsOnly);
              }}
              keyboardType="phone-pad"
              maxLength={15} // Increased to allow spaces and various formats
              textAlign="right"
            />
          </View>

          <Text style={styles.helperText}>
            يمكنك إدخال الرقم بأي صيغة: ٠٥، ٥، +٩٦٦، ٠٠٩٦٦
          </Text>

          <TouchableOpacity
            style={[styles.button, !phoneNumber && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading || !phoneNumber}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.replace("Main")}
          >
            <Text style={styles.skipText}>تخطي - المشاهدة فقط</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.subtitle}>أدخل رمز التحقق</Text>
          <Text style={styles.description}>
            تم إرسال رمز مكون من 6 أرقام إلى
          </Text>
          <Text style={styles.phoneDisplay}>
            {phoneAuthService.formatPhoneNumber(phoneNumber)}
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (otpInputs.current[index] = ref)}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                value={digit}
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
              styles.button,
              otp.join("").length !== 6 && styles.buttonDisabled,
            ]}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join("").length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="white" />
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
          >
            <Text style={styles.changeNumberText}>تغيير رقم الهاتف</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  phoneInputContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    backgroundColor: "#f8f8f8",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
  },
  flag: {
    width: 24,
    height: 18,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: "#1a1a1a",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: -10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    color: "#007AFF",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  phoneDisplay: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 30,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 30,
    gap: 10,
  },
  otpInput: {
    width: 45,
    height: 50,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  otpInputFilled: {
    borderColor: "#007AFF",
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  countdownText: {
    color: "#666",
    fontSize: 14,
  },
  resendText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  changeNumberButton: {
    alignItems: "center",
  },
  changeNumberText: {
    color: "#666",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
