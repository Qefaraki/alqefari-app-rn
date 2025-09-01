import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';
import { useAdminMode } from '../../contexts/AdminModeContext';

const AdminSettingsView = () => {
  const { isAdminMode, toggleAdminMode } = useAdminMode();

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

    if (item.type === 'navigation') {
      return (
        <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      );
    }

    return <View style={styles.settingItem}>{content}</View>;
  };

  return (
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
});

export default AdminSettingsView;