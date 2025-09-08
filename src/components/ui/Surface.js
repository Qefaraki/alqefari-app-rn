import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import tokens from './tokens';

// Minimal native surface: white background, subtle border + shadow
const Surface = ({ children, radius = tokens.radii.lg, style, contentStyle }) => {
  return (
    <View style={[styles.wrapper, style, { borderRadius: radius }]}> 
      <View style={[styles.card, { borderRadius: radius }]}> 
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    ...(Platform.OS === 'ios' ? tokens.shadow.ios : tokens.shadow.android),
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.outline,
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
  },
});

export default Surface;

