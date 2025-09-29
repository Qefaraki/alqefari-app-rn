import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';
import { useAdminMode } from '../../contexts/AdminModeContext';
import adminContactService from '../../services/adminContact';

const AdminSettingsView = () => {
  const { isAdminMode, toggleAdminMode } = useAdminMode();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [editingWhatsapp, setEditingWhatsapp] = useState(false);
  const [tempWhatsappNumber, setTempWhatsappNumber] = useState('');

  // Load current WhatsApp number on mount
  useEffect(() => {
    loadWhatsAppNumber();
  }, []);

  const loadWhatsAppNumber = async () => {
    const number = await adminContactService.getDisplayNumber();
    setWhatsappNumber(number);
  };

  const handleSaveWhatsApp = async () => {
    const result = await adminContactService.setAdminWhatsAppNumber(tempWhatsappNumber);
    if (result.success) {
      setWhatsappNumber(await adminContactService.getDisplayNumber());
      setEditingWhatsapp(false);
      Alert.alert('نجح', 'تم تحديث رقم الواتساب بنجاح');
    } else {
      Alert.alert('خطأ', result.error || 'فشل تحديث رقم الواتساب');
    }
  };

  const settingsSections = [
    {
      title: 'عام',
      items: [
        {
          id: 'adminMode',
          title: 'وضع المسؤول',
          subtitle: 'تفعيل أدوات الإدارة المتقدمة',
          icon: 'shield-checkmark-outline',
          type: 'switch',
          value: isAdminMode,
          onValueChange: toggleAdminMode,
        },
        {
          id: 'autoSave',
          title: 'الحفظ التلقائي',
          subtitle: 'حفظ التغييرات تلقائياً',
          icon: 'save-outline',
          type: 'switch',
          value: true,
          onValueChange: () => {},
        },
      ],
    },
    {
      title: 'الأمان',
      items: [
        {
          id: 'twoFactor',
          title: 'التحقق بخطوتين',
          subtitle: 'طبقة حماية إضافية',
          icon: 'lock-closed-outline',
          type: 'navigation',
        },
        {
          id: 'sessionTimeout',
          title: 'مهلة الجلسة',
          subtitle: '30 دقيقة',
          icon: 'time-outline',
          type: 'navigation',
        },
      ],
    },
    {
      title: 'البيانات',
      items: [
        {
          id: 'backup',
          title: 'النسخ الاحتياطي',
          subtitle: 'إدارة النسخ الاحتياطية',
          icon: 'cloud-outline',
          type: 'navigation',
        },
        {
          id: 'export',
          title: 'تصدير البيانات',
          subtitle: 'تصدير جميع البيانات',
          icon: 'download-outline',
          type: 'navigation',
        },
      ],
    },
    {
      title: 'الدعم والتواصل',
      items: [
        {
          id: 'whatsapp',
          title: 'رقم واتساب الإدارة',
          subtitle: whatsappNumber,
          icon: 'logo-whatsapp',
          type: 'editable',
          value: whatsappNumber,
          onPress: () => {
            setTempWhatsappNumber(whatsappNumber.replace(/\s/g, ''));
            setEditingWhatsapp(true);
          },
        },
        {
          id: 'testWhatsapp',
          title: 'اختبار رابط الواتساب',
          subtitle: 'فتح محادثة تجريبية',
          icon: 'open-outline',
          type: 'navigation',
          onPress: async () => {
            const result = await adminContactService.openAdminWhatsApp('رسالة تجريبية من لوحة الإدارة');
            if (!result.success) {
              Alert.alert('خطأ', 'فشل فتح الواتساب');
            }
          },
        },
      ],
    },
  ];

  const SettingItem = ({ item }) => {
    const content = (
      <>
        <View style={styles.itemLeft}>
          <View style={[styles.iconContainer, { backgroundColor: '#007AFF20' }]}>
            <Ionicons name={item.icon} size={24} color="#007AFF" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
        {item.type === 'switch' ? (
          <Switch
            value={item.value}
            onValueChange={item.onValueChange}
            trackColor={{ false: '#767577', true: '#007AFF' }}
            thumbColor={item.value ? '#FFFFFF' : '#f4f3f4'}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        )}
      </>
    );

    if (item.type === 'navigation' || item.type === 'editable') {
      return (
        <TouchableOpacity
          style={styles.settingItem}
          activeOpacity={0.7}
          onPress={item.onPress}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return <View style={styles.settingItem}>{content}</View>;
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <GlassSurface style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <View key={item.id}>
                  <SettingItem item={item} />
                  {itemIndex < section.items.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              ))}
            </GlassSurface>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>إصدار التطبيق: 1.0.0</Text>
          <Text style={styles.footerText}>آخر مزامنة: منذ 5 دقائق</Text>
        </View>
      </ScrollView>

      {/* WhatsApp Number Edit Modal */}
      {editingWhatsapp && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعديل رقم واتساب الإدارة</Text>
            <TextInput
              style={styles.input}
              value={tempWhatsappNumber}
              onChangeText={setTempWhatsappNumber}
              placeholder="+966501234567"
              keyboardType="phone-pad"
              textAlign="left"
              autoFocus
            />
            <Text style={styles.helpText}>
              أدخل الرقم بالصيغة الدولية (مثل: +966501234567)
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditingWhatsapp(false);
                  setTempWhatsappNumber('');
                }}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveWhatsApp}
              >
                <Text style={styles.saveButtonText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    marginLeft: 20,
    marginBottom: 8,
  },
  sectionContent: {
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 68,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 4,
  },
  // Modal styles
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#F2F2F7',
  },
  helpText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AdminSettingsView;