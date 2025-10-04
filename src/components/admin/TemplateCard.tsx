/**
 * Template Card Component
 *
 * Displays a single message template with:
 * - Template name, description, icon
 * - Available variables (clickable chips)
 * - Text input for editing message
 * - Save and Test buttons
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TemplateWithValue } from '../../services/messageTemplates/types';
import templateService from '../../services/messageTemplates';
import adminContactService from '../../services/adminContact';
import VariableChip from './VariableChip';

// Najdi Sadu colors
const colors = {
  background: '#F9F7F3',
  container: '#D1BBA3',
  text: '#242121',
  textMuted: '#24212199',
  primary: '#A13333',
  secondary: '#D58C4A',
  white: '#FFFFFF',
  whatsapp: '#25D366',
};

interface TemplateCardProps {
  template: TemplateWithValue;
  onSave?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSave }) => {
  const [message, setMessage] = useState(template.currentMessage);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const handleSave = async () => {
    if (!message || message.trim() === '') {
      Alert.alert('خطأ', 'يرجى إدخال نص الرسالة');
      return;
    }

    setSaving(true);
    const result = await templateService.setTemplateMessage(template.id, message);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('نجح', `تم حفظ ${template.name} بنجاح`);
      onSave?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', result.error || 'فشل حفظ القالب');
    }

    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);

    try {
      // Use test mock data if available, otherwise use example data
      const testData = template.testMockData || {};

      // Replace variables with test data
      const messageWithData = await templateService.replaceVariables(message, testData);

      // Open WhatsApp with the message
      const result = await adminContactService.openAdminWhatsApp(messageWithData);

      if (!result.success) {
        Alert.alert('خطأ', 'فشل فتح الواتساب');
      }
    } catch (error) {
      console.error('Error testing template:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختبار القالب');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'إعادة تعيين',
      'هل تريد إعادة تعيين القالب للرسالة الافتراضية؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إعادة تعيين',
          style: 'destructive',
          onPress: async () => {
            const result = await templateService.resetTemplate(template.id);
            if (result.success) {
              setMessage(template.defaultMessage);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('نجح', 'تم إعادة تعيين القالب');
              onSave?.();
            }
          },
        },
      ]
    );
  };

  const insertVariable = (variableKey: string) => {
    // Insert variable at cursor position (or end of text)
    const currentText = message || '';
    const newText = currentText + (currentText ? '\n' : '') + variableKey;
    setMessage(newText);

    // Focus text input
    textInputRef.current?.focus();
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={template.icon as any} size={24} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{template.name}</Text>
            {template.isCustomized && (
              <Text style={styles.customizedBadge}>• معدّل</Text>
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>{template.description}</Text>

      {/* Variables (if any) */}
      {template.variables.length > 0 && (
        <View style={styles.variablesSection}>
          <Text style={styles.variablesLabel}>المتغيرات المتاحة:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.variablesScroll}
          >
            {template.variables.map((variable) => (
              <VariableChip
                key={variable.key}
                variable={variable}
                onPress={insertVariable}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>نص الرسالة</Text>
        <TextInput
          ref={textInputRef}
          style={styles.textArea}
          value={message}
          onChangeText={setMessage}
          placeholder={template.defaultMessage}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>حفظ</Text>
            </>
          )}
        </TouchableOpacity>

        {template.testable && (
          <TouchableOpacity
            style={[styles.testButton, testing && styles.disabledButton]}
            onPress={handleTest}
            disabled={testing}
            activeOpacity={0.8}
          >
            {testing ? (
              <ActivityIndicator size="small" color={colors.whatsapp} />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={20} color={colors.whatsapp} />
                <Text style={styles.testButtonText}>اختبار</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {template.isCustomized && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
  },
  customizedBadge: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'SF Arabic',
    lineHeight: 20,
    marginBottom: 16,
  },
  variablesSection: {
    marginBottom: 16,
  },
  variablesLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  variablesScroll: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    fontFamily: 'SF Arabic',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.container + '60',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    fontFamily: 'SF Arabic',
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  testButton: {
    flex: 1,
    backgroundColor: colors.whatsapp + '15',
    borderWidth: 1.5,
    borderColor: colors.whatsapp,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  testButtonText: {
    color: colors.whatsapp,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  resetButton: {
    width: 48,
    backgroundColor: colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default TemplateCard;
