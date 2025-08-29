import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DefinitionList = ({ items = [] }) => {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index}>
          <View style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text numberOfLines={1} style={styles.value}>{item.value ?? '—'}</Text>
          </View>
          {index < items.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    color: '#667085',
    fontFamily: 'SF Arabic',
  },
  value: {
    fontSize: 15,
    color: '#0f172a',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.10)',
  },
});

export default DefinitionList;


