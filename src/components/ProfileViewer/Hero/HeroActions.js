import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HeroActions = ({ onMenuPress, onClose, style }) => {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={onMenuPress}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="المزيد من الخيارات"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color="#2a1620" />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity
        onPress={onClose}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="إغلاق الملف"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-down" size={18} color="#2a1620" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    gap: 6,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});

export default HeroActions;
