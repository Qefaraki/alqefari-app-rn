import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const NameEditor = ({ value, onChange, placeholder, fontSize = 36 }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;
  const clearButtonTranslateX = useRef(new Animated.Value(20)).current;
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

    // Trim whitespace on blur
    const trimmed = value.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  // Handle clear button
  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Animate clear button visibility
  useEffect(() => {
    const shouldShow = isFocused && value.length > 0;

    // Animate opacity
    Animated.timing(clearButtonOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Animate translateX
    Animated.timing(clearButtonTranslateX, {
      toValue: shouldShow ? 0 : 20,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFocused, value, clearButtonOpacity, clearButtonTranslateX]);

  // Determine border color based on state
  const getBorderColor = () => {
    if (!isValid) return "#EF4444";
    if (isFocused) return "#007AFF";
    return "transparent";
  };

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: getBorderColor(),
          borderWidth: 2,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.innerContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, !isValid && styles.invalidInput, { fontSize }]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || "الاسم"}
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
                  translateX: clearButtonTranslateX,
                },
              ],
            },
          ]}
          pointerEvents={value.length > 0 ? "auto" : "none"}
        >
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color="rgba(0, 0, 0, 0.3)"
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    borderRadius: 16,
    overflow: "hidden",
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: "bold",
    color: "#111827",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
    textAlign: "right",
    writingDirection: "rtl",
  },
  invalidInput: {
    color: "#EF4444",
  },
  clearButtonContainer: {
    position: "absolute",
    right: 16,
  },
  clearButton: {
    padding: 4,
  },
});

export default NameEditor;
