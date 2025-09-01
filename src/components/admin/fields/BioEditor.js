import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import CardSurface from '../../ios/CardSurface';
import * as Haptics from 'expo-haptics';

const BioEditor = ({ value, onChange, maxLength = 500 }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [height, setHeight] = useState(84); // Initial height for 3 lines
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const counterOpacity = useRef(new Animated.Value(0.5)).current;
  
  const minHeight = 84; // 3 lines
  const maxHeight = 280; // 10 lines
  const charCount = value.length;
  const isOverLimit = charCount > maxLength;
  
  // Convert to Arabic numerals
  const toArabicNumbers = (num) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumbers[parseInt(digit)]).join('');
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate glow
    Animated.timing(glowOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    // Show counter more prominently
    Animated.timing(counterOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    
    // Remove glow
    Animated.timing(glowOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    // Dim counter
    Animated.timing(counterOpacity, {
      toValue: 0.5,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle text change
  const handleChangeText = (text) => {
    // Provide haptic feedback when reaching limit
    if (text.length === maxLength && value.length < maxLength) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    // Don't allow going over limit
    if (text.length <= maxLength) {
      onChange(text);
    }
  };

  // Handle content size change for auto-expand
  const handleContentSizeChange = (event) => {
    const contentHeight = event.nativeEvent.contentSize.height;
    const newHeight = Math.min(Math.max(contentHeight + 32, minHeight), maxHeight);
    setHeight(newHeight);
  };

  // Interpolate glow color
  const glowColor = glowOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(0, 122, 255, 0.1)'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.glowWrapper,
          {
            shadowColor: '#007AFF',
            shadowOpacity: glowOpacity,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <CardSurface radius={16} style={{ overflow: 'hidden' }}>
          <View style={[styles.inputWrapper, { minHeight: height }]}>
            <TextInput
              style={[
                styles.input,
                { height: Math.max(height - 32, 52) },
              ]}
              value={value}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onContentSizeChange={handleContentSizeChange}
              placeholder="أضف سيرة ذاتية..."
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
              textAlign="right"
              textAlignVertical="top"
              multiline
              scrollEnabled={height >= maxHeight}
              maxLength={maxLength + 1} // +1 to allow detecting over-limit
            />
            
            <Animated.View
              style={[
                styles.counter,
                { opacity: counterOpacity },
              ]}
            >
              <Text
                style={[
                  styles.counterText,
                  isOverLimit && styles.counterTextError,
                ]}
              >
                {toArabicNumbers(charCount)}/{toArabicNumbers(maxLength)}
              </Text>
            </Animated.View>
          </View>
        </CardSurface>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  glowWrapper: {
    borderRadius: 16,
  },
  inputWrapper: {
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  input: {
    fontSize: 16,
    lineHeight: 26,
    color: '#333333',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      default: 'System',
    }),
    padding: 16,
    paddingBottom: 36, // Space for counter
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    left: 16,
  },
  counterText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      default: 'System',
    }),
  },
  counterTextError: {
    color: '#EF4444',
  },
});

export default BioEditor;