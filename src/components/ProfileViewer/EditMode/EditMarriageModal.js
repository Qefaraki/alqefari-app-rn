import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import tokens from '../../ui/tokens';

const EditMarriageModal = ({ visible, marriage, onClose, onSaved }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('current');
  const [saving, setSaving] = useState(false);

  // Initialize form when marriage changes
  useEffect(() => {
    if (marriage) {
      // Extract year from full date (YYYY-MM-DD → YYYY)
      const extractYear = (dateStr) => {
        if (!dateStr) return '';
        const match = dateStr.match(/^(\d{4})/);
        return match ? match[1] : '';
      };

      setStartDate(extractYear(marriage.start_date || marriage.marriage_date));
      setEndDate(extractYear(marriage.end_date));

      // Map both old and new status values correctly
      const rawStatus = marriage.status || 'current';
      // Old values: 'married' → 'current', 'divorced'/'widowed' → 'past'
      // New values: 'current' stays 'current', 'past' stays 'past'
      let mappedStatus;
      if (rawStatus === 'current' || rawStatus === 'married') {
        mappedStatus = 'current';
      } else {
        mappedStatus = 'past'; // 'past', 'divorced', 'widowed' all → 'past'
      }
      setStatus(mappedStatus);
    }
  }, [marriage]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  const validateYear = (yearString) => {
    if (!yearString) return true; // Empty is OK
    // Accept YYYY format only
    const yearRegex = /^\d{4}$/;
    if (!yearRegex.test(yearString)) {
      return false;
    }
    const year = parseInt(yearString, 10);
    // Reasonable year range: 1900-2100
    return year >= 1900 && year <= 2100;
  };

  const handleSave = async () => {
    // Validation
    if (startDate && !validateYear(startDate)) {
      Alert.alert('خطأ', 'سنة بداية الزواج غير صحيحة. أدخل 4 أرقام فقط\nمثال: 2020');
      return;
    }

    if (endDate && !validateYear(endDate)) {
      Alert.alert('خطأ', 'سنة انتهاء الزواج غير صحيحة. أدخل 4 أرقام فقط\nمثال: 2023');
      return;
    }

    // Validate logic: end year must be after start year
    if (startDate && endDate) {
      const startYear = parseInt(startDate, 10);
      const endYear = parseInt(endDate, 10);
      if (endYear <= startYear) {
        Alert.alert('خطأ', 'سنة انتهاء الزواج يجب أن تكون بعد سنة البداية');
        return;
      }
    }

    // If status is current, end date should be null
    if (status === 'current' && endDate) {
      Alert.alert(
        'تأكيد',
        'الزواج الحالي لا يحتاج لتاريخ نهاية. هل تريد المتابعة وإزالة تاريخ النهاية؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'متابعة',
            onPress: () => saveMarriage(null),
          },
        ]
      );
      return;
    }

    await saveMarriage(endDate || null);
  };

  const saveMarriage = async (finalEndDate) => {
    setSaving(true);
    try {
      // Convert year (YYYY) to full date format (YYYY-01-01) for database
      const yearToDate = (yearStr) => {
        if (!yearStr) return null;
        return `${yearStr}-01-01`;
      };

      const updates = {
        start_date: yearToDate(startDate),
        end_date: yearToDate(finalEndDate),
        status,
      };

      const { error } = await supabase.rpc('admin_update_marriage', {
        p_marriage_id: marriage.marriage_id,
        p_updates: updates,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose?.();
    } catch (error) {
      if (__DEV__) {
        console.error('Error updating marriage:', error);
      }
      Alert.alert('خطأ', `فشل تحديث بيانات الزواج: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!marriage) return null;

  const spouseName = marriage.spouse_profile?.name || 'غير معروف';
  const isMunasib = marriage.munasib || marriage.spouse_profile?.hid === null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="heart-outline" size={20} color={tokens.colors.najdi.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>تعديل الزواج</Text>
              <Text style={styles.headerSubtitle}>{spouseName}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={tokens.colors.najdi.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Marriage Status Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="ribbon-outline" size={18} color={tokens.colors.najdi.secondary} />
              <Text style={styles.sectionTitle}>حالة الزواج</Text>
            </View>

            <View style={styles.statusSelector}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'current' && styles.statusOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus('current');
                }}
              >
                <View style={[styles.radioButton, status === 'current' && styles.radioButtonActive]}>
                  {status === 'current' && <View style={styles.radioButtonInner} />}
                </View>
                <Ionicons
                  name="heart"
                  size={18}
                  color={status === 'current' ? tokens.colors.success : tokens.colors.najdi.textSecondary}
                />
                <Text style={[styles.statusOptionText, status === 'current' && styles.statusOptionTextActive]}>
                  حالي
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'past' && styles.statusOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus('past');
                }}
              >
                <View style={[styles.radioButton, status === 'past' && styles.radioButtonActive]}>
                  {status === 'past' && <View style={styles.radioButtonInner} />}
                </View>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={status === 'past' ? tokens.colors.najdi.textSecondary : tokens.colors.najdi.textSecondary}
                />
                <Text style={[styles.statusOptionText, status === 'past' && styles.statusOptionTextActive]}>
                  سابق
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Marriage Dates Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={tokens.colors.najdi.secondary} />
              <Text style={styles.sectionTitle}>السنوات</Text>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>سنة البداية</Text>
                <TextInput
                  style={styles.yearInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="مثال: 2020"
                  placeholderTextColor={tokens.colors.najdi.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              {status !== 'current' && (
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>سنة النهاية</Text>
                  <TextInput
                    style={styles.yearInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="مثال: 2023"
                    placeholderTextColor={tokens.colors.najdi.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Marriage Info */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={16} color={tokens.colors.najdi.textSecondary} />
              <Text style={styles.infoText}>
                عدد الأبناء: {marriage.children_count || 0}
              </Text>
            </View>
            {isMunasib && (
              <View style={styles.infoRow}>
                <Ionicons name="globe-outline" size={16} color={tokens.colors.najdi.secondary} />
                <Text style={styles.infoText}>من خارج عائلة القفاري</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer with Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={tokens.colors.najdi.background} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={tokens.colors.najdi.background} />
                <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.divider,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: tokens.colors.najdi.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  section: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  statusSelector: {
    gap: tokens.spacing.xs,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    backgroundColor: 'rgba(209, 187, 163, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(209, 187, 163, 0.4)',
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    minHeight: 56,
  },
  statusOptionActive: {
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
    borderColor: tokens.colors.najdi.primary,
    borderWidth: 1.5,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
    flex: 1,
  },
  statusOptionTextActive: {
    color: tokens.colors.najdi.primary,
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(209, 187, 163, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonActive: {
    borderColor: tokens.colors.najdi.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.najdi.primary,
  },
  fieldGroup: {
    marginBottom: tokens.spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.najdi.textSecondary,
    marginBottom: tokens.spacing.xs,
  },
  textInput: {
    backgroundColor: 'rgba(209, 187, 163, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(209, 187, 163, 0.4)',
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    fontSize: 16,
    color: tokens.colors.najdi.text,
    minHeight: 44,
  },
  fieldHint: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  yearInput: {
    backgroundColor: 'rgba(209, 187, 163, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(209, 187, 163, 0.4)',
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
    minHeight: 48,
  },
  infoBox: {
    backgroundColor: 'rgba(161, 51, 51, 0.04)',
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: tokens.colors.najdi.textSecondary,
  },
  footer: {
    padding: tokens.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.background,
  },
});

export default EditMarriageModal;
