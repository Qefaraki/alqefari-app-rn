import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tokens from '../tokens';

/**
 * Shimmer loading component with Najdi Sadu aesthetic
 * Uses animated gradient for smooth loading effect
 */
const Shimmer = ({
  width = '100%',
  height = 20,
  borderRadius = tokens.radii.sm,
  style
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 500, // Design system "slow" animation duration
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    // CRITICAL: Stop animation on unmount to prevent memory leak
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View
      style={[
        styles.shimmerContainer,
        {
          width: typeof width === 'number' ? width : width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmerGradient,
          {
            opacity,
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            `${tokens.colors.najdi.container  }40`, // #D1BBA340 (25% opacity)
            `${tokens.colors.najdi.container  }80`, // #D1BBA380 (50% opacity)
            `${tokens.colors.najdi.container  }40`, // #D1BBA340 (25% opacity)
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerContainer: {
    backgroundColor: `${tokens.colors.najdi.container  }20`, // #D1BBA320 base
    overflow: 'hidden',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
});

export default Shimmer;
