/**
 * DeleteAccountModal - 3-Stage Account Deletion Flow
 *
 * Stages:
 * 1. OTP Verification - Send 4-digit code to current phone
 * 2. Text Confirmation - Type "نعم" to confirm deletion
 * 3. Final Confirmation - Click button to execute deletion
 *
 * Flow:
 * - Modal opens → Auto-send OTP to current phone
 * - Show Stage 1 OTP input immediately
 * - User verifies OTP → Stage 2 (text input "نعم")
 * - User types "نعم" → Stage 3 (confirm deletion)
 * - Click delete → Account deleted + global sign out
 *
 * Pattern reuses PhoneChangeModal for consistency
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
  TextInput,
} from 'react-native';
import { OtpInput } from 'react-native-otp-entry';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useNetworkGuard } from '../../hooks/useNetworkGuard';
import {
  sendAccountDeletionOtp,
  verifyAccountDeletionOtp,
} from '../../services/deleteAccountOtp';
import { accountDeletionService } from '../../services/accountDeletion';
import { supabase } from '../../services/supabase';

// Najdi Sadu Color Palette
const colors = {
  alJassWhite: '#F9F7F3',
  camelHairBeige: '#D1BBA3',
  saduNight: '#242121',
  najdiCrimson: '#A13333',
  desertOchre: '#D58C4A',
  destructiveRed: '#DC2626',
};

/**
 * DeleteAccountModal
 *
 * Props:
 * - isVisible: Boolean to show/hide modal
 * - userProfile: User profile object (for edge case checks)
 * - onComplete: Callback when account deleted
 * - onCancel: Callback when user cancels
 */
