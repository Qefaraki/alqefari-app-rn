import React from 'react';
import { View, Text } from 'react-native';

const TabFamily = ({ father, mother, children = [], marriages = [], onRequestAdvanced }) => {
  return (
    <View style={{ gap: 24 }}>
      <View style={styles.section}>
        <Text style={styles.title}>الوالدان</Text>
        {father ? (
          <Text style={styles.value}>👨 {father.name}</Text>
        ) : (
          <Text style={styles.muted}>لم يتم تحديد الوالد</Text>
        )}
        {mother ? (
          <Text style={styles.value}>👩 {mother.name}</Text>
        ) : (
          <Text style={styles.muted}>لم يتم تحديد الوالدة</Text>
        )}
        <Text style={styles.note}>لتعديل الوالدين يرجى التواصل مع المشرف.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>الزوجات ({marriages?.length || 0})</Text>
        {Array.isArray(marriages) && marriages.length > 0 ? (
          marriages.map((marriage) => (
            <Text
              key={marriage?.id || marriage?.marriage_id || marriage?.spouse_id || marriage?.spouse_name}
              style={styles.value}
            >
              • {marriage?.spouse_name || marriage?.spouse?.name || 'غير معروف'}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>لم يتم إضافة حالات زواج بعد.</Text>
        )}
        <Text style={styles.note} onPress={onRequestAdvanced}>
          تحتاج لتعديل تفاصيل الزواج؟ اطلب مساعدة المشرف.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>الأبناء ({children.length})</Text>
        {children.length > 0 ? (
          children.map((child) => (
            <Text key={child.id} style={styles.value}>
              • {child.name}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>لا توجد أبناء مسجلين.</Text>
        )}
      </View>
    </View>
  );
};

const styles = {
  section: {
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4d3440',
  },
  value: {
    fontSize: 14,
    color: '#321f27',
    fontWeight: '600',
  },
  muted: {
    fontSize: 13,
    color: '#9b848e',
  },
  note: {
    fontSize: 12,
    color: '#7a3f4e',
  },
};

export default TabFamily;
