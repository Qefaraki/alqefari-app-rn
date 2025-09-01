import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import GlassSurface from '../components/glass/GlassSurface';
import GlassButton from '../components/glass/GlassButton';

const EditProfileScreen = ({ visible, profile, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    hid: '',
    gender: 'M',
    birth_year: '',
    death_year: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        hid: profile.hid || '',
        gender: profile.gender || 'M',
        birth_year: profile.birth_year?.toString() || '',
        death_year: profile.death_year?.toString() || '',
        notes: profile.notes || '',
      });
    }
  }, [profile]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'الاسم مطلوب';
    }

    if (!formData.hid.trim()) {
      newErrors.hid = 'HID مطلوب';
    }

    if (formData.birth_year && (isNaN(formData.birth_year) || formData.birth_year < 1800 || formData.birth_year > new Date().getFullYear())) {
      newErrors.birth_year = 'سنة الميلاد غير صحيحة';
    }

    if (formData.death_year) {
      if (isNaN(formData.death_year) || formData.death_year < 1800 || formData.death_year > new Date().getFullYear()) {
        newErrors.death_year = 'سنة الوفاة غير صحيحة';
      }
      if (formData.birth_year && formData.death_year < formData.birth_year) {
        newErrors.death_year = 'سنة الوفاة يجب أن تكون بعد سنة الميلاد';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const updateData = {
        name: formData.name.trim(),
        gender: formData.gender,
        notes: formData.notes.trim() || null,
      };

      if (formData.birth_year) {
        updateData.birth_year = parseInt(formData.birth_year);
      } else {
        updateData.birth_year = null;
      }

      if (formData.death_year) {
        updateData.death_year = parseInt(formData.death_year);
      } else {
        updateData.death_year = null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      Alert.alert('نجح', 'تم تحديث الملف الشخصي بنجاح');
      if (onSave) onSave(data);
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('خطأ', 'فشل تحديث الملف الشخصي');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, value, onChangeText, error, ...props }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        textAlign="right"
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>تعديل الملف الشخصي</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Form */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <GlassSurface style={styles.formSection}>
              <InputField
                label="الاسم"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                error={errors.name}
                placeholder="أدخل الاسم الكامل"
              />

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>HID (للقراءة فقط)</Text>
                <TextInput
                  style={[styles.input, styles.readOnlyInput]}
                  value={formData.hid}
                  editable={false}
                  textAlign="right"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>الجنس</Text>
                <View style={styles.genderContainer}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      formData.gender === 'M' && styles.genderButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, gender: 'M' })}
                  >
                    <Ionicons
                      name="male"
                      size={20}
                      color={formData.gender === 'M' ? '#FFFFFF' : '#007AFF'}
                    />
                    <Text
                      style={[
                        styles.genderText,
                        formData.gender === 'M' && styles.genderTextActive,
                      ]}
                    >
                      ذكر
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      formData.gender === 'F' && styles.genderButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, gender: 'F' })}
                  >
                    <Ionicons
                      name="female"
                      size={20}
                      color={formData.gender === 'F' ? '#FFFFFF' : '#FF375F'}
                    />
                    <Text
                      style={[
                        styles.genderText,
                        formData.gender === 'F' && styles.genderTextActive,
                      ]}
                    >
                      أنثى
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.yearRow}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <InputField
                    label="سنة الميلاد"
                    value={formData.birth_year}
                    onChangeText={(text) => setFormData({ ...formData, birth_year: text })}
                    error={errors.birth_year}
                    placeholder="مثال: 1980"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={{ width: 16 }} />

                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <InputField
                    label="سنة الوفاة"
                    value={formData.death_year}
                    onChangeText={(text) => setFormData({ ...formData, death_year: text })}
                    error={errors.death_year}
                    placeholder="اختياري"
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              </View>

              <InputField
                label="ملاحظات"
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="أي معلومات إضافية"
                multiline
                numberOfLines={3}
                style={styles.notesInput}
              />
            </GlassSurface>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <GlassButton
              title="حفظ التغييرات"
              onPress={handleSave}
              loading={loading}
              style={styles.saveButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formSection: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  readOnlyInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    color: '#999999',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    textAlign: 'right',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    gap: 8,
  },
  genderButtonActive: {
    backgroundColor: '#007AFF',
  },
  genderText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  yearRow: {
    flexDirection: 'row',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  footer: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    width: '100%',
  },
});

export default EditProfileScreen;