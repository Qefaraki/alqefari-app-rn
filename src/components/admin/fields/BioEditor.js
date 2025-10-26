import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import tokens from '../../ui/tokens';
import * as Haptics from 'expo-haptics';

const BioEditor = ({ value, onChange, maxLength = 1000 }) => {
  const [height, setHeight] = useState(120); // Initial height for ~4 lines
  const counterOpacity = useRef(new Animated.Value(0.6)).current;

  const minHeight = 120; // ~4 lines minimum
  const maxHeight = 320; // ~12 lines maximum
  const charCount = value?.length || 0;
  const isNearLimit = charCount > maxLength * 0.8;
  const isOverLimit = charCount > maxLength;

  // Convert to Arabic numerals
  const toArabicNumbers = (num) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumbers[parseInt(digit)]).join('');
  };

  // Handle focus - fade in counter
  const handleFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(counterOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle blur - fade out counter
  const handleBlur = () => {
    Animated.timing(counterOpacity, {
      toValue: 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle text change with auto-truncate for paste support
  const handleChangeText = (text) => {
    // Auto-truncate if over limit (supports pasting long text)
    const truncatedText = text.slice(0, maxLength);

    // Provide haptic feedback if text was truncated
    if (text.length > maxLength) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    onChange(truncatedText);
  };

  // Handle content size change for auto-expand
  const handleContentSizeChange = (event) => {
    const contentHeight = event.nativeEvent.contentSize.height;
    // +48 accounts for padding (16 top + 16 bottom) + counter space (16)
    const newHeight = Math.min(Math.max(contentHeight + 48, minHeight), maxHeight);
    setHeight(newHeight);
  };

  return (
    <View style={[styles.inputWrapper, { minHeight: height }]}>
      <TextInput
        style={[
          styles.input,
          { height: Math.max(height - 48, minHeight - 48) },
        ]}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onContentSizeChange={handleContentSizeChange}
        placeholder="السيرة الذاتية..."
        placeholderTextColor={`${tokens.colors.najdi.textMuted}60`}
        textAlign="right"
        textAlignVertical="top"
        multiline
        scrollEnabled={true}
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
            isNearLimit && styles.counterTextWarning,
            isOverLimit && styles.counterTextError,
          ]}
        >
          {toArabicNumbers(charCount)}/{toArabicNumbers(maxLength)}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container}40`,
    position: 'relative',
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
    padding: tokens.spacing.md,
    paddingBottom: 48, // Extra space for counter
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: tokens.spacing.md,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  counterTextWarning: {
    color: tokens.colors.najdi.secondary, // Desert Ochre
  },
  counterTextError: {
    color: tokens.colors.danger,
  },
});

export default BioEditor;