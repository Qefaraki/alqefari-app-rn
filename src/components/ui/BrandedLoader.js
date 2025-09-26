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
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sizeMap = {
    small: 24,
    medium: 48,
    large: 80,
  };

  const logoSize = sizeMap[size] || sizeMap.medium;

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
      <Image
        source={require('../../../assets/logo/AlqefariEmblem.png')}
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
            tintColor: '#242121', // Black
          },
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    aspectRatio: 1,
  },
});

export default BrandedLoader;