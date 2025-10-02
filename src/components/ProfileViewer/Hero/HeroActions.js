import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACTION_HEIGHT = 42;

const HeroActions = ({ onMenuPress }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onMenuPress}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="المزيد من الخيارات"
      >
        <Ionicons name="ellipsis-horizontal" size={20} color="#47323c" />
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  iconButton: {
    width: ACTION_HEIGHT,
    height: ACTION_HEIGHT,
    borderRadius: ACTION_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
};

export default HeroActions;
