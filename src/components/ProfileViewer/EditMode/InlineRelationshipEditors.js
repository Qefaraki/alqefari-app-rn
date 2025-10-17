import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { supabase } from '../../../services/supabase';
import { getCompleteNameChain } from '../../../utils/nameChainUtils';

const InlineCard = ({ children }) => (
  <View style={styles.cardContainer}>
    {children}
  </View>
);

const InlineFieldGroup = ({ label, hint, children }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>
);

const SegmentedControl = ({ value, options, onChange }) => (
  <View style={styles.segments}>
    {options.map((option) => {
      const active = value === option.value;
      return (
        <TouchableOpacity
          key={option.value}
          style={[styles.segmentButton, active && styles.segmentButtonActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(option.value);
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const InlineActions = ({ onCancel, onSave, saving, saveLabel = 'حفظ' }) => (
 <View style={styles.actionRow}>
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onCancel?.();
      }}
      style={styles.cancelButton}
      activeOpacity={0.7}
    >
      <Text style={styles.cancelButtonText}>إلغاء</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => {
        if (!saving) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSave?.();
        }
      }}
      style={[styles.saveButton, saving && styles.saveButtonDisabled]}
      activeOpacity={0.85}
      disabled={saving}
    >
      {saving ? (
        <ActivityIndicator size="small" color={tokens.colors.surface} />
      ) : (
        <>
          <Ionicons name="checkmark" size={18} color={tokens.colors.surface} />
          <Text style={styles.saveButtonText}>{saveLabel}</Text>
        </>
      )}
    </TouchableOpacity>
  </View>
);

export const InlineMarriageEditor = ({
  marriage,
  onSaved,
  onCancel,
}) => {
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('current');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!marriage) return;

    setFullName(marriage.spouse_profile?.name || '');

    const rawStatus = marriage.status || 'current';
    setStatus(rawStatus === 'past' || rawStatus === 'divorced' || rawStatus === 'widowed' ? 'past' : 'current');
  }, [marriage]);

  const trimmedName = useMemo(() => fullName.trim(), [fullName]);

  const handleSave = async () => {
    if (!marriage || !trimmedName) {
      Alert.alert('خطأ', 'يرجى كتابة اسم الزوجة');
      return;
    }

    setSaving(true);
    try {
      if (marriage.status !== status) {
        const { error } = await supabase.rpc('admin_update_marriage', {
          p_marriage_id: marriage.marriage_id,
          p_updates: { status },
        });
        if (error) throw error;
      }

      const originalName = marriage.spouse_profile?.name?.trim() || '';
      if (marriage.spouse_profile?.id && trimmedName && trimmedName !== originalName) {
        const { error: nameError } = await supabase.rpc('admin_update_profile', {
          p_id: marriage.spouse_profile.id,
          p_version: marriage.spouse_profile.version ?? 1, // Required for optimistic locking (nullish coalescing handles version=0)
          p_updates: { name: trimmedName },
        });
        if (nameError) throw nameError;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updatedMarriage = {
        ...marriage,
        status,
        spouse_profile: {
          ...marriage.spouse_profile,
          name: trimmedName,
        },
      };
      onSaved?.(updatedMarriage);
    } catch (error) {
      if (__DEV__) {
        console.error('Error updating marriage:', error);
      }
      Alert.alert('خطأ', 'تعذر حفظ التعديلات، حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  if (!marriage) return null;

  // Detect cousin marriage: Both spouses are Al-Qefari family members (have HID)
  const isCousinMarriage = marriage.spouse_profile?.hid !== null &&
                           marriage.spouse_profile?.hid !== undefined;

  // For cousin marriages: Show complete chain with surname in header
  const displayTitle = useMemo(() => {
    if (isCousinMarriage) {
      const nameChain = getCompleteNameChain(marriage.spouse_profile);
      return nameChain || trimmedName || marriage.spouse_profile?.name || '—';
    }
    return trimmedName || marriage.spouse_profile?.name || '—';
  }, [isCousinMarriage, marriage.spouse_profile, trimmedName]);

  return (
    <InlineCard>
      <View style={styles.inlineHeader}>
        <Text style={styles.inlineEyebrow}>الزوجة</Text>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.inlineClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={tokens.colors.najdi.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.inlineTitle} numberOfLines={2} ellipsizeMode="tail">
        {displayTitle}
      </Text>

      <InlineFieldGroup label="اسم الزوجة">
        <TextInput
          style={styles.textInput}
          value={fullName}
          onChangeText={setFullName}
          placeholder="مثال: مريم محمد علي السعوي"
          placeholderTextColor={tokens.colors.najdi.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          clearButtonMode="never"
        />
      </InlineFieldGroup>

      <InlineFieldGroup label="حالة الزواج">
        <SegmentedControl
          value={status}
          options={[
            { label: 'حالي', value: 'current' },
            { label: 'سابق', value: 'past' },
          ]}
          onChange={setStatus}
        />
      </InlineFieldGroup>

      <InlineActions
        onCancel={onCancel}
        onSave={handleSave}
        saving={saving}
        saveLabel="حفظ"
      />
    </InlineCard>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: tokens.colors.najdi.primary + '08', // Subtle Najdi Crimson tint (8% opacity)
    borderRadius: tokens.radii.lg,
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.primary + '30', // Stronger border to emphasize edit mode
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  inlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    lineHeight: 24,
  },
  inlineClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: tokens.spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  fieldHint: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
  },
  textInput: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  segmentButtonActive: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  segmentLabelActive: {
    color: tokens.colors.surface,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
  },
});
