import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PendingReviewBanner = ({ pending = [], onPress }) => {
  if (!pending || pending.length === 0) return null;
  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <Ionicons name="time-outline" size={20} color="#8e4256" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>لديك {pending.length} تغييرات قيد المراجعة</Text>
        <Text style={styles.caption}>اضغط لعرض التفاصيل</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color="#8e4256" />
    </TouchableOpacity>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fde8ed',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    color: '#8e4256',
    fontWeight: '700',
  },
  caption: {
    fontSize: 12,
    color: '#a56b79',
    marginTop: 4,
  },
};

export default PendingReviewBanner;
