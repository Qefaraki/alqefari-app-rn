import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminMode } from '../../contexts/AdminModeContext';

const GlobalFAB = ({ onPress, visible = true }) => {
  const { isAdminMode } = useAdminMode();
  const scaleValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: isAdminMode && visible ? 1 : 0,
      useNativeDriver: true,
      tension: 40,
      friction: 7,
    }).start();
  }, [isAdminMode, visible, scaleValue]);

  if (!isAdminMode) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ scale: scaleValue }],
          opacity: scaleValue,
        }
      ]}
    >
      <TouchableOpacity
        style={styles.fab}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default GlobalFAB;