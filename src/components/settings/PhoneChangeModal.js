/**
 * PhoneChangeModal - 4-Step Phone Number Change Flow
 *
 * Steps:
 * 1. Verify current phone (OTP)
 * 2. Enter new phone number
 * 3. Verify new phone (OTP)
 * 4. Complete change + audit log
 *
 * Reuses:
 * - PhoneInputField from components/ui/PhoneInputField
 * - OtpInput from react-native-otp-entry
 * - Design system colors and typography
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Keyboard,
  Alert,
} from 'react-native';
import { OtpInput } from 'react-native-otp-entry';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { PhoneInputField } from '../ui/PhoneInputField';
import { useNetworkGuard } from '../../hooks/useNetworkGuard';
import {
  sendCurrentPhoneOtp,
  verifyCurrentPhoneOtp,
  initiatePhoneChange,
  completePhoneChange,
  logPhoneChange,
  getCurrentUserPhone,
} from '../../services/phoneChange';

// Najdi Sadu Color Palette
const colors = {
  alJassWhite: '#F9F7F3',
  camelHairBeige: '#D1BBA3',
  saduNight: '#242121',
  najdiCrimson: '#A13333',
  desertOchre: '#D58C4A',
};

/**
 * PhoneChangeModal
 *
 * Props:
 * - isVisible: Boolean to show/hide modal
 * - onComplete: Callback when phone change completes (newPhone)
 * - onCancel: Callback when user cancels
 */
