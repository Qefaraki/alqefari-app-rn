import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import glassTokens from './tokens';

/**
 * Liquid-glass surface inspired by iOS 26 aesthetics.
 *
 * Layers (bottom to top):
 * - Blur
 * - Vertical overlay gradient (bright to dim)
 * - Specular highlight (angled sheen)
 * - Inner hairline border
 * - Content
 */
const GlassSurface = ({
  children,
  radius = glassTokens.radii.lg,
  blur = glassTokens.blurIntensity.strong,
  overlayGradient = glassTokens.surfaceOverlay.gradient,
  sheenGradient = glassTokens.highlight.sheen,
  style,
  contentStyle,
  ...rest
}) => {
  return (
    <View style={[styles.wrapper, style]} {...rest}>
      <View style={[styles.surface, { borderRadius: radius }]}> 
        {/* Blur */}
        <BlurView
          intensity={blur}
          tint="light"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />

        {/* Vertical overlay */}
        <LinearGradient
          colors={overlayGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />

        {/* Specular highlight */}
        <LinearGradient
          colors={sheenGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.sheen, { borderTopLeftRadius: radius, borderRadius: radius }]}
        />

        {/* Inner border */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: glassTokens.borders.inner,
            },
          ]}
        />

        {/* Content */}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    // Soft ambient elevation without harsh artifacts
    ...(Platform.OS === 'ios'
      ? glassTokens.elevation.ios
      : glassTokens.elevation.android),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: glassTokens.radii.lg,
  },
  surface: {
    overflow: 'hidden',
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.15)',
      android: 'rgba(255,255,255,0.22)',
    }),
  },
  content: {
    position: 'relative',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    opacity: 0.65,
  },
});

export default GlassSurface;


