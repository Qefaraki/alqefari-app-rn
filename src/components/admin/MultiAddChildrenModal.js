import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import GlassSurface from '../glass/GlassSurface';

const MultiAddChildrenModal = ({ visible, onClose, parentId, parentName, onSuccess }) => {
  const [children, setChildren] = useState([
    { id: Date.now(), name: '', gender: 'M', birthYear: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const scrollViewRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const addChild = () => {
    const newChild = {
      id: Date.now() + Math.random(),
      name: '',
      gender: 'M',
      birthYear: '',
    };
    setChildren([...children, newChild]);
    
    // Scroll to bottom after adding
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const removeChild = (id) => {
    if (children.length > 1) {
      setChildren(children.filter(child => child.id !== id));
      // Clear any errors for this child
      const newErrors = { ...errors };
      delete newErrors[id];
      setErrors(newErrors);
    }
  };

  const updateChild = (id, field, value) => {
    setChildren(children.map(child => 
      child.id === id ? { ...child, [field]: value } : child
    ));
    
    // Clear error for this field
    if (errors[id]?.[field]) {
      const newErrors = { ...errors };
      if (newErrors[id]) {
        delete newErrors[id][field];
        if (Object.keys(newErrors[id]).length === 0) {
          delete newErrors[id];
        }
      }
      setErrors(newErrors);
    }
  };

  const validateChildren = () => {
    const newErrors = {};
    let isValid = true;

    children.forEach((child, index) => {
      const childErrors = {};

      if (!child.name.trim()) {
        childErrors.name = 'الاسم مطلوب';
        isValid = false;
      }

      if (!['M', 'F'].includes(child.gender)) {
        childErrors.gender = 'الجنس مطلوب';
        isValid = false;
      }

      if (child.birthYear && (isNaN(child.birthYear) || child.birthYear < 1900 || child.birthYear > new Date().getFullYear())) {
        childErrors.birthYear = 'سنة غير صالحة';
        isValid = false;
      }

      if (Object.keys(childErrors).length > 0) {
        newErrors[child.id] = childErrors;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateChildren()) {
      Alert.alert('خطأ', 'يرجى تصحيح الأخطاء قبل المتابعة');
      return;
    }

    setLoading(true);

    try {
      // Prepare children data for RPC
      const childrenData = children.map(child => ({
        name: child.name.trim(),
        gender: child.gender,
        birth_year: child.birthYear ? parseInt(child.birthYear) : null,
        notes: child.notes || '',
      }));

      // Call bulk create RPC
      const { data, error } = await supabase.rpc('admin_bulk_create_children', {
        p_parent_id: parentId,
        p_children: childrenData,
      });

      if (error) throw error;

      // Success
      Alert.alert(
        'نجح',
        `تمت إضافة ${data.length} أطفال بنجاح`,
        [{ text: 'حسناً', onPress: () => {
          onSuccess?.(data);
          handleClose();
        }}]
      );
    } catch (error) {
      console.error('Error adding children:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء إضافة الأطفال');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      // Reset state
      setChildren([{ id: Date.now(), name: '', gender: 'M', birthYear: '' }]);
      setErrors({});
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>

        <View style={styles.modalContainer}>
          <GlassSurface style={styles.modal} contentStyle={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.title}>إضافة أطفال إلى {parentName}</Text>
            </View>

            {/* Children List */}
            <ScrollView 
              ref={scrollViewRef}
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children.map((child, index) => (
                <View key={child.id} style={styles.childRow}>
                  <View style={styles.childHeader}>
                    <Text style={styles.childNumber}>طفل {index + 1}</Text>
                    {children.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => removeChild(child.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputContainer, { flex: 2 }]}>
                      <Text style={styles.label}>الاسم *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          errors[child.id]?.name && styles.inputError
                        ]}
                        value={child.name}
                        onChangeText={(text) => updateChild(child.id, 'name', text)}
                        placeholder="اسم الطفل"
                        placeholderTextColor="#999"
                      />
                      {errors[child.id]?.name && (
                        <Text style={styles.errorText}>{errors[child.id].name}</Text>
                      )}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>الجنس *</Text>
                      <View style={styles.genderButtons}>
                        <TouchableOpacity
                          style={[
                            styles.genderButton,
                            child.gender === 'M' && styles.genderButtonActive
                          ]}
                          onPress={() => updateChild(child.id, 'gender', 'M')}
                        >
                          <Text style={[
                            styles.genderButtonText,
                            child.gender === 'M' && styles.genderButtonTextActive
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
                            styles.genderButtonText,
                            child.gender === 'F' && styles.genderButtonTextActive
                          ]}>أنثى</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>سنة الميلاد (اختياري)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors[child.id]?.birthYear && styles.inputError
                      ]}
                      value={child.birthYear}
                      onChangeText={(text) => updateChild(child.id, 'birthYear', text)}
                      placeholder="مثال: 1990"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    {errors[child.id]?.birthYear && (
                      <Text style={styles.errorText}>{errors[child.id].birthYear}</Text>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addButton} onPress={addChild}>
                <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                <Text style={styles.addButtonText}>إضافة طفل آخر</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      إضافة {children.length} {children.length === 1 ? 'طفل' : 'أطفال'}
                    </Text>
                    <Ionicons name="checkmark-circle" size={24} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    maxHeight: '90%',
    marginHorizontal: 10,
    marginBottom: 10,
  },
  modal: {
    borderRadius: 20,
  },
  modalContent: {
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      android: 'Arial',
    }),
  },
  scrollView: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  childRow: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  childNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  removeButton: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 11,
    color: '#FF3B30',
    marginTop: 4,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  genderButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  genderButtonTextActive: {
    color: 'white',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MultiAddChildrenModal;