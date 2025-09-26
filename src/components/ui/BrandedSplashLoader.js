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

const BrandedSplashLoader = () => {
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

      <Image
        source={require('../../../assets/logo/AlqefariEmblem.png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
  logo: {
    width: 80,
    height: 80,
    tintColor: '#242121', // Black
  },
});

export default BrandedSplashLoader;