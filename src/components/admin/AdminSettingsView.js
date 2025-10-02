import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import adminContactService from '../../services/adminContact';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  muted: "#73637280", // Muted text
  border: "#D1BBA320", // Light border
  white: "#FFFFFF",
  whatsapp: "#25D366",
};

const DEFAULT_MESSAGE_KEY = 'admin_default_message';
const DEFAULT_MESSAGE = 'السلام عليكم';
const ONBOARDING_MESSAGE_KEY = 'admin_onboarding_help_message';
const DEFAULT_ONBOARDING_MESSAGE = 'مرحباً، أحتاج مساعدة في استخدام تطبيق شجرة عائلة القفاري';

const AdminSettingsView = ({ onClose }) => {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [defaultMessage, setDefaultMessage] = useState('');
  const [onboardingMessage, setOnboardingMessage] = useState('');
  const [articleSuggestionMessage, setArticleSuggestionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load WhatsApp number
      const number = await adminContactService.getAdminWhatsAppNumber();
      const display = await adminContactService.getDisplayNumber();
      setWhatsappNumber(number);
      setDisplayNumber(display);

      // Load default message
      const savedMessage = await AsyncStorage.getItem(DEFAULT_MESSAGE_KEY);
      setDefaultMessage(savedMessage || DEFAULT_MESSAGE);

      // Load onboarding help message
      const savedOnboarding = await AsyncStorage.getItem(ONBOARDING_MESSAGE_KEY);
      setOnboardingMessage(savedOnboarding || DEFAULT_ONBOARDING_MESSAGE);

      // Load article suggestion message
      const savedArticleSuggestion = await adminContactService.getArticleSuggestionMessage();
      setArticleSuggestionMessage(savedArticleSuggestion);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!whatsappNumber || whatsappNumber.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال رقم الواتساب');
      return;
    }

    setSaving(true);
    const result = await adminContactService.setAdminWhatsAppNumber(whatsappNumber);

    if (result.success) {
      const newDisplay = await adminContactService.getDisplayNumber();
      setDisplayNumber(newDisplay);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', 'تم حفظ رقم الواتساب بنجاح');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', result.error || 'فشل حفظ رقم الواتساب');
    }
    setSaving(false);
  };

  const handleSaveMessage = async () => {
    if (!defaultMessage || defaultMessage.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال الرسالة الافتراضية');
      return;
    }

    setSaving(true);
    try {
      await AsyncStorage.setItem(DEFAULT_MESSAGE_KEY, defaultMessage.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', 'تم حفظ الرسالة الافتراضية بنجاح');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', 'فشل حفظ الرسالة الافتراضية');
    }
    setSaving(false);
  };

  const handleSaveOnboardingMessage = async () => {
    if (!onboardingMessage || onboardingMessage.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال رسالة المساعدة');
      return;
    }

    setSaving(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_MESSAGE_KEY, onboardingMessage.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', 'تم حفظ رسالة المساعدة بنجاح');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', 'فشل حفظ رسالة المساعدة');
    }
    setSaving(false);
  };

  const handleSaveArticleSuggestionMessage = async () => {
    if (!articleSuggestionMessage || articleSuggestionMessage.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال رسالة اقتراح المقال');
      return;
    }

    setSaving(true);
    const result = await adminContactService.setArticleSuggestionMessage(articleSuggestionMessage.trim());

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', 'تم حفظ رسالة اقتراح المقال بنجاح');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', result.error || 'فشل حفظ رسالة اقتراح المقال');
    }
    setSaving(false);
  };

  const handleTestWhatsApp = async () => {
    const message = defaultMessage || DEFAULT_MESSAGE;
    const result = await adminContactService.openAdminWhatsApp(message);
    if (!result.success) {
      Alert.alert('خطأ', 'فشل فتح الواتساب');
    }
  };

  const handleFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              handleFeedback();
              onClose();
            }}
          >
            <Ionicons name="chevron-forward" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>إعدادات الواتساب</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* WhatsApp Number Section */}
          <View style={styles.settingsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="logo-whatsapp" size={24} color={colors.whatsapp} />
              <Text style={styles.sectionTitle}>رقم الواتساب</Text>
            </View>

            <Text style={styles.fieldLabel}>الرقم الحالي</Text>
            <View style={styles.currentNumberBox}>
              <Text style={styles.currentNumber}>{displayNumber}</Text>
            </View>

            <Text style={styles.fieldLabel}>تغيير الرقم</Text>
            <TextInput
              style={styles.input}
              value={whatsappNumber}
              onChangeText={setWhatsappNumber}
              placeholder="+966501234567"
              keyboardType="phone-pad"
              textAlign="left"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.helpText}>
              أدخل الرقم بالصيغة الدولية (مثل: +966501234567)
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveWhatsApp}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>حفظ الرقم</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Default Message Section */}
          <View style={styles.settingsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbox-ellipses" size={24} color={colors.secondary} />
              <Text style={styles.sectionTitle}>الرسالة الافتراضية</Text>
            </View>

            <Text style={styles.fieldLabel}>نص الرسالة</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={defaultMessage}
              onChangeText={setDefaultMessage}
              placeholder="السلام عليكم"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.helpText}>
              هذه الرسالة ستظهر تلقائياً عند فتح المحادثة
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveMessage}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>حفظ الرسالة</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Onboarding Help Message Section */}
          <View style={styles.settingsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>رسالة المساعدة (شاشة البداية)</Text>
            </View>

            <Text style={styles.fieldLabel}>نص الرسالة</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={onboardingMessage}
              onChangeText={setOnboardingMessage}
              placeholder="مرحباً، أحتاج مساعدة في استخدام التطبيق"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.helpText}>
              الرسالة التي ستظهر عند النقر على زر المساعدة في شاشة البداية
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveOnboardingMessage}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>حفظ الرسالة</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Article Suggestion Message Section */}
          <View style={styles.settingsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="newspaper-outline" size={24} color={colors.secondary} />
              <Text style={styles.sectionTitle}>رسالة اقتراح المقالات</Text>
            </View>

            <Text style={styles.fieldLabel}>نص الرسالة</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={articleSuggestionMessage}
              onChangeText={setArticleSuggestionMessage}
              placeholder="أود اقتراح مقال للنشر"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.helpText}>
              الرسالة التي ستظهر عند اقتراح مقال من صفحة الأخبار (سيتم إضافة الاسم ورقم الجوال تلقائياً)
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveArticleSuggestionMessage}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>حفظ الرسالة</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Test Button */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestWhatsApp}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={20} color={colors.whatsapp} style={{ marginRight: 8 }} />
              <Text style={styles.testButtonText}>اختبار الإعدادات</Text>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.muted} style={{ marginRight: 10 }} />
            <Text style={styles.infoText}>
              سيتم استخدام هذا الرقم والرسالة في جميع أنحاء التطبيق عند التواصل مع الإدارة
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  settingsCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
    marginLeft: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  currentNumberBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.container + '40',
  },
  currentNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
    textAlign: 'left',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.container + '60',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'SF Arabic',
  },
  messageInput: {
    height: 80,
    paddingTop: 14,
  },
  helpText: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: 'SF Arabic',
    marginTop: 6,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  testButton: {
    backgroundColor: colors.whatsapp + '15',
    borderWidth: 1.5,
    borderColor: colors.whatsapp,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: colors.whatsapp,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.container + '20',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: 'SF Arabic',
    lineHeight: 20,
  },
});

export default AdminSettingsView;