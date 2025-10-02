import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  interpolate 
} from 'react-native-reanimated';
import CardSurface from './ios/CardSurface';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GlassMetricPill = ({ 
  value, 
  label, 
  icon,
  onPress,
  style,
  valueStyle,
  labelStyle 
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(0.8);
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      disabled={!onPress}
    >
      <CardSurface radius={18} contentStyle={styles.pillContent} style={styles.cardWrapper}>
        <View style={styles.innerContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <View style={styles.textContainer}>
            <Text numberOfLines={1} style={[styles.value, valueStyle]}>
              {value}
            </Text>
            <Text numberOfLines={1} style={[styles.label, labelStyle]}>
              {label}
            </Text>
          </View>
        </View>
      </CardSurface>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    flexGrow: 1,
  },
  pillContent: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'SF Arabic',
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    color: '#6b6b6b',
    fontFamily: 'SF Arabic',
  },
});

export default GlassMetricPill;
