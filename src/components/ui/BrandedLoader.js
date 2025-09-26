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
  text = 'شجرة القفاري',
  color = '#A13333', // Najdi Crimson
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sizeMap = {
    small: { logo: 24, fontSize: 12 },
    medium: { logo: 48, fontSize: 14 },
    large: { logo: 80, fontSize: 16 },
  };

  const dimensions = sizeMap[size] || sizeMap.medium;

  useEffect(() => {
    // Simple fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      <View style={styles.logoContainer}>
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
      </View>

      {showText && (
        <Text
          style={[
            styles.text,
            {
              fontSize: dimensions.fontSize,
            },
          ]}
        >
          {text}
        </Text>
      )}
    </Animated.View>
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