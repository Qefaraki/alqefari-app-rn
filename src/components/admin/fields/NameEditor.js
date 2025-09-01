import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const NameEditor = ({ value, onChange, placeholder }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  // Validate name (minimum 2 characters)
  const validateName = (text) => {
    const trimmed = text.trim();
    return trimmed.length >= 2;
  };

  // Handle text change
  const handleChangeText = (text) => {
    onChange(text);
    setIsValid(validateName(text));
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate scale
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
    
    // Animate border color
    Animated.timing(borderColorAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    
    // Animate scale back
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
    
    // Animate border color
    Animated.timing(borderColorAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    // Trim whitespace on blur
    const trimmed = value.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  // Handle clear button
  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Animate clear button visibility
  useEffect(() => {
    const shouldShow = isFocused && value.length > 0;
    Animated.timing(clearButtonOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFocused, value, clearButtonOpacity]);

  // Interpolate border color
  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      !isValid ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
      !isValid ? '#EF4444' : '#007AFF'
    ],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          borderColor,
          borderWidth: 2,
        },
      ]}
    >
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          !isValid && styles.invalidInput,
        ]}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || 'الاسم'}
        placeholderTextColor="rgba(0, 0, 0, 0.3)"
        textAlign="right"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={100}
        selectTextOnFocus
      />
      
      <Animated.View
        style={[
          styles.clearButtonContainer,
          {
            opacity: clearButtonOpacity,
            transform: [
              {
                translateX: clearButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={value.length > 0 ? 'auto' : 'none'}
      >
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color="rgba(0, 0, 0, 0.3)" />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: Platform.select({
      ios: 'SF Arabic',
      default: 'System',
    }),
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  invalidInput: {
    color: '#EF4444',
  },
  clearButtonContainer: {
    position: 'absolute',
    right: 16,
  },
  clearButton: {
    padding: 4,
  },
});

export default NameEditor;