import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../ui/tokens';

const TabFamily = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="construct-outline"
            size={48}
            color={tokens.colors.najdi.textMuted}
          />
        </View>
        <Text style={styles.title}>قيد التطوير</Text>
        <Text style={styles.subtitle}>
          ستتوفر ميزة تعديل العلاقات العائلية قريباً
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xxl,
  },
  content: {
    alignItems: 'center',
    gap: tokens.spacing.md,
    maxWidth: 280,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.najdi.container + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  title: {
    fontSize: 22, // iOS title2
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15, // iOS subheadline
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default TabFamily;
