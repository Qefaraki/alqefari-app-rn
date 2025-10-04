import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FieldRow = ({
  label,
  value,
  icon,
  onPress,
  copyable,
  status,
}) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const content = (
    <View style={[styles.row, status ? styles.editedRow : null]}>
      <View style={{ flex: 1 }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.value}>{value}</Text>
      </View>
      {status ? (
        <View style={styles.statusPill}>
          <Ionicons name="time-outline" size={14} color="#a45160" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
      {icon ? <Ionicons name={icon} size={18} color="#736372" /> : null}
    </View>
  );

  if (onPress || copyable) {
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = {
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: '#736372',
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    color: '#242121',
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#A1333320',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#A13333',
    fontWeight: '600',
  },
  editedRow: {
    borderRightWidth: 3,
    borderRightColor: '#A13333',
    paddingRight: 12,
    backgroundColor: '#A1333310',
    borderRadius: 12,
  },
};

export default FieldRow;
