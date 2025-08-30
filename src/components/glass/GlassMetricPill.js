import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GlassMetricPill = ({ label, value, color = '#007AFF' }) => {
  return (
    <View style={[styles.container, { backgroundColor: `${color}10` }]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#666666',
  },
});

export default GlassMetricPill;