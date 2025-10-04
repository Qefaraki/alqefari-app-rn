import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EditModeBanner = ({ accessMode }) => {
  if (accessMode !== 'review') return null;
  return (
    <View style={styles.container}>
      <Ionicons name="information-circle-outline" size={18} color="#7a3f4e" />
      <Text style={styles.text}>ستتم مراجعة التغييرات قبل نشرها.</Text>
    </View>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdebef',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  text: {
    fontSize: 13,
    color: '#7a3f4e',
  },
};

export default EditModeBanner;
