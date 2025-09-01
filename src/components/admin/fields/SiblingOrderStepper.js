import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import CardSurface from '../../ios/CardSurface';
import * as Haptics from 'expo-haptics';

const SiblingOrderStepper = ({ value, onChange, siblingCount = 0 }) => {
  const scaleMinusAnim = useRef(new Animated.Value(1)).current;
  const scalePlusAnim = useRef(new Animated.Value(1)).current;
  const minusOpacityAnim = useRef(new Animated.Value(1)).current;
  const numberAnim = useRef(new Animated.Value(value)).current;
  
  const canDecrement = value > 0;
  const canIncrement = true; // No upper limit
  
  // Update number animation when value changes
  useEffect(() => {
    Animated.spring(numberAnim, {
      toValue: value,
      damping: 15,
      stiffness: 400,
      useNativeDriver: false,
    }).start();
  }, [value, numberAnim]);
  
  // Update minus button opacity
  useEffect(() => {
    Animated.timing(minusOpacityAnim, {
      toValue: canDecrement ? 1 : 0.3,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [canDecrement, minusOpacityAnim]);

  // Handle decrement
  const handleDecrement = () => {
    if (!canDecrement) {
      // Error haptic when trying to go below 0
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    // Animate button press
    Animated.sequence([
      Animated.spring(scaleMinusAnim, {
        toValue: 0.9,
        damping: 15,
        stiffness: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleMinusAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 400,
        useNativeDriver: true,
      }),
    ]).start();
    
    const newValue = value - 1;
    onChange(newValue);
    
    if (newValue === 0) {
      // Success haptic when reaching 0
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Light haptic for normal decrement
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Handle increment
  const handleIncrement = () => {
    // Animate button press
    Animated.sequence([
      Animated.spring(scalePlusAnim, {
        toValue: 0.9,
        damping: 15,
        stiffness: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scalePlusAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 400,
        useNativeDriver: true,
      }),
    ]).start();
    
    onChange(value + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Convert to Arabic numerals
  const toArabicNumber = (num) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumbers[parseInt(digit)]).join('');
  };

  return (
    <View style={styles.container}>
      <CardSurface radius={28} style={styles.stepperCard}>
        <View style={styles.stepperContent}>
          {/* Minus Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              {
                opacity: minusOpacityAnim,
                transform: [{ scale: scaleMinusAnim }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleDecrement}
              disabled={!canDecrement}
              style={styles.button}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>−</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Number Display */}
          <View style={styles.numberContainer}>
            <Animated.Text
              style={[
                styles.numberText,
                {
                  transform: [
                    {
                      scale: numberAnim.interpolate({
                        inputRange: [value - 1, value, value + 1],
                        outputRange: [0.9, 1, 0.9],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              {toArabicNumber(value)}
            </Animated.Text>
          </View>

          {/* Plus Button */}
          <Animated.View
            style={[
              styles.buttonWrapper,
              {
                transform: [{ scale: scalePlusAnim }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleIncrement}
              style={styles.button}
              activeOpacity={0.7}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>+</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </CardSurface>
      
      {/* Helper text */}
      {siblingCount > 0 && (
        <Text style={styles.helperText}>
          سيكون الطفل رقم {toArabicNumber(value + 1)} من {toArabicNumber(siblingCount + 1)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  stepperCard: {
    alignSelf: 'center',
  },
  stepperContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  buttonWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '400',
    lineHeight: 24,
  },
  numberContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      default: 'System',
    }),
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      default: 'System',
    }),
    textAlign: 'center',
  },
});

export default SiblingOrderStepper;