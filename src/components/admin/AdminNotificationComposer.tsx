/**
 * Admin Notification Composer
 *
 * Super admin UI for creating and sending broadcast notifications
 * Najdi Sadu design system with iOS-inspired interaction patterns
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../ui/tokens';
import {
  previewBroadcastRecipients,
  createBroadcast,
  validateBroadcastCriteria,
} from '../../services/broadcastNotifications';
import type { BroadcastCriteria } from '../../types/notifications';

// ============================================================================
// TYPES
// ============================================================================

interface AdminNotificationComposerProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type TargetingType = 'all' | 'role' | 'gender' | 'location';
type Priority = 'normal' | 'high' | 'urgent';

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminNotificationComposer({
  onSuccess,
  onCancel,
}: AdminNotificationComposerProps) {
  // ========== STATE ==========
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetingType, setTargetingType] = useState<TargetingType>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationCollapsed, setLocationCollapsed] = useState(true);
  const [priority, setPriority] = useState<Priority>('normal');
  const [recipientCount, setRecipientCount] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  // ========== VALIDATION ==========
  const titleValid = title.trim().length >= 3 && title.length <= 200;
  const bodyValid = body.trim().length >= 10 && body.length <= 1000;
  const canSend = titleValid && bodyValid && recipientCount > 0 && !sending;

  // ========== PREVIEW RECIPIENTS (DEBOUNCED) ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRecipientPreview();
    }, 300);

    return () => clearTimeout(timer);
  }, [targetingType, selectedRoles, selectedGenders, selectedLocations]);

  const loadRecipientPreview = async () => {
    setLoadingPreview(true);

    try {
      const criteria = buildCriteria();
      const validationError = validateBroadcastCriteria(criteria);
      if (validationError) {
        setRecipientCount(0);
        return;
      }

      const { data, error } = await previewBroadcastRecipients(criteria);
      if (error) {
        console.error('Preview error:', error);
        setRecipientCount(0);
      } else {
        setRecipientCount(data?.length || 0);
      }
    } catch (err) {
      console.error('Preview exception:', err);
      setRecipientCount(0);
    } finally {
      setLoadingPreview(false);
    }
  };

  // ========== BUILD CRITERIA ==========
  const buildCriteria = (): BroadcastCriteria => {
    if (targetingType === 'all') {
      return { type: 'all' };
    }

    if (targetingType === 'role') {
      return { type: 'role', values: selectedRoles };
    }

    if (targetingType === 'gender') {
      return { type: 'gender', values: selectedGenders };
    }

    if (targetingType === 'location') {
      return { type: 'location', values: selectedLocations };
    }

    return { type: 'all' };
  };

  // ========== HANDLERS ==========
  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!canSend) return;

    Alert.alert(
      'تأكيد الإرسال',
      `هل تريد إرسال هذا الإشعار إلى ${recipientCount} ${
        recipientCount === 1
          ? 'مستخدم'
          : recipientCount === 2
          ? 'مستخدمان'
          : 'مستخدمين'
      }؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال',
          style: 'destructive',
          onPress: () => sendBroadcast(),
        },
      ]
    );
  };

  const sendBroadcast = async () => {
    setSending(true);

    try {
      const criteria = buildCriteria();
      const { data, error } = await createBroadcast({
        title: title.trim(),
        body: body.trim(),
        criteria,
        priority,
      });

      if (error) {
        Alert.alert('خطأ', error.message);
        return;
      }

      if (data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'تم الإرسال بنجاح',
          `تم إرسال الإشعار إلى ${data.total_recipients} ${
            data.total_recipients === 1
              ? 'مستخدم'
              : data.total_recipients === 2
              ? 'مستخدمان'
              : 'مستخدمين'
          }`,
          [{ text: 'حسناً', onPress: onSuccess }]
        );
      }
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const toggleTargeting = (type: TargetingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (targetingType === type && type !== 'all') {
      setTargetingType('all');
    } else {
      setTargetingType(type);
    }
  };

  const toggleRole = (role: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleGender = (gender: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenders((prev) =>
      prev.includes(gender)
        ? prev.filter((g) => g !== gender)
        : [...prev, gender]
    );
  };

  const togglePriority = (p: Priority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriority(p);
  };

  // ========== RENDER ==========
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>العنوان</Text>
          <TextInput
            style={[styles.input, !titleValid && title.length > 0 && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان الإشعار (3-200 حرف)"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            maxLength={200}
          />
          <Text style={styles.charCounter}>
            {title.length}/200 حرف
            {title.length > 0 && !titleValid && (
              <Text style={styles.errorText}> - الحد الأدنى 3 أحرف</Text>
            )}
          </Text>
        </View>

        {/* Body Input */}
        <View style={styles.section}>
          <Text style={styles.label}>نص الرسالة</Text>
          <TextInput
            style={[
              styles.input,
              styles.bodyInput,
              !bodyValid && body.length > 0 && styles.inputError,
            ]}
            value={body}
            onChangeText={setBody}
            placeholder="نص الرسالة (10-1000 حرف)"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCounter}>
            {body.length}/1000 حرف
            {body.length > 0 && !bodyValid && (
              <Text style={styles.errorText}> - الحد الأدنى 10 أحرف</Text>
            )}
          </Text>
        </View>

        {/* Targeting Section */}
        <View style={styles.section}>
          <Text style={styles.label}>المستلمون</Text>

          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'all' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('all')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'all' && styles.chipTextActive,
                ]}
              >
                الكل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'role' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('role')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'role' && styles.chipTextActive,
                ]}
              >
                حسب الدور
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'gender' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('gender')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'gender' && styles.chipTextActive,
                ]}
              >
                حسب الجنس
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'location' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('location')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'location' && styles.chipTextActive,
                ]}
              >
                حسب الموقع
              </Text>
            </TouchableOpacity>
          </View>

          {/* Role Sub-Selection */}
          {targetingType === 'role' && (
            <View style={styles.subChipRow}>
              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('admin') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('admin')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('admin') && styles.subChipTextActive,
                  ]}
                >
                  مسؤول
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('moderator') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('moderator')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('moderator') &&
                      styles.subChipTextActive,
                  ]}
                >
                  مشرف
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('user') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('user')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('user') && styles.subChipTextActive,
                  ]}
                >
                  مستخدم
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gender Sub-Selection */}
          {targetingType === 'gender' && (
            <View style={styles.subChipRow}>
              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedGenders.includes('male') && styles.subChipActive,
                ]}
                onPress={() => toggleGender('male')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedGenders.includes('male') &&
                      styles.subChipTextActive,
                  ]}
                >
                  ذكور
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedGenders.includes('female') && styles.subChipActive,
                ]}
                onPress={() => toggleGender('female')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedGenders.includes('female') &&
                      styles.subChipTextActive,
                  ]}
                >
                  إناث
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Location Section (collapsed by default) */}
          {targetingType === 'location' && (
            <View style={styles.locationSection}>
              <Text style={styles.locationHint}>
                تحديد الموقع غير مُفعّل حالياً
              </Text>
            </View>
          )}
        </View>

        {/* Priority Section */}
        <View style={styles.section}>
          <Text style={styles.label}>الأولوية</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                priority === 'normal' && styles.chipActive,
              ]}
              onPress={() => togglePriority('normal')}
            >
              <Text
                style={[
                  styles.chipText,
                  priority === 'normal' && styles.chipTextActive,
                ]}
              >
                منخفضة
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                priority === 'high' && styles.chipActive,
              ]}
              onPress={() => togglePriority('high')}
            >
              <Text
                style={[
                  styles.chipText,
                  priority === 'high' && styles.chipTextActive,
                ]}
              >
                عادية
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                priority === 'urgent' && styles.chipActive,
              ]}
              onPress={() => togglePriority('urgent')}
            >
              <Text
                style={[
                  styles.chipText,
                  priority === 'urgent' && styles.chipTextActive,
                ]}
              >
                عالية
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipient Count Preview */}
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Ionicons
              name="people-outline"
              size={20}
              color={tokens.colors.najdi.text}
            />
            <Text style={styles.previewLabel}>المستلمون:</Text>
            {loadingPreview ? (
              <ActivityIndicator
                size="small"
                color={tokens.colors.najdi.primary}
              />
            ) : (
              <Text style={styles.previewCount}>
                {recipientCount}{' '}
                {recipientCount === 1
                  ? 'مستخدم'
                  : recipientCount === 2
                  ? 'مستخدمان'
                  : 'مستخدمين'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCancel();
          }}
        >
          <Text style={styles.cancelButtonText}>إلغاء</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>إرسال</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  section: {
    marginBottom: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xs,
  },
  input: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
    textAlign: 'left',
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: tokens.spacing.sm,
  },
  charCounter: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.xxs,
    textAlign: 'left',
  },
  errorText: {
    color: tokens.colors.danger,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  chipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  chipText: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  subChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  subChip: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.container,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  subChipActive: {
    backgroundColor: tokens.colors.najdi.secondary,
    borderColor: tokens.colors.najdi.secondary,
  },
  subChipText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.text,
  },
  subChipTextActive: {
    color: '#FFFFFF',
  },
  locationSection: {
    marginTop: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: tokens.radii.md,
  },
  locationHint: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  previewLabel: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
  },
  previewCount: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.primary,
    marginLeft: 'auto',
  },
  footer: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
  },
  cancelButton: {
    flex: 1,
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.text,
  },
  sendButton: {
    flex: 2,
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: '#FFFFFF',
  },
});
