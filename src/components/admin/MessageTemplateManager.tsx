/**
 * Message Template Manager
 *
 * Main UI for managing all WhatsApp message templates.
 * Dynamically generates cards from MESSAGE_TEMPLATES registry.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import templateService from '../../services/messageTemplates';
import { TemplateWithValue } from '../../services/messageTemplates/types';
import TemplateCard from './TemplateCard';
import adminContactService from '../../services/adminContact';

// Najdi Sadu colors
const colors = {
  background: '#F9F7F3',
  container: '#D1BBA3',
  text: '#242121',
  textMuted: '#24212199',
  primary: '#A13333',
  secondary: '#D58C4A',
  white: '#FFFFFF',
};

interface MessageTemplateManagerProps {
  onClose: () => void;
}

const MessageTemplateManager: React.FC<MessageTemplateManagerProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<TemplateWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [editedNumber, setEditedNumber] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadWhatsAppNumber();
  }, []);

  const loadTemplates = async () => {
    try {
      const templatesWithValues = await templateService.getAllTemplatesWithValues();
      setTemplates(templatesWithValues);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('خطأ', 'فشل تحميل القوالب');
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppNumber = async () => {
    try {
      const number = await adminContactService.getAdminWhatsAppNumber();
      const display = await adminContactService.getDisplayNumber();
      setWhatsappNumber(number);
      setDisplayNumber(display);
      setEditedNumber(number);
    } catch (error) {
      console.error('Error loading WhatsApp number:', error);
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      'إعادة تعيين جميع القوالب',
      'هل تريد إعادة تعيين جميع القوالب للإعدادات الافتراضية؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إعادة تعيين الكل',
          style: 'destructive',
          onPress: async () => {
            const result = await templateService.clearAllCustomTemplates();
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('نجح', result.message || 'تم إعادة تعيين جميع القوالب');
              loadTemplates();
            } else {
              Alert.alert('خطأ', result.error || 'فشل إعادة التعيين');
            }
          },
        },
      ]
    );
  };

  const handleSaveWhatsAppNumber = async () => {
    if (!editedNumber || editedNumber.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال رقم الواتساب');
      return;
    }

    setSavingNumber(true);
    const result = await adminContactService.setAdminWhatsAppNumber(editedNumber);

    if (result.success) {
      const newDisplay = await adminContactService.getDisplayNumber();
      setWhatsappNumber(editedNumber);
      setDisplayNumber(newDisplay);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', 'تم حفظ رقم الواتساب بنجاح');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', result.error || 'فشل حفظ رقم الواتساب');
    }
    setSavingNumber(false);
  };

  const handleFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, TemplateWithValue[]>);

  const categoryNames: Record<string, string> = {
    support: 'الدعم والمساعدة',
    content: 'المحتوى',
    requests: 'الطلبات',
    notifications: 'الإشعارات',
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.headerTitle}>قوالب رسائل الواتساب</Text>
        <TouchableOpacity
          style={styles.resetAllButton}
          onPress={handleResetAll}
        >
          <Ionicons name="refresh" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* WhatsApp Number Section - Editable */}
        <View style={styles.whatsappCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="logo-whatsapp" size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>رقم الواتساب</Text>
          </View>

          <Text style={styles.fieldLabel}>الرقم الحالي</Text>
          <View style={styles.currentNumberBox}>
            <Text style={styles.currentNumber}>{displayNumber}</Text>
          </View>

          <Text style={styles.fieldLabel}>تغيير الرقم</Text>
          <TextInput
            style={styles.input}
            value={editedNumber}
            onChangeText={setEditedNumber}
            placeholder="+966501234567"
            keyboardType="phone-pad"
            textAlign="left"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.helpText}>
            أدخل الرقم بالصيغة الدولية (مثل: +966501234567)
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, savingNumber && styles.saveButtonDisabled]}
            onPress={handleSaveWhatsAppNumber}
            disabled={savingNumber}
            activeOpacity={0.8}
          >
            {savingNumber ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>حفظ الرقم</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Templates by Category */}
        {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{categoryNames[category] || category}</Text>
            {categoryTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSave={loadTemplates}
              />
            ))}
          </View>
        ))}

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Ionicons name="information-circle" size={20} color={colors.textMuted} />
          <Text style={styles.helpText}>
            استخدم المتغيرات مثل {'{name_chain}'} و{'{phone}'} لإضافة معلومات المستخدم تلقائياً.
            اضغط على المتغير لإضافته إلى الرسالة.
          </Text>
        </View>
      </ScrollView>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: 'SF Arabic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + '40',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
  },
  resetAllButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
    marginBottom: 4,
    textAlign: 'left',
  },
  infoHint: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'SF Arabic',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'SF Arabic',
    marginBottom: 12,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.container + '20',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: 'SF Arabic',
    lineHeight: 20,
    marginLeft: 10,
  },
  whatsappCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
    marginTop: 12,
  },
  currentNumberBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
});

export default MessageTemplateManager;
