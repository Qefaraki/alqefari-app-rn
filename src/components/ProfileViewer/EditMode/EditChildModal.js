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

const EditChildModal = ({ visible, child, father, spouses = [], onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('male');
  const [motherId, setMotherId] = useState(null);
  const [status, setStatus] = useState('living');
  const [currentResidence, setCurrentResidence] = useState('');
  const [occupation, setOccupation] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize form when child changes
  useEffect(() => {
    if (child) {
      setName(child.name || '');
      setGender(child.gender || 'male');
      setMotherId(child.mother_id || null);
      setStatus(child.status || 'living');
      setCurrentResidence(child.current_residence || '');
      setOccupation(child.occupation || '');
      setPhone(child.phone || '');
    }
  }, [child]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال الاسم');
      return;
    }

    if (!gender) {
      Alert.alert('خطأ', 'يرجى اختيار الجنس');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        gender,
        mother_id: motherId,
        status,
        current_residence: currentResidence.trim() || null,
        occupation: occupation.trim() || null,
        phone: phone.trim() || null,
      };

      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: child.id,
        p_version: child.version || 1, // Optimistic locking with fallback
        p_updates: updates,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose?.();
    } catch (error) {
      if (__DEV__) {
        console.error('Error updating child:', error);
      }
      Alert.alert('خطأ', `فشل تحديث البيانات: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Show ALL spouses (current or married for backward compatibility)
  // Children can have mothers from past marriages
  const availableSpouses = spouses; // No filter - show all spouses
  const selectedMother = availableSpouses.find((s) => s.spouse_profile?.id === motherId);

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
              <Ionicons name="create-outline" size={20} color={tokens.colors.najdi.primary} />
            </View>
            <Text style={styles.headerTitle}>
              تعديل بيانات {gender === 'male' ? 'الابن' : 'الابنة'}
            </Text>
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
          {/* Basic Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={18} color={tokens.colors.najdi.secondary} />
              <Text style={styles.sectionTitle}>المعلومات الأساسية</Text>
            </View>

            {/* Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الاسم الكامل *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="مثال: محمد"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Gender Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الجنس *</Text>
              <View style={styles.segmentControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonLeft,
                    gender === 'male' && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setGender('male');
                  }}
                >
                  <Ionicons
                    name="male"
                    size={18}
                    color={gender === 'male' ? tokens.colors.najdi.primary : tokens.colors.najdi.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      gender === 'male' && styles.segmentButtonTextActive,
                    ]}
                  >
                    ذكر
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonRight,
                    gender === 'female' && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setGender('female');
                  }}
                >
                  <Ionicons
                    name="female"
                    size={18}
                    color={gender === 'female' ? tokens.colors.najdi.secondary : tokens.colors.najdi.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      gender === 'female' && styles.segmentButtonTextActive,
                    ]}
                  >
                    أنثى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الحالة</Text>
              <View style={styles.segmentControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonLeft,
                    status === 'living' && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStatus('living');
                  }}
                >
                  <Ionicons
                    name="heart-outline"
                    size={18}
                    color={status === 'living' ? tokens.colors.success : tokens.colors.najdi.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      status === 'living' && styles.segmentButtonTextActive,
                    ]}
                  >
                    على قيد الحياة
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonRight,
                    status === 'deceased' && styles.segmentButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStatus('deceased');
                  }}
                >
                  <Ionicons
                    name="flower-outline"
                    size={18}
                    color={status === 'deceased' ? tokens.colors.najdi.textSecondary : tokens.colors.najdi.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      status === 'deceased' && styles.segmentButtonTextActive,
                    ]}
                  >
                    متوفى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Mother Selection Section */}
          {father && availableSpouses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="woman-outline" size={18} color={tokens.colors.najdi.secondary} />
                <Text style={styles.sectionTitle}>الأم</Text>
              </View>

              <View style={styles.motherSelector}>
                {availableSpouses.map((spouseData) => {
                  const isSelected = spouseData.spouse_profile?.id === motherId;
                  const mother = spouseData.spouse_profile;

                  return (
                    <TouchableOpacity
                      key={spouseData.marriage_id}
                      style={[
                        styles.motherOption,
                        isSelected && styles.motherOptionSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMotherId(mother.id);
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
                          {mother.hid && (
                            <Text style={styles.motherHid}>HID: {mother.hid}</Text>
                          )}
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={tokens.colors.najdi.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {motherId && (
                <TouchableOpacity
                  style={styles.clearMotherButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMotherId(null);
                  }}
                >
                  <Text style={styles.clearMotherButtonText}>إزالة الأم</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Optional Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={tokens.colors.najdi.secondary} />
              <Text style={styles.sectionTitle}>معلومات إضافية (اختياري)</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>مكان الإقامة</Text>
              <TextInput
                style={styles.textInput}
                value={currentResidence}
                onChangeText={setCurrentResidence}
                placeholder="مثال: الرياض"
                placeholderTextColor={tokens.colors.najdi.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>المهنة</Text>
              <TextInput
                style={styles.textInput}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="مثال: مهندس"
                placeholderTextColor={tokens.colors.najdi.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>رقم الجوال</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="مثال: +966501234567"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                keyboardType="phone-pad"
              />
            </View>
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
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
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
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(209, 187, 163, 0.2)',
    borderRadius: tokens.radii.md,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
  },
  segmentButtonLeft: {
    marginRight: 2,
  },
  segmentButtonRight: {
    marginLeft: 2,
  },
  segmentButtonActive: {
    backgroundColor: tokens.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.textSecondary,
  },
  segmentButtonTextActive: {
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  motherSelector: {
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
    minHeight: 60,
  },
  motherOptionSelected: {
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
    borderColor: tokens.colors.najdi.primary,
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
    borderColor: tokens.colors.najdi.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.najdi.primary,
  },
  motherInfo: {
    flex: 1,
  },
  motherName: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  motherNameSelected: {
    color: tokens.colors.najdi.primary,
    fontWeight: '600',
  },
  motherHid: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginTop: 2,
  },
  clearMotherButton: {
    marginTop: tokens.spacing.sm,
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  clearMotherButtonText: {
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

export default EditChildModal;
