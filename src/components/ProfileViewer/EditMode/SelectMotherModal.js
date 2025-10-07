import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import tokens from '../../ui/tokens';

const SelectMotherModal = ({ visible, person, father, onClose, onSaved }) => {
  const [fatherSpouses, setFatherSpouses] = useState([]);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && father) {
      loadFatherSpouses();
    }
  }, [visible, father]);

  useEffect(() => {
    if (person) {
      setSelectedMotherId(person.mother_id);
    }
  }, [person]);

  const loadFatherSpouses = async () => {
    if (!father?.id) {
      setFatherSpouses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_profile_family_data', {
        p_profile_id: father.id,
      });

      if (error) throw error;

      // Get father's active spouses
      const spouses = data?.spouses || [];
      const activeSpouses = spouses.filter((s) => s.status === 'married');
      setFatherSpouses(activeSpouses);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading father spouses:', error);
      }
      Alert.alert('خطأ', 'فشل تحميل زوجات الأب');
      setFatherSpouses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  const handleSave = async () => {
    if (!person?.id) return;

    // Confirm if clearing mother
    if (!selectedMotherId && person.mother_id) {
      Alert.alert(
        'تأكيد',
        'هل أنت متأكد من إزالة الأم؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'نعم', onPress: () => saveMother() },
        ]
      );
      return;
    }

    await saveMother();
  };

  const saveMother = async () => {
    setSaving(true);
    try {
      const updates = {
        mother_id: selectedMotherId,
      };

      const { error } = await supabase.rpc('admin_update_profile', {
        p_profile_id: person.id,
        p_updates: updates,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose?.();
    } catch (error) {
      if (__DEV__) {
        console.error('Error updating mother:', error);
      }
      Alert.alert('خطأ', `فشل تحديث الأم: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleNavigateToFather = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('انتقال', 'سيتم الانتقال لملف الأب لإضافة زوجة (قيد التطوير)');
    // TODO: Navigate to father's profile
  };

  if (!father) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>اختيار الأم</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={tokens.colors.najdi.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={tokens.colors.najdi.textMuted} />
            <Text style={styles.emptyStateTitle}>لا يوجد أب محدد</Text>
            <Text style={styles.emptyStateCaption}>
              يجب تحديد الأب أولاً قبل اختيار الأم
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="woman-outline" size={20} color={tokens.colors.najdi.secondary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>اختيار الأم</Text>
              <Text style={styles.headerSubtitle}>من زوجات {father.name}</Text>
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

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
            <Text style={styles.loadingText}>جاري تحميل الزوجات...</Text>
          </View>
        ) : fatherSpouses.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyState}>
              <Ionicons name="heart-dislike-outline" size={48} color={tokens.colors.najdi.textMuted} />
              <Text style={styles.emptyStateTitle}>لا توجد زوجات</Text>
              <Text style={styles.emptyStateCaption}>
                الأب {father.name} ليس لديه زوجات مسجلات حالياً
              </Text>
              <TouchableOpacity
                style={styles.navigateButton}
                onPress={handleNavigateToFather}
              >
                <Ionicons name="person-outline" size={18} color={tokens.colors.najdi.background} />
                <Text style={styles.navigateButtonText}>انتقل لملف الأب</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-outline" size={18} color={tokens.colors.najdi.secondary} />
                <Text style={styles.sectionTitle}>
                  اختر الأم من {fatherSpouses.length} {fatherSpouses.length === 1 ? 'زوجة' : 'زوجات'}
                </Text>
              </View>

              <View style={styles.motherList}>
                {fatherSpouses.map((spouseData) => {
                  const mother = spouseData.spouse_profile;
                  const isSelected = mother.id === selectedMotherId;

                  return (
                    <TouchableOpacity
                      key={spouseData.marriage_id}
                      style={[
                        styles.motherOption,
                        isSelected && styles.motherOptionSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedMotherId(mother.id);
                      }}
                    >
                      <View style={styles.motherOptionContent}>
                        <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                          {isSelected && <View style={styles.radioButtonInner} />}
                        </View>
                        <View style={styles.motherInfo}>
                          <Text style={[styles.motherName, isSelected && styles.motherNameSelected]}>
                            {mother.name}
                          </Text>
                          {mother.hid ? (
                            <Text style={styles.motherDetail}>HID: {mother.hid}</Text>
                          ) : (
                            <View style={styles.munasibBadge}>
                              <Ionicons name="globe-outline" size={10} color={tokens.colors.najdi.secondary} />
                              <Text style={styles.munasibText}>من خارج العائلة</Text>
                            </View>
                          )}
                          {spouseData.children_count > 0 && (
                            <Text style={styles.motherDetail}>
                              {spouseData.children_count} {spouseData.children_count === 1 ? 'طفل' : 'أطفال'}
                            </Text>
                          )}
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={tokens.colors.najdi.secondary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedMotherId && person.mother_id && selectedMotherId !== person.mother_id && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={tokens.colors.najdi.primary} />
                  <Text style={styles.infoText}>سيتم تغيير الأم من الأم الحالية إلى الأم المختارة</Text>
                </View>
              )}

              {selectedMotherId && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedMotherId(null);
                  }}
                >
                  <Text style={styles.clearButtonText}>إزالة الأم</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}

        {/* Footer */}
        {!loading && fatherSpouses.length > 0 && (
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
        )}
      </View>
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
    backgroundColor: 'rgba(213, 140, 74, 0.12)',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.najdi.textSecondary,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  emptyStateCaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.lg,
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
  motherList: {
    gap: tokens.spacing.xs,
  },
  motherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(209, 187, 163, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(209, 187, 163, 0.4)',
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    minHeight: 72,
  },
  motherOptionSelected: {
    backgroundColor: 'rgba(213, 140, 74, 0.08)',
    borderColor: tokens.colors.najdi.secondary,
    borderWidth: 1.5,
  },
  motherOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    flex: 1,
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
  radioButtonSelected: {
    borderColor: tokens.colors.najdi.secondary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.najdi.secondary,
  },
  motherInfo: {
    flex: 1,
    gap: 4,
  },
  motherName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  motherNameSelected: {
    color: tokens.colors.najdi.secondary,
    fontWeight: '600',
  },
  motherDetail: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  munasibBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  munasibText: {
    fontSize: 11,
    color: tokens.colors.najdi.secondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'rgba(161, 51, 51, 0.04)',
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.najdi.text,
    lineHeight: 18,
  },
  clearButton: {
    marginTop: tokens.spacing.sm,
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.danger,
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

export default SelectMotherModal;
