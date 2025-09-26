import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BrandedSplashLoader = ({
  text = 'جاري التحميل',
  subtitle = null,
  showSaduPattern = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Logo scale animation
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Dot loading animation
    const dotSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim3, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim3, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    dotSequence.start();

    return () => {
      dotSequence.stop();
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F9F7F3" />

      {/* Subtle Sadu pattern background */}
      {showSaduPattern && (
        <Image
          source={require('../../../assets/sadu_patterns/png/1.png')}
          style={styles.patternBackground}
          resizeMode="repeat"
        />
      )}

      {/* Logo Container */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../../assets/logo/AlqefariEmblem.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Glow effect behind logo */}
        <View style={styles.glowEffect} />
      </Animated.View>

      {/* Loading Text with dots */}
      <View style={styles.textContainer}>
        <Text style={styles.loadingText}>
          {text}
          <Animated.Text style={{ opacity: dotAnim1 }}>.</Animated.Text>
          <Animated.Text style={{ opacity: dotAnim2 }}>.</Animated.Text>
          <Animated.Text style={{ opacity: dotAnim3 }}>.</Animated.Text>
        </Text>

        {subtitle && (
          <Text style={styles.subtitleText}>{subtitle}</Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3', // Al-Jass White
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternBackground: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    opacity: 0.03, // Very subtle 3% opacity
    tintColor: '#A13333', // Najdi Crimson tint
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    tintColor: '#A13333', // Najdi Crimson
  },
  glowEffect: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#A13333',
    opacity: 0.1,
    transform: [{ scale: 1.2 }],
  },
  textContainer: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'SF Arabic',
    color: '#242121', // Sadu Night
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    fontFamily: 'SF Arabic',
    color: '#24212199', // Sadu Night 60%
  },
});

export default BrandedSplashLoader;