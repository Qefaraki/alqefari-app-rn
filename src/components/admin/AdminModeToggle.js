import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useAdminMode } from '../../contexts/AdminModeContext';
import GlassSurface from '../glass/GlassSurface';

const AdminModeToggle = () => {
  const { isAdmin, isAdminMode, toggleAdminMode, loading } = useAdminMode();

  if (loading || !isAdmin) return null;

  return (
    <GlassSurface style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>وضع المسؤول</Text>
          <Text style={styles.subtitle}>تفعيل أدوات الإدارة المتقدمة</Text>
        </View>
        <Switch
          value={isAdminMode}
          onValueChange={toggleAdminMode}
          trackColor={{ false: '#767577', true: '#007AFF' }}
          thumbColor={isAdminMode ? '#FFFFFF' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
        />
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'right',
  },
});

export default AdminModeToggle;