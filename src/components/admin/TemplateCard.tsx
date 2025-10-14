/**
 * Template Card
 *
 * Editable surface for a single WhatsApp template.
 * Allows saving, testing, and resetting to the default message.
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { TemplateWithValue } from '../../services/messageTemplates/types';
import templateService from '../../services/messageTemplates';
import adminContactService from '../../services/adminContact';
import VariableChip from './VariableChip';
import Surface from '../ui/Surface';
import tokens from '../ui/tokens';

interface TemplateCardProps {
  template: TemplateWithValue;
  onSave?: () => void;
}

const palette = tokens.colors.najdi;

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSave }) => {
  const [message, setMessage] = useState(template.currentMessage);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const handleSave = async () => {
    if (!message.trim()) {
      Alert.alert('تنبيه', 'أدخل نص الرسالة قبل الحفظ.');
      return;
    }

    setSaving(true);
    try {
      const result = await templateService.setTemplateMessage(
        template.id,
        message,
      );

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ القالب.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم الحفظ', 'تم تحديث نص القالب بنجاح.');
      onSave?.();
    } catch (error: any) {
      console.error('Error saving template:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', error.message || 'فشل حفظ القالب.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const testData = template.testMockData || {};
      const messageWithData = await templateService.replaceVariables(
        message,
        testData,
      );

      const result =
        await adminContactService.openAdminWhatsApp(messageWithData);

      if (!result.success) {
        Alert.alert('تنبيه', 'تعذر فتح واتساب للاختبار.');
      }
    } catch (error) {
      console.error('Error testing template:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختبار القالب.');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'إرجاع النص الأصلي',
      'سيتم استرجاع الرسالة الافتراضية لهذا القالب.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استرجاع',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const result = await templateService.resetTemplate(template.id);
              if (!result.success) {
                throw new Error(result.error || 'فشل استرجاع القالب.');
              }

              setMessage(template.defaultMessage);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert('تم الاسترجاع', 'تمت إعادة القالب للنص الأصلي.');
              onSave?.();
            } catch (error: any) {
              console.error('Error resetting template:', error);
              Alert.alert('خطأ', error.message || 'تعذر إعادة القالب.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const insertVariable = (variableKey: string) => {
    const currentText = message || '';
    const newText = currentText
      ? `${currentText}\n${variableKey}`
      : variableKey;

    setMessage(newText);
    textInputRef.current?.focus();
  };

  return (
    <Surface style={styles.surface} contentStyle={styles.surfaceContent}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={template.icon as any}
            size={22}
            color={palette.primary}
          />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{template.name}</Text>
          {template.isCustomized ? (
            <Text style={styles.badge}>معدّل</Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.description}>{template.description}</Text>

      {template.variables.length > 0 && (
        <View style={styles.variablesSection}>
          <Text style={styles.variablesLabel}>المتغيرات المتاحة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.variablesRow}
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

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>نص القالب</Text>
        <TextInput
          ref={textInputRef}
          style={styles.textArea}
          value={message}
          onChangeText={setMessage}
          placeholder={template.defaultMessage}
          placeholderTextColor={`${palette.textMuted}80`}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#FFFFFF"
                style={styles.buttonIcon}
              />
              <Text style={styles.primaryButtonText}>حفظ القالب</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, testing && styles.disabledButton]}
          onPress={handleTest}
          disabled={testing}
          activeOpacity={0.85}
        >
          {testing ? (
            <ActivityIndicator size="small" color={tokens.colors.accent} />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons
                name="send"
                size={18}
                color={palette.primary}
                style={styles.buttonIcon}
              />
              <Text style={styles.secondaryButtonText}>اختبار الرسالة</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.resetButton, resetting && styles.disabledButton]}
        onPress={handleReset}
        disabled={resetting}
        activeOpacity={0.85}
      >
        {resetting ? (
          <ActivityIndicator size="small" color={palette.textMuted} />
        ) : (
          <Text style={styles.resetButtonText}>إرجاع النص الأصلي</Text>
        )}
      </TouchableOpacity>
    </Surface>
  );
};

const styles = StyleSheet.create({
  surface: {
    borderRadius: tokens.radii.lg,
  },
  surfaceContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.primary}18`,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    ...tokens.typography.headline,
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  badge: {
    ...tokens.typography.caption1,
    color: palette.primary,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  description: {
    ...tokens.typography.footnote,
    color: palette.textMuted,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  variablesSection: {
    gap: tokens.spacing.xs,
  },
  variablesLabel: {
    ...tokens.typography.caption1,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  variablesRow: {
    paddingVertical: tokens.spacing.xs,
  },
  inputGroup: {
    gap: tokens.spacing.xs,
  },
  inputLabel: {
    ...tokens.typography.subheadline,
    color: palette.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  textArea: {
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    fontSize: 16,
    color: palette.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    minHeight: 140,
    backgroundColor: tokens.colors.surface,
  },
  actionsRow: {
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
  },
  buttonIcon: {
    marginHorizontal: 6,
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
  resetButton: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${palette.primary}1F`,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    ...tokens.typography.caption1,
    color: palette.primary,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
});

export default TemplateCard;