export function DeleteAccountModal({
  isVisible = false,
  userProfile = null,
  onComplete = () => {},
  onCancel = () => {},
}) {
  const { checkBeforeAction } = useNetworkGuard();
  const [stage, setStage] = useState(1); // 1: OTP, 2: Text input, 3: Deletion in progress
  const [currentPhone, setCurrentPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [deletionInProgress, setDeletionInProgress] = useState(false);

  // Refs
  const otpRef = useRef(null);
  const countdownInterval = useRef(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(600)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const resendScale = useRef(new Animated.Value(1)).current;

  // Initialize modal - get current phone and start animations
  useEffect(() => {
    if (isVisible) {
      loadCurrentPhone();
      performEdgeCaseChecks();

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
    if (isVisible && currentPhone && stage === 1 && countdown === 0) {
      const autoSendTimer = setTimeout(() => {
        handleAutoSendOtp();
      }, 300);
      return () => clearTimeout(autoSendTimer);
    }
  }, [isVisible, currentPhone, stage, countdown]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.phone) {
        setCurrentPhone(user.phone);
      }
    } catch (err) {
      console.error('[DeleteAccount] Failed to load phone:', err);
    }
  };

  const performEdgeCaseChecks = async () => {
    try {
      if (!userProfile) return;

      // Check if root node (generation 1, no father)
      if (userProfile.generation === 1 && !userProfile.father_id) {
        Alert.alert(
          'لا يمكن حذف الحساب',
          'ملفك هو جذر الشجرة. يرجى التواصل مع الإدارة لحذف الحساب.',
          [{ text: 'حسناً', onPress: onCancel }]
        );
        return;
      }

      // Check if user has children in tree
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .or(
          `father_id.eq.${userProfile.id},mother_id.eq.${userProfile.id}`
        )
        .is('deleted_at', null);

      if (count > 0) {
        Alert.alert(
          'تنبيه',
          `لديك ${count} ابن/ابنة في الشجرة. سيتم إلغاء ربط ملفك وليس حذف البيانات.`
        );
      }

      // Warn if admin/moderator
      if (userProfile.role && userProfile.role !== 'user') {
        Alert.alert(
          'تحذير',
          'أنت مشرف في النظام. حذف حسابك سيؤدي إلى فقدان صلاحياتك الإدارية.'
        );
      }
    } catch (err) {
      console.error('[DeleteAccount] Edge case check error:', err);
    }
  };

  const resetModal = () => {
    setStage(1);
    setCurrentPhone('');
    setOtp('');
    setConfirmText('');
    setError('');
    setCountdown(0);
    setOtpExpiry(null);
    setDeletionInProgress(false);
    shakeAnim.setValue(0);
    successAnim.setValue(0);
    slideAnim.setValue(600);
    fadeAnim.setValue(0);
  };

  // Error shake animation
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
    // Warn if deletion in progress
    if (stage === 1 || stage === 2) {
      Alert.alert(
        'تأكيد الإلغاء',
        'لديك عملية حذف حساب قيد التنفيذ. هل تريد إلغاءها؟',
        [
          { text: 'متابعة الحذف', style: 'cancel' },
          {
            text: 'إلغاء',
            style: 'destructive',
            onPress: performCancel,
          },
        ]
      );
    } else {
      performCancel();
    }
  };

  const performCancel = () => {
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

  // Send OTP to current phone
  const handleAutoSendOtp = async () => {
    if (!currentPhone) {
      console.warn('[DeleteAccount] Phone not loaded yet');
      return;
    }

    if (!checkBeforeAction('إرسال رمز التحقق')) {
      return;
    }

    try {
      await sendAccountDeletionOtp(currentPhone);
      setCountdown(60);
      setOtpExpiry(Date.now() + 10 * 60 * 1000); // 10 minutes
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[DeleteAccount] Send OTP error:', err);
      setError('فشل إرسال رمز التحقق. يرجى المحاولة مرة أخرى.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Verify OTP and advance to stage 2
  const handleVerifyOtp = async (otpCode = otp) => {
    if (otpCode.length !== 4) return;

    if (!checkBeforeAction('التحقق من الرمز')) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      // Check OTP expiration
      if (otpExpiry && Date.now() > otpExpiry) {
        setError('انتهت صلاحية رمز التحقق. يرجى البدء مجدداً.');
        triggerErrorShake();
        resetModal();
        return;
      }

      await verifyAccountDeletionOtp(currentPhone, otpCode);
      triggerSuccessFlash();
      setStage(2);
      setOtp('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[DeleteAccount] Verify OTP error:', err);
      setError('رمز التحقق غير صحيح');
      triggerErrorShake();
      setOtp('');
      if (otpRef.current) {
        otpRef.current.clear();
        setTimeout(() => otpRef.current?.focus(), 100);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Perform actual deletion
  const handleDelete = async () => {
    if (confirmText !== 'نعم') {
      setError('يرجى كتابة "نعم" بالضبط للتأكيد');
      triggerErrorShake();
      return;
    }

    // Check OTP expiration before deletion
    if (otpExpiry && Date.now() > otpExpiry) {
      Alert.alert(
        'انتهت صلاحية رمز التحقق',
        'يرجى البدء مجدداً والتحقق من رقم هاتفك.'
      );
      resetModal();
      return;
    }

    if (!checkBeforeAction('حذف الحساب')) return;

    setDeletionInProgress(true);
    setError('');
    Keyboard.dismiss();

    try {
      const result = await accountDeletionService.deleteAccount();

      if (!result.success) {
        Alert.alert('خطأ', result.error || 'فشل حذف الحساب');
        setDeletionInProgress(false);
        return;
      }

      // Success
      triggerSuccessFlash();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم حذف الحساب', 'سيتم تسجيل خروجك الآن.');

      // Auto sign out and navigate after 2 seconds
      setTimeout(() => {
        resetModal();
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('[DeleteAccount] Deletion error:', err);
      setError('فشل حذف الحساب. يرجى المحاولة مرة أخرى.');
      triggerErrorShake();
      setDeletionInProgress(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleResendOtp = async () => {
    await handleAutoSendOtp();
  };

  // Progress indicator with animation (3 stages)
  const renderProgressDots = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((dot) => {
        const isActive = stage >= dot;
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
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
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
                    disabled={deletionInProgress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={
                        deletionInProgress
                          ? colors.alJassWhite + '60'
                          : colors.alJassWhite
                      }
                    />
                  </TouchableOpacity>

                  <Text style={styles.headerTitle}>حذف الحساب</Text>

                  <View style={{ width: 24 }} />
                </View>

                {/* Progress */}
                {renderProgressDots()}

                {/* Content */}
                <View style={styles.content}>
                  {/* Stage 1: OTP Verification */}
                  {stage === 1 && (
                    <View style={styles.stage}>
                      <Text style={styles.title}>رمز التحقق</Text>
                      <Text style={styles.subtitle}>
                        تم إرسال الرمز إلى {currentPhone}
                      </Text>

                      <OtpInput
                        ref={otpRef}
                        numberOfDigits={4}
                        focusColor={colors.alJassWhite}
                        onTextChange={setOtp}
                        onFilled={(code) => handleVerifyOtp(code)}
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

                  {/* Stage 2: Text Confirmation */}
                  {stage === 2 && (
                    <View style={styles.stage}>
                      <View style={styles.warningBox}>
                        <Ionicons
                          name="warning"
                          size={24}
                          color={colors.destructiveRed}
                        />
                        <Text style={styles.warningTitle}>
                          تحذير: هذا الإجراء لا يمكن التراجع عنه
                        </Text>
                        <Text style={styles.warningList}>
                          • سيتم إلغاء ربط ملفك الشخصي{'\n'}
                          • سيتم حذف جميع الإشعارات والطلبات{'\n'}
                          • لن تتمكن من تسجيل الدخول مجدداً{'\n'}
                          • البيانات الشخصية ستبقى في الشجرة (محمية)
                        </Text>
                      </View>

                      <Text style={styles.subtitle}>اكتب "نعم" للتأكيد</Text>

                      <TextInput
                        style={[
                          styles.textInput,
                          confirmText === 'نعم' && styles.textInputValid,
                        ]}
                        value={confirmText}
                        onChangeText={setConfirmText}
                        placeholder="نعم"
                        placeholderTextColor={colors.alJassWhite + '60'}
                        editable={!deletionInProgress}
                        textAlign="center"
                      />

                      <TouchableOpacity
                        style={[
                          styles.deleteButton,
                          (confirmText !== 'نعم' || deletionInProgress) &&
                            styles.deleteButtonDisabled,
                        ]}
                        onPress={handleDelete}
                        disabled={confirmText !== 'نعم' || deletionInProgress}
                      >
                        {deletionInProgress ? (
                          <ActivityIndicator color={colors.alJassWhite} />
                        ) : (
                          <Text style={styles.deleteButtonText}>
                            حذف الحساب نهائياً
                          </Text>
                        )}
                      </TouchableOpacity>
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
    backgroundColor: colors.destructiveRed,
  },
  content: {
    minHeight: 288,
    width: '100%',
  },
  stage: {
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
  warningBox: {
    backgroundColor: `${colors.destructiveRed}15`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.destructiveRed}40`,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 24,
    alignItems: 'center',
    gap: 12,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    color: colors.destructiveRed,
    textAlign: 'center',
  },
  warningList: {
    fontSize: 13,
    fontFamily: 'SF Arabic',
    color: `${colors.alJassWhite}99`,
    textAlign: 'center',
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: 'SF Arabic',
    color: colors.alJassWhite,
    marginBottom: 24,
    width: '100%',
  },
  textInputValid: {
    borderColor: colors.destructiveRed,
    backgroundColor: `${colors.destructiveRed}20`,
  },
  deleteButton: {
    backgroundColor: colors.destructiveRed,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  deleteButtonDisabled: {
    opacity: 0.4,
  },
  deleteButtonText: {
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
    borderColor: `${colors.destructiveRed}A0`,
    backgroundColor: `${colors.destructiveRed}20`,
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
    color: colors.destructiveRed,
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
