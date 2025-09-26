import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BrandedLoader = ({
  size = 'medium',
  showText = true,
  text = 'جاري التحميل...',
  color = '#A13333', // Najdi Crimson
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0.5)).current;

  const sizeMap = {
    small: { logo: 24, fontSize: 12 },
    medium: { logo: 48, fontSize: 14 },
    large: { logo: 80, fontSize: 16 },
  };

  const dimensions = sizeMap[size] || sizeMap.medium;

  useEffect(() => {
    // Pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Text fade animation
    if (showText) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: pulseAnim },
              { rotate: spin },
            ],
          },
        ]}
      >
        <Image
          source={require('../../../assets/logo/AlqefariEmblem.png')}
          style={[
            styles.logo,
            {
              width: dimensions.logo,
              height: dimensions.logo,
              tintColor: color,
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>

      {showText && (
        <Animated.Text
          style={[
            styles.text,
            {
              fontSize: dimensions.fontSize,
              opacity: textOpacity,
            },
          ]}
        >
          {text}
        </Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    aspectRatio: 1,
  },
  text: {
    marginTop: 12,
    fontFamily: 'SF Arabic',
    color: '#24212199', // Sadu Night 60%
    textAlign: 'center',
  },
});

export default BrandedLoader;