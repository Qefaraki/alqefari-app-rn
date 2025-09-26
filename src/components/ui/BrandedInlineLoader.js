import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';

const BrandedInlineLoader = ({
  size = 16,
  color = '#A13333', // Najdi Crimson
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Simple fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: fadeAnim,
        },
        style,
      ]}
    >
      <Image
        source={require('../../../assets/logo/AlqefariEmblem.png')}
        style={[
          styles.logo,
          {
            width: size,
            height: size,
            tintColor: color,
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
  },
  logo: {
    aspectRatio: 1,
  },
});

export default BrandedInlineLoader;