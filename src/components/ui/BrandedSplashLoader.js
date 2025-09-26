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
  text = 'شجرة القفاري',
  subtitle = null,
  showSaduPattern = false,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Simple fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
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

      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/logo/AlqefariEmblem.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Loading Text */}
      <View style={styles.textContainer}>
        <Text style={styles.loadingText}>
          {text}
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