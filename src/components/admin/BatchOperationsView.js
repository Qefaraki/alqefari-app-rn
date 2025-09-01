import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';

const BatchOperationsView = () => {
  const operations = [
    {
      id: 'import',
      title: 'استيراد مجمع',
      description: 'استيراد عدة ملفات شخصية من ملف CSV',
      icon: 'cloud-upload-outline',
      color: '#007AFF',
    },
    {
      id: 'export',
      title: 'تصدير البيانات',
      description: 'تصدير الشجرة إلى ملف Excel أو JSON',
      icon: 'cloud-download-outline',
      color: '#34C759',
    },
    {
      id: 'merge',
      title: 'دمج الملفات المكررة',
      description: 'البحث عن ودمج الملفات الشخصية المكررة',
      icon: 'git-merge-outline',
      color: '#FF9500',
    },
    {
      id: 'validate',
      title: 'التحقق من البيانات',
      description: 'التحقق من صحة البيانات وإصلاح الأخطاء',
      icon: 'checkmark-circle-outline',
      color: '#5856D6',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>العمليات المجمعة</Text>
        <Text style={styles.headerSubtitle}>
          أدوات قوية لإدارة البيانات على نطاق واسع
        </Text>
      </View>

      {operations.map((op) => (
        <TouchableOpacity key={op.id} activeOpacity={0.7}>
          <GlassSurface style={styles.operationCard}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${op.color}20` },
              ]}
            >
              <Ionicons name={op.icon} size={32} color={op.color} />
            </View>
            <View style={styles.operationInfo}>
              <Text style={styles.operationTitle}>{op.title}</Text>
              <Text style={styles.operationDescription}>{op.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </GlassSurface>
        </TouchableOpacity>
      ))}

      <View style={styles.comingSoon}>
        <Ionicons name="construct-outline" size={48} color="#C7C7CC" />
        <Text style={styles.comingSoonText}>المزيد من العمليات قريباً</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
  },
  operationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  operationInfo: {
    flex: 1,
  },
  operationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  operationDescription: {
    fontSize: 14,
    color: '#666666',
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#C7C7CC',
    marginTop: 12,
  },
});

export default BatchOperationsView;