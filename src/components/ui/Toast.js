/**
 * Toast Component
 *
 * Lightweight toast notification using existing design system.
 * No external dependencies needed - uses Moti for animations.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';

const Toast = ({ visible, message, type = 'success', onDismiss, duration = 3000 }) => {
  useEffect(() => {
    if (visible && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss, duration]);

  if (!visible) return null;

  const config = getToastConfig(type);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -20 }}
      transition={{ type: 'timing', duration: 300 }}
      style={[styles.container, { backgroundColor: config.backgroundColor }]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={[styles.message, { color: config.textColor }]} numberOfLines={2}>
        {message}
      </Text>
    </MotiView>
  );
};

const getToastConfig = (type) => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: tokens.colors.success,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: 'checkmark-circle',
      };
    case 'error':
      return {
        backgroundColor: tokens.colors.danger,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: 'alert-circle',
      };
    case 'info':
      return {
        backgroundColor: tokens.colors.accent,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: 'information-circle',
      };
    default:
      return {
        backgroundColor: tokens.colors.najdi.text,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: 'information-circle',
      };
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    zIndex: 9999,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  message: {
    ...tokens.typography.callout,
    fontWeight: '600',
    marginLeft: tokens.spacing.xs,
    flex: 1,
  },
});

export default Toast;
