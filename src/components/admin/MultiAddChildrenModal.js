import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import GlassSurface from '../glass/GlassSurface';
import GlassButton from '../glass/GlassButton';
import useStore from '../../hooks/useStore';

const MultiAddChildrenModal = ({ visible, onClose, parentId, parentName }) => {
  const [children, setChildren] = useState([
    { id: Date.now(), name: '', gender: 'M', birthYear: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const { refreshProfile } = useStore();

  const addChildRow = useCallback(() => {
    setChildren(prev => [
      ...prev,
      { id: Date.now() + Math.random(), name: '', gender: 'M', birthYear: '' }
    ]);
  }, []);

  const removeChildRow = useCallback((id) => {
    setChildren(prev => prev.filter(child => child.id !== id));
  }, []);

  const updateChild = useCallback((id, field, value) => {
    setChildren(prev => prev.map(child => 
      child.id === id ? { ...child, [field]: value } : child
    ));
  }, []);

  const validateChildren = () => {
    for (const child of children) {
      if (!child.name.trim()) {
        Alert.alert('خطأ', 'يرجى إدخال أسماء جميع الأطفال');
        return false;
      }
      if (child.birthYear && (isNaN(child.birthYear) || child.birthYear < 1900 || child.birthYear > new Date().getFullYear())) {
        Alert.alert('خطأ', 'سنة الميلاد غير صحيحة');
        return false;
      }
    }
    
    // Check for duplicate names
    const names = children.map(c => c.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      Alert.alert('تنبيه', 'يوجد أسماء مكررة. هل تريد المتابعة؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'متابعة', onPress: () => submitChildren(true) }
      ]);
      return false;
    }
    
    return true;
  };

  const submitChildren = async (skipValidation = false) => {
    if (!skipValidation && !validateChildren()) return;

    setLoading(true);
    try {
      // Prepare children data for RPC
      const childrenData = children.map(child => ({
        name: child.name.trim(),
        gender: child.gender,
        ...(child.birthYear && { birth_year: parseInt(child.birthYear) }),
      }));

      // Call bulk create RPC
      const { data, error } = await supabase.rpc('admin_bulk_create_children', {
        p_parent_id: parentId,
        p_children: childrenData,
      });

      if (error) throw error;

      // Show success message
      Alert.alert(
        'نجح',
        `تمت إضافة ${data.length} طفل بنجاح`,
        [{ text: 'حسناً', onPress: onClose }]
      );

      // Refresh the parent profile to update the tree
      if (refreshProfile) {
        await refreshProfile(parentId);
      }

      // Reset form
      setChildren([{ id: Date.now(), name: '', gender: 'M', birthYear: '' }]);
    } catch (error) {
      console.error('Error adding children:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء إضافة الأطفال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>إضافة أطفال</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Parent info */}
        <GlassSurface style={styles.parentInfo}>
          <Text style={styles.parentLabel}>إضافة أطفال لـ</Text>
          <Text style={styles.parentName}>{parentName}</Text>
        </GlassSurface>

        {/* Children list */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {children.map((child, index) => (
            <GlassSurface key={child.id} style={styles.childCard}>
              <View style={styles.childHeader}>
                <Text style={styles.childNumber}>الطفل {index + 1}</Text>
                {children.length > 1 && (
                  <TouchableOpacity 
                    onPress={() => removeChildRow(child.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="الاسم (مطلوب)"
                  value={child.name}
                  onChangeText={(text) => updateChild(child.id, 'name', text)}
                  textAlign="right"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.genderContainer}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      child.gender === 'M' && styles.genderButtonActive
                    ]}
                    onPress={() => updateChild(child.id, 'gender', 'M')}
                  >
                    <Text style={[
                      styles.genderText,
                      child.gender === 'M' && styles.genderTextActive
                    ]}>ذكر</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      child.gender === 'F' && styles.genderButtonActive
                    ]}
                    onPress={() => updateChild(child.id, 'gender', 'F')}
                  >
                    <Text style={[
                      styles.genderText,
                      child.gender === 'F' && styles.genderTextActive
                    ]}>أنثى</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.yearInput}
                  placeholder="سنة الميلاد"
                  value={child.birthYear}
                  onChangeText={(text) => updateChild(child.id, 'birthYear', text)}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
            </GlassSurface>
          ))}

          {/* Add another child button */}
          <TouchableOpacity onPress={addChildRow} style={styles.addButton}>
            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.addButtonText}>إضافة طفل آخر</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <GlassButton
            title={`إضافة ${children.length} ${children.length === 1 ? 'طفل' : 'أطفال'}`}
            onPress={() => submitChildren(false)}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 60,
    paddingBottom: 20,
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
  parentInfo: {
    margin: 16,
    padding: 16,
    alignItems: 'center',
  },
  parentLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  parentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  childCard: {
    marginBottom: 12,
    padding: 16,
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  childNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  removeButton: {
    padding: 4,
  },
  inputRow: {
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#007AFF',
  },
  genderText: {
    fontSize: 16,
    color: '#666666',
  },
  genderTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  yearInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  submitButton: {
    width: '100%',
  },
});

export default MultiAddChildrenModal;