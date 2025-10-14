/**
 * Message Template Manager
 *
 * Admin workspace for configuring WhatsApp contact number
 * and tailoring message templates that reuse dynamic variables.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  Easing,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import templateService from '../../services/messageTemplates';
import { TemplateWithValue } from '../../services/messageTemplates/types';
import TemplateCard from './TemplateCard';
import adminContactService from '../../services/adminContact';
import Surface from '../ui/Surface';
import tokens from '../ui/tokens';
import LargeTitleHeader from '../ios/LargeTitleHeader';

const palette = tokens.colors.najdi;
const emblemSource = require('../../../assets/logo/AlqefariEmblem.png');

const categoryNames: Record<string, string> = {
  support: 'الدعم',
  content: 'المحتوى',
  requests: 'الطلبات',
  notifications: 'الإشعارات',
};

const renderSFSymbol = (
  name: string,
  fallback: keyof typeof Ionicons.glyphMap,
  color: string,
  size = 22,
) => {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    xmark: 'close',
    'doc.on.doc': 'copy',
    'checkmark.circle.fill': 'checkmark-circle',
    'paperplane.fill': 'send',
    'info.circle': 'information-circle-outline',
  };

  return <Ionicons name={map[name] || fallback} size={size} color={color} />;
};

interface MessageTemplateManagerProps {
  onClose: () => void;
}

const MessageTemplateManager: React.FC<MessageTemplateManagerProps> = ({
  onClose,
}) => {
  const [templates, setTemplates] = useState<TemplateWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [editedNumber, setEditedNumber] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);
  const [testingNumber, setTestingNumber] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const contentAnimation = useRef(new Animated.Value(0)).current;

  const loadTemplates = useCallback(async () => {
    try {
      const templatesWithValues =
        await templateService.getAllTemplatesWithValues();
      setTemplates(templatesWithValues);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('خطأ', 'تعذر تحميل القوالب. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWhatsAppNumber = useCallback(async () => {
    try {
      const [number, display] = await Promise.all([
        adminContactService.getAdminWhatsAppNumber(),
        adminContactService.getDisplayNumber(),
      ]);

      setWhatsappNumber(number);
      setDisplayNumber(display);
      setEditedNumber(number);
    } catch (error) {
      console.error('Error loading WhatsApp number:', error);
      Alert.alert('خطأ', 'تعذر تحميل رقم الواتساب الحالي.');
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadWhatsAppNumber();
  }, [loadTemplates, loadWhatsAppNumber]);

  useEffect(() => {
    Animated.timing(contentAnimation, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentAnimation]);

  const templatesByCategory = useMemo(() => {
    return templates.reduce<Record<string, TemplateWithValue[]>>(
      (acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
      },
      {},
    );
  }, [templates]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTemplates(), loadWhatsAppNumber()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTemplates, loadWhatsAppNumber]);

  const handleSaveWhatsAppNumber = useCallback(async () => {
    if (!editedNumber.trim()) {
      Alert.alert('تنبيه', 'أدخل الرقم بصيغة دولية تبدأ بعلامة +.');
      return;
    }

    setSavingNumber(true);
    try {
      const result = await adminContactService.setAdminWhatsAppNumber(
        editedNumber,
      );

      if (!result.success) {
        throw new Error(result.error || 'فشل حفظ الرقم.');
      }

      await loadWhatsAppNumber();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم الحفظ', 'تم تحديث رقم الواتساب بنجاح.');
    } catch (error: any) {
      console.error('Error saving WhatsApp number:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', error.message || 'تعذر حفظ الرقم.');
    } finally {
      setSavingNumber(false);
    }
  }, [editedNumber, loadWhatsAppNumber]);

  const handleTestWhatsAppNumber = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTestingNumber(true);
    try {
      const result = await adminContactService.openAdminWhatsApp();
      if (!result?.success) {
        Alert.alert(
          'تنبيه',
          'تعذر فتح تطبيق واتساب. تأكد من تثبيته أو استخدم نسخة الويب.',
        );
      }
    } catch (error) {
      console.error('Error testing WhatsApp number:', error);
      Alert.alert('خطأ', 'تعذر تشغيل واتساب. تحقق من الرقم ثم حاول مجدداً.');
    } finally {
      setTestingNumber(false);
    }
  }, []);

  const handleCopyNumber = useCallback(async () => {
    if (!whatsappNumber) return;

    try {
      await Clipboard.setStringAsync(whatsappNumber);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('تم النسخ', 'تم نسخ رقم الواتساب إلى الحافظة.');
    } catch (error) {
      console.error('Error copying WhatsApp number:', error);
    }
  }, [whatsappNumber]);

  const handleResetAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'إعادة ضبط القوالب',
      'سيتم استرجاع جميع الرسائل إلى النصوص الافتراضية. هل ترغب بالمتابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إعادة الضبط',
          style: 'destructive',
          onPress: async () => {
            setResettingAll(true);
            try {
              const result =
                await templateService.clearAllCustomTemplates();
              if (!result.success) {
                throw new Error(result.error || 'فشل إعادة الضبط.');
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('تمت الإعادة', 'تمت استعادة جميع القوالب إلى الأصل.');
              loadTemplates();
            } catch (error: any) {
              console.error('Error resetting templates:', error);
              Alert.alert('خطأ', error.message || 'تعذر إعادة ضبط القوالب.');
            } finally {
              setResettingAll(false);
            }
          },
        },
      ],
    );
  }, [loadTemplates]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.accent} />
          <Text style={styles.loadingText}>يتم تحميل إعدادات الواتساب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const animatedContentStyle = {
    opacity: contentAnimation,
    transform: [
      {
        translateY: contentAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LargeTitleHeader
        title="التواصل"
        emblemSource={emblemSource}
        actions={
          <TouchableOpacity
            onPress={handleClose}
            style={styles.iconButton}
            accessibilityLabel="إغلاق"
          >
            {renderSFSymbol('xmark', 'close', palette.text, 24)}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.accent}
          />
        }
      >
        <Animated.View style={[styles.contentWrapper, animatedContentStyle]}>
          <Surface style={styles.surface} contentStyle={styles.surfaceContent}>
            <Text style={styles.sectionHeading}>رقم التواصل</Text>
            <Text style={styles.sectionHint}>
              يظهر للأعضاء عند التواصل مع الإدارة.
            </Text>

            <View style={styles.currentNumberRow}>
              <View style={styles.numberBlock}>
                <Text style={styles.fieldLabel}>الرقم الحالي</Text>
                <Text style={styles.currentNumber}>
                  {displayNumber || '—'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inlineAction}
                onPress={handleCopyNumber}
                activeOpacity={0.8}
                disabled={!whatsappNumber}
                accessibilityLabel="نسخ الرقم الحالي"
              >
                {renderSFSymbol('doc.on.doc', 'copy', palette.textMuted, 18)}
                <Text style={styles.inlineActionText}>نسخ</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>رقم جديد</Text>
            <TextInput
              style={styles.input}
              value={editedNumber}
              onChangeText={setEditedNumber}
              placeholder="+966501234567"
              keyboardType="phone-pad"
              textAlign="left"
              placeholderTextColor={`${palette.textMuted}66`}
              returnKeyType="done"
              accessibilityLabel="إدخال رقم واتساب جديد"
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>
              اكتب الرقم بصيغة دولية مثل ‎+966501234567‎.
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingNumber && styles.disabledButton,
                ]}
                onPress={handleSaveWhatsAppNumber}
                activeOpacity={0.85}
                disabled={savingNumber}
                accessibilityLabel="حفظ الرقم الجديد"
              >
                {savingNumber ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    {renderSFSymbol(
                      'checkmark.circle.fill',
                      'checkmark-circle',
                      '#FFFFFF',
                      20,
                    )}
                    <Text style={styles.primaryButtonText}>حفظ</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  testingNumber && styles.disabledButton,
                ]}
                onPress={handleTestWhatsAppNumber}
                activeOpacity={0.85}
                disabled={testingNumber}
                accessibilityLabel="اختبار فتح واتساب"
              >
                {testingNumber ? (
                  <ActivityIndicator
                    size="small"
                    color={tokens.colors.accent}
                  />
                ) : (
                  <View style={styles.buttonContent}>
                    {renderSFSymbol(
                      'paperplane.fill',
                      'send',
                      palette.primary,
                      18,
                    )}
                    <Text style={styles.secondaryButtonText}>اختبار</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.resetAllButton,
                resettingAll && styles.disabledButton,
              ]}
              onPress={handleResetAll}
              activeOpacity={0.85}
              disabled={resettingAll}
              accessibilityLabel="إعادة ضبط جميع القوالب"
            >
              {resettingAll ? (
                <ActivityIndicator size="small" color={palette.text} />
              ) : (
                <Text style={styles.resetAllText}>
                  استرجاع كل القوالب
                </Text>
              )}
            </TouchableOpacity>
          </Surface>

          {Object.entries(templatesByCategory).map(
            ([category, categoryTemplates]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>
                  {categoryNames[category] || category}
                </Text>
                {categoryTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSave={loadTemplates}
                  />
                ))}
              </View>
            ),
          )}

          <View style={styles.infoPanel}>
            <View style={styles.infoIcon}>
              {renderSFSymbol(
                'info.circle',
                'information-circle-outline',
                palette.secondary,
                18,
              )}
            </View>
            <Text style={styles.infoText}>
              المتغيرات تضيف بيانات العضو تلقائياً داخل الرسالة الحالية.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xl,
  },
  loadingText: {
    ...tokens.typography.body,
    textAlign: 'center',
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  iconButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xxl,
  },
  contentWrapper: {
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.xl,
  },
  surface: {
    marginTop: tokens.spacing.sm,
  },
  surfaceContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  sectionHeading: {
    ...tokens.typography.title3,
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  sectionHint: {
    ...tokens.typography.footnote,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    lineHeight: 20,
  },
  currentNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${palette.container}22`,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  numberBlock: {
    gap: 2,
  },
  fieldLabel: {
    ...tokens.typography.subheadline,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  currentNumber: {
    ...tokens.typography.headline,
    color: palette.text,
    textAlign: 'left',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionText: {
    ...tokens.typography.footnote,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    backgroundColor: tokens.colors.surface,
  },
  helperText: {
    ...tokens.typography.caption1,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: tokens.radii.md,
    minHeight: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${palette.primary}33`,
    minHeight: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    ...tokens.typography.callout,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  secondaryButtonText: {
    ...tokens.typography.callout,
    color: palette.primary,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  resetAllButton: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${palette.primary}1F`,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.sm,
  },
  resetAllText: {
    ...tokens.typography.footnote,
    color: palette.primary,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  categorySection: {
    gap: tokens.spacing.md,
  },
  categoryTitle: {
    ...tokens.typography.title3,
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.secondary}1A`,
  },
  infoText: {
    flex: 1,
    ...tokens.typography.footnote,
    lineHeight: 20,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
});

export default MessageTemplateManager;
