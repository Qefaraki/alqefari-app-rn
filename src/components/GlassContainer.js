import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadow } from 'react-native-shadow-2';

const GlassContainer = ({
  children,
  intensity = 80,
  style,
  shadowDistance = 8,
  borderRadius = 24,
  colors = ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.75)'],
  borderColor = 'rgba(255,255,255,0.3)',
  shadowColor = '#000000',
  shadowOpacity = 0.08,
  tint = 'light',
  ...props
}) => {
  // Create the glass effect with layered components
  return (
    <Shadow
      distance={shadowDistance}
      startColor={`${shadowColor}${Math.round(shadowOpacity * 255).toString(16).padStart(2, '0')}`}
      endColor="transparent"
      offset={[0, shadowDistance / 2]}
      style={style}
    >
      <View style={[styles.container, { borderRadius }]}>
        {/* Blur layer */}
        <BlurView
          intensity={intensity}
          tint={tint}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        
        {/* Gradient overlay for glass effect */}
        <LinearGradient
          colors={colors}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        
        {/* Border */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              borderWidth: 1,
              borderColor,
            },
          ]}
        />
        
        {/* Content */}
        <View style={[styles.content, props.contentStyle]}>{children}</View>
      </View>
    </Shadow>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Platform.select({
      ios: 'transparent',
      android: 'rgba(255,255,255,0.3)', // Fallback for Android
    }),
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassContainer;