/**
 * PhoneChangeModal - 3-Step Phone Number Change Flow
 *
 * Steps:
 * 1. Verify current phone (OTP) - Auto-sent on open
 * 2. Enter new phone number
 * 3. Verify new phone (OTP)
 *
 * Flow:
 * - Modal opens → Auto-send OTP to current phone
 * - Show Step 1 OTP input immediately
 * - User verifies current phone → Step 2 (enter new phone)
 * - User enters new phone → Step 3 (verify new phone OTP auto-sent)
 * - Verify new phone → Complete change
 *
 * Reuses:
 * - PhoneInputField from components/ui/PhoneInputField
 * - OtpInput from react-native-otp-entry
 * - Design system colors and typography
 */

import React, { useState, useRef, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Easing,
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
  const [step, setStep] = useState(1); // 1: Verify current (OTP), 2: Enter new phone, 3: Verify new (OTP)
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

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(600)).current; // For slide-down close animation
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const resendScale = useRef(new Animated.Value(1)).current;

  // Initialize modal - get current phone and start animations
  useEffect(() => {
    if (isVisible) {
      loadCurrentPhone();

      // Slide in and fade in animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
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

  // Auto-send OTP when currentPhone is loaded
  useEffect(() => {
    if (isVisible && currentPhone && step === 1 && countdown === 0) {
      const autoSendTimer = setTimeout(() => {
        handleAutoSendCurrentOtp();
      }, 300);
      return () => clearTimeout(autoSendTimer);
    }
  }, [isVisible, currentPhone, step, countdown]);

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
    shakeAnim.setValue(0);
    successAnim.setValue(0);
    slideAnim.setValue(600);
    fadeAnim.setValue(0);
  };

  // Error shake animation (from NajdiPhoneAuthScreen pattern)
  const triggerErrorShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Success checkmark flash animation
  const triggerSuccessFlash = () => {
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCancel = () => {
    // Slide down and fade out animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      resetModal();
      onCancel();
    });
  };

  // Auto-send OTP to current phone when modal opens
  const handleAutoSendCurrentOtp = async () => {
    // Ensure currentPhone is loaded before attempting to send
    if (!currentPhone) {
      console.warn('[PhoneChange] Current phone not loaded yet, skipping auto-send');
      return;
    }

    if (!checkBeforeAction('إرسال رمز التحقق')) {
      return;
    }

    try {
      await sendCurrentPhoneOtp(currentPhone);
      setCountdown(60);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[PhoneChange] Auto-send OTP error:', err);
      setError('فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Step 1: Verify current phone OTP (auto-sent on open)
  const handleVerifyCurrentOtp = async (otpCode = currentOtp) => {
    if (otpCode.length !== 4) return;

    if (!checkBeforeAction('التحقق من الرمز')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      await verifyCurrentPhoneOtp(currentPhone, otpCode);
      triggerSuccessFlash();
      setStep(2);
      setCurrentOtp('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[PhoneChange] Verify current OTP error:', err);
      setError('رمز التحقق غير صحيح');
      triggerErrorShake();
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

  // Step 2: Auto-send OTP to new phone when entering Step 2
  const handleInitiateNewPhoneOtp = async () => {
    if (!newPhone) {
      setError('يرجى إدخال رقم هاتف جديد');
      return;
    }

    // Build full phone with country code and compare
    const fullNewPhone = selectedCountry?.code + newPhone;
    if (fullNewPhone === currentPhone) {
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
      setStep(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[PhoneChange] Initiate new phone OTP error:', err);
      setError('فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete phone change by verifying new phone OTP
  const handleCompleteChange = async (otpCode = newOtp) => {
    if (otpCode.length !== 4) return;

    if (!checkBeforeAction('التحقق من الرمز')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      const fullNewPhone = selectedCountry?.code + newPhone;

      // Complete the phone change
      await completePhoneChange(fullNewPhone, otpCode);

      // Log to audit_log (non-blocking)
      logPhoneChange(currentPhone, fullNewPhone);

      // Success animation
      triggerSuccessFlash();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم التغيير', 'تم تغيير رقم الهاتف بنجاح.');

      // Reset and call completion callback
      resetModal();
      onComplete(fullNewPhone);
    } catch (err) {
      console.error('[PhoneChange] Complete phone change error:', err);
      setError('رمز التحقق غير صحيح');
      triggerErrorShake();
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
    if (step === 1) {
      await handleAutoSendCurrentOtp();
    } else if (step === 3) {
      await handleInitiateNewPhoneOtp();
    }
  };

  // Progress indicator with animation (3 steps)
  const renderProgressDots = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((dot) => {
        const isActive = step >= dot;
        return (
          <Animated.View
            key={dot}
            style={[
              styles.progressDot,
              isActive && styles.progressDotActive,
              {
                transform: [
                  {
                    scale: isActive ? 1.15 : 1,
                  },
                ],
                opacity: isActive ? 1 : 0.4,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <BlurView intensity={7} style={styles.container}>
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
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {}} // Prevent closing when tapping inside modal
              >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  accessibilityLabel="إغلاق"
                  accessibilityRole="button"
                  onPress={handleCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.alJassWhite} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>تغيير رقم الهاتف</Text>

                <TouchableOpacity
                  accessibilityLabel="رجوع"
                  accessibilityRole="button"
                  onPress={handleBackStep}
                  disabled={step === 1 || loading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={step === 1 ? 'transparent' : colors.alJassWhite}
                  />
                </TouchableOpacity>
              </View>

              {/* Progress */}
              {renderProgressDots()}

              {/* Content */}
              <View style={styles.content}>
                {/* Step 1: Verify Current Phone OTP (auto-sent on open) */}
                {step === 1 && (
                  <View style={styles.step}>
                    <Text style={styles.title}>أدخل رمز التحقق</Text>
                    <Text style={styles.subtitle}>تم إرسال الرمز إلى {currentPhone}</Text>

                    <OtpInput
                      ref={currentOtpRef}
                      numberOfDigits={4}
                      focusColor={colors.alJassWhite}
                      onTextChange={setCurrentOtp}
                      onFilled={(code) => handleVerifyCurrentOtp(code)}
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
                      <Animated.View style={{ transform: [{ scale: resendScale }] }}>
                        <TouchableOpacity
                          accessibilityLabel="إعادة إرسال رمز التحقق"
                          accessibilityRole="button"
                          onPress={handleResendOtp}
                          onPressIn={() => resendScale.setValue(0.96)}
                          onPressOut={() => resendScale.setValue(1)}
                          disabled={loading}
                        >
                          <Text style={styles.resendButton}>إعادة إرسال الرمز</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>
                )}

                {/* Step 2: Enter New Phone */}
                {step === 2 && (
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

                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                      <TouchableOpacity
                        style={[styles.button, (loading || !newPhone) && styles.buttonDisabled]}
                        onPress={handleInitiateNewPhoneOtp}
                        onPressIn={() => buttonScale.setValue(0.96)}
                        onPressOut={() => buttonScale.setValue(1)}
                        disabled={loading || !newPhone}
                      >
                        {loading ? (
                          <ActivityIndicator color={colors.alJassWhite} />
                        ) : (
                          <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                )}

                {/* Step 3: Verify New Phone OTP */}
                {step === 3 && (
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
                      onFilled={(code) => handleCompleteChange(code)}
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
                      <Animated.View style={{ transform: [{ scale: resendScale }] }}>
                        <TouchableOpacity
                          accessibilityLabel="إعادة إرسال رمز التحقق"
                          accessibilityRole="button"
                          onPress={handleResendOtp}
                          onPressIn={() => resendScale.setValue(0.96)}
                          onPressOut={() => resendScale.setValue(1)}
                          disabled={loading}
                        >
                          <Text style={styles.resendButton}>إعادة إرسال الرمز</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </View>
                )}

                {/* Error message */}
                {error && (
                  <Animated.View
                    style={[
                      styles.errorContainer,
                      {
                        transform: [
                          {
                            translateX: shakeAnim.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: [-10, 0, 10],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}
              </View>
            </TouchableOpacity>
            </KeyboardAvoidingView>
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
    backgroundColor: `${colors.saduNight}F0`,
    borderRadius: 20,
    alignSelf: 'stretch',
    marginHorizontal: 20,
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
    flex: 1,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(249, 247, 243, 0.3)',
  },
  progressDotActive: {
    backgroundColor: colors.najdiCrimson,
  },
  content: {
    minHeight: 288,
    width: '100%',
  },
  step: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'SF Arabic',
    color: `${colors.alJassWhite}B3`,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.najdiCrimson,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
  },
  otpContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  otpInput: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInputFilled: {
    borderColor: `${colors.najdiCrimson}A0`,
    backgroundColor: `${colors.najdiCrimson}20`,
  },
  otpInputFocused: {
    borderColor: colors.alJassWhite,
    borderWidth: 2.5,
    backgroundColor: 'rgba(249, 247, 243, 0.1)',
  },
  otpText: {
    fontSize: 20,
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
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: colors.desertOchre,
    textAlign: 'center',
    marginTop: 16,
  },
  resendButton: {
    fontSize: 15,
    fontFamily: 'SF Arabic',
    color: colors.najdiCrimson,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    paddingVertical: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 123, 123, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 123, 123, 0.5)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'SF Arabic',
    color: '#FF7B7B',
    flex: 1,
    fontWeight: '500',
  },
});