export function PhoneChangeModal({ isVisible = false, onComplete = () => {}, onCancel = () => {} }) {
  const { checkBeforeAction } = useNetworkGuard();
  const [step, setStep] = useState(1); // 1: Verify current, 2: Enter new, 3: Verify new, 4: Complete
  const [currentPhone, setCurrentPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [currentOtp, setCurrentOtp] = useState('');
  const [newOtp, setNewOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Refs
  const currentOtpRef = useRef(null);
  const newOtpRef = useRef(null);
  const countdownInterval = useRef(null);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Initialize modal - get current phone
  React.useEffect(() => {
    if (isVisible) {
      loadCurrentPhone();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      resetModal();
    }
  }, [isVisible]);

  // Countdown timer
  React.useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [countdown]);

  const loadCurrentPhone = async () => {
    try {
      const { success, phone } = await getCurrentUserPhone();
      if (success && phone) {
        setCurrentPhone(phone);
      }
    } catch (err) {
      console.error('Failed to load current phone:', err);
    }
  };

  const resetModal = () => {
    setStep(1);
    setCurrentPhone('');
    setNewPhone('');
    setSelectedCountry(null);
    setCurrentOtp('');
    setNewOtp('');
    setError('');
    setCountdown(0);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleCancel = () => {
    resetModal();
    onCancel();
  };

  // Step 1: Send OTP to current phone
  const handleSendCurrentOtp = async () => {
    if (!checkBeforeAction('إرسال رمز التحقق')) return;

    setLoading(true);
    setError('');

    try {
      await sendCurrentPhoneOtp(currentPhone);
      setCountdown(60);
      setStep(2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError('فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify current phone OTP
  const handleVerifyCurrentOtp = async () => {
    if (currentOtp.length !== 4) return;

    if (!checkBeforeAction('التحقق من الرمز')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      await verifyCurrentPhoneOtp(currentPhone, currentOtp);
      setStep(3);
      setCurrentOtp('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError('رمز التحقق غير صحيح');
      setCurrentOtp('');
      if (currentOtpRef.current) {
        currentOtpRef.current.clear();
        setTimeout(() => currentOtpRef.current?.focus(), 100);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Send OTP to new phone
  const handleSendNewOtp = async () => {
    if (!newPhone) {
      setError('يرجى إدخال رقم هاتف جديد');
      return;
    }

    if (newPhone === currentPhone.replace(/^\+/, '').replace(/[^\d]/g, '')) {
      setError('رقم الهاتف الجديد يجب أن يكون مختلفاً');
      return;
    }

    if (!checkBeforeAction('إرسال رمز التحقق')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      // Build full phone with country code
      const fullNewPhone = selectedCountry?.code + newPhone;
      const result = await initiatePhoneChange(fullNewPhone);

      if (!result.success) {
        if (result.rateLimitReached) {
          setError(result.message);
        } else {
          setError(result.error || 'فشل إرسال رمز التحقق');
        }
        return;
      }

      setCountdown(60);
      setStep(4);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError('فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete phone change
  const handleCompleteChange = async () => {
    if (newOtp.length !== 4) return;

    if (!checkBeforeAction('التحقق من الرمز')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      const fullNewPhone = selectedCountry?.code + newPhone;

      // Complete the phone change
      await completePhoneChange(fullNewPhone, newOtp);

      // Log to audit_log (non-blocking)
      logPhoneChange(currentPhone, fullNewPhone);

      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم التغيير', 'تم تغيير رقم الهاتف بنجاح.');

      // Reset and call completion callback
      resetModal();
      onComplete(fullNewPhone);
    } catch (err) {
      setError('رمز التحقق غير صحيح');
      setNewOtp('');
      if (newOtpRef.current) {
        newOtpRef.current.clear();
        setTimeout(() => newOtpRef.current?.focus(), 100);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
      setCountdown(0);
    }
  };

  const handleResendOtp = async () => {
    if (step === 2) {
      await handleSendCurrentOtp();
    } else if (step === 4) {
      await handleSendNewOtp();
    }
  };

  // Progress indicator
  const renderProgressDots = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((dot) => (
        <View
          key={dot}
          style={[
            styles.progressDot,
            step >= dot && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <BlurView intensity={80} style={styles.container}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <Animated.View
            style={[
              styles.modal,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}} // Prevent closing when tapping inside modal
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleBackStep}
                  disabled={step === 1}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={step === 1 ? 'transparent' : colors.alJassWhite}
                  />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>تغيير رقم الهاتف</Text>

                <TouchableOpacity
                  onPress={handleCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.alJassWhite} />
                </TouchableOpacity>
              </View>

              {/* Progress */}
              {renderProgressDots()}

              {/* Content */}
              <View style={styles.content}>
                {/* Step 1: Verify Current Phone */}
                {step === 1 && (
                  <View style={styles.step}>
                    <Text style={styles.title}>تأكيد رقمك الحالي</Text>
                    <Text style={styles.subtitle}>
                      سنرسل رمز تحقق إلى {currentPhone}
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleSendCurrentOtp}
                      disabled={loading || !currentPhone}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.alJassWhite} />
                      ) : (
                        <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 2: Enter Current Phone OTP */}
                {step === 2 && (
                  <View style={styles.step}>
                    <Text style={styles.title}>أدخل رمز التحقق</Text>
                    <Text style={styles.subtitle}>تم إرسال الرمز إلى {currentPhone}</Text>

                    <OtpInput
                      ref={currentOtpRef}
                      numberOfDigits={4}
                      focusColor={colors.alJassWhite}
                      onTextChange={setCurrentOtp}
                      onFilled={handleVerifyCurrentOtp}
                      type="numeric"
                      autoFocus={true}
                      disabled={loading}
                      theme={{
                        containerStyle: styles.otpContainer,
                        pinCodeContainerStyle: styles.otpInput,
                        pinCodeTextStyle: styles.otpText,
                        focusStickStyle: styles.otpCursor,
                        focusedPinCodeContainerStyle: styles.otpInputFocused,
                        filledPinCodeContainerStyle: styles.otpInputFilled,
                      }}
                      textInputProps={{
                        keyboardType: 'number-pad',
                        textContentType: 'oneTimeCode',
                      }}
                    />

                    {countdown > 0 ? (
                      <Text style={styles.countdownText}>
                        إعادة الإرسال بعد {countdown} ثانية
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={handleResendOtp}
                        disabled={loading}
                      >
                        <Text style={styles.resendButton}>إعادة إرسال الرمز</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Step 3: Enter New Phone */}
                {step === 3 && (
                  <View style={styles.step}>
                    <Text style={styles.title}>رقم الهاتف الجديد</Text>
                    <Text style={styles.subtitle}>
                      أدخل الرقم الجديد الذي تريد التحويل إليه
                    </Text>

                    <PhoneInputField
                      value={newPhone}
                      onChangeText={setNewPhone}
                      selectedCountry={selectedCountry || { code: '+966', country: 'السعودية', flag: '🇸🇦', key: 'SA' }}
                      onCountryChange={setSelectedCountry}
                      disabled={loading}
                      error={error}
                    />

                    <TouchableOpacity
                      style={[styles.button, (loading || !newPhone) && styles.buttonDisabled]}
                      onPress={handleSendNewOtp}
                      disabled={loading || !newPhone}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.alJassWhite} />
                      ) : (
                        <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 4: Verify New Phone OTP */}
                {step === 4 && (
                  <View style={styles.step}>
                    <Text style={styles.title}>تأكيد الرقم الجديد</Text>
                    <Text style={styles.subtitle}>
                      تم إرسال رمز التحقق إلى {selectedCountry?.code} {newPhone}
                    </Text>

                    <OtpInput
                      ref={newOtpRef}
                      numberOfDigits={4}
                      focusColor={colors.alJassWhite}
                      onTextChange={setNewOtp}
                      onFilled={handleCompleteChange}
                      type="numeric"
                      autoFocus={true}
                      disabled={loading}
                      theme={{
                        containerStyle: styles.otpContainer,
                        pinCodeContainerStyle: styles.otpInput,
                        pinCodeTextStyle: styles.otpText,
                        focusStickStyle: styles.otpCursor,
                        focusedPinCodeContainerStyle: styles.otpInputFocused,
                        filledPinCodeContainerStyle: styles.otpInputFilled,
                      }}
                      textInputProps={{
                        keyboardType: 'number-pad',
                        textContentType: 'oneTimeCode',
                      }}
                    />

                    {countdown > 0 ? (
                      <Text style={styles.countdownText}>
                        إعادة الإرسال بعد {countdown} ثانية
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={handleResendOtp}
                        disabled={loading}
                      >
                        <Text style={styles.resendButton}>إعادة إرسال الرمز</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Error message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: `${colors.saduNight}E6`,
    borderRadius: 20,
    width: '85%',
    maxWidth: 380,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
    flex: 1,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(249, 247, 243, 0.3)',
  },
  progressDotActive: {
    backgroundColor: colors.najdiCrimson,
  },
  content: {
    minHeight: 280,
  },
  step: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'SF Arabic',
    color: `${colors.alJassWhite}99`,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.najdiCrimson,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
  },
  otpContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  otpInput: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInputFilled: {
    borderColor: `${colors.najdiCrimson}80`,
    backgroundColor: `${colors.najdiCrimson}15`,
  },
  otpInputFocused: {
    borderColor: colors.alJassWhite,
    borderWidth: 2,
    backgroundColor: 'rgba(249, 247, 243, 0.1)',
  },
  otpText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
  },
  otpCursor: {
    width: 2,
    height: 20,
    backgroundColor: colors.alJassWhite,
  },
  countdownText: {
    fontSize: 12,
    fontFamily: 'SF Arabic',
    color: `${colors.alJassWhite}60`,
    textAlign: 'center',
    marginTop: 8,
  },
  resendButton: {
    fontSize: 14,
    fontFamily: 'SF Arabic',
    color: colors.najdiCrimson,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'SF Arabic',
    color: '#FF6B6B',
    flex: 1,
  },
});
