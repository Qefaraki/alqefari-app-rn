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
  const [status, setStatus] = useState('married');
  const [saving, setSaving] = useState(false);

  // Initialize form when marriage changes
  useEffect(() => {
    if (marriage) {
      // marriage_date is aliased from start_date in the RPC
      setStartDate(marriage.start_date || marriage.marriage_date || '');
      setEndDate(marriage.end_date || '');
      setStatus(marriage.status || 'married');
    }
  }, [marriage]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toISOString().split('T')[0];
  };

  const validateDate = (dateString) => {
    if (!dateString) return true; // Empty is OK
    // Accept YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  const handleSave = async () => {
    // Validation
    if (startDate && !validateDate(startDate)) {
      Alert.alert('خطأ', 'تاريخ بداية الزواج غير صحيح. استخدم الصيغة: YYYY-MM-DD\nمثال: 2020-01-15');
      return;
    }

    if (endDate && !validateDate(endDate)) {
      Alert.alert('خطأ', 'تاريخ نهاية الزواج غير صحيح. استخدم الصيغة: YYYY-MM-DD\nمثال: 2023-06-30');
      return;
    }

    // Validate logic: end date must be after start date
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        Alert.alert('خطأ', 'تاريخ نهاية الزواج يجب أن يكون بعد تاريخ البداية');
        return;
      }
    }

    // If status is married, end date should be null
    if (status === 'married' && endDate) {
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
      const updates = {
        start_date: startDate || null,
        end_date: finalEndDate,
        status,
      };

      const { error } = await supabase
        .from('marriages')
        .update(updates)
        .eq('id', marriage.marriage_id);

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
                  status === 'married' && styles.statusOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus('married');
                }}
              >
                <View style={[styles.radioButton, status === 'married' && styles.radioButtonActive]}>
                  {status === 'married' && <View style={styles.radioButtonInner} />}
                </View>
                <Ionicons
                  name="heart"
                  size={18}
                  color={status === 'married' ? tokens.colors.success : tokens.colors.najdi.textSecondary}
                />
                <Text style={[styles.statusOptionText, status === 'married' && styles.statusOptionTextActive]}>
                  متزوج
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'divorced' && styles.statusOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus('divorced');
                }}
              >
                <View style={[styles.radioButton, status === 'divorced' && styles.radioButtonActive]}>
                  {status === 'divorced' && <View style={styles.radioButtonInner} />}
                </View>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={status === 'divorced' ? tokens.colors.warning : tokens.colors.najdi.textSecondary}
                />
                <Text style={[styles.statusOptionText, status === 'divorced' && styles.statusOptionTextActive]}>
                  مطلق
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'widowed' && styles.statusOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatus('widowed');
                }}
              >
                <View style={[styles.radioButton, status === 'widowed' && styles.radioButtonActive]}>
                  {status === 'widowed' && <View style={styles.radioButtonInner} />}
                </View>
                <Ionicons
                  name="flower-outline"
                  size={18}
                  color={status === 'widowed' ? tokens.colors.najdi.textSecondary : tokens.colors.najdi.textSecondary}
                />
                <Text style={[styles.statusOptionText, status === 'widowed' && styles.statusOptionTextActive]}>
                  أرمل
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Marriage Dates Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={tokens.colors.najdi.secondary} />
              <Text style={styles.sectionTitle}>التواريخ</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>تاريخ بداية الزواج</Text>
              <TextInput
                style={styles.textInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD (مثال: 2020-01-15)"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.fieldHint}>الصيغة: السنة-الشهر-اليوم (2020-01-15)</Text>
            </View>

            {status !== 'married' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  تاريخ {status === 'divorced' ? 'الطلاق' : 'الوفاة'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD (مثال: 2023-06-30)"
                  placeholderTextColor={tokens.colors.najdi.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.fieldHint}>الصيغة: السنة-الشهر-اليوم (2023-06-30)</Text>
              </View>
            )}
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
