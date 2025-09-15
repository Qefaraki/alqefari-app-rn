import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../services/profiles";

export default function InlineSpouseAdder({
  person,
  onAdded,
  visible = false,
  onCancel,
}) {
  const [spouseName, setSpouseName] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      expand();
    } else {
      collapse();
    }
  }, [visible]);

  const expand = () => {
    setIsExpanded(true);
    Animated.parallel([
      Animated.spring(animatedHeight, {
        toValue: 60,
        tension: 65,
        friction: 10,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
    });
  };

  const collapse = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsExpanded(false);
      setSpouseName("");
    });
  };

  const handleSave = async () => {
    if (!spouseName.trim()) return;

    setLoading(true);
    try {
      const data = {
        [person?.gender === "male" ? "husband_id" : "wife_id"]: person.id,
        [person?.gender === "male" ? "wife_name" : "husband_name"]:
          spouseName.trim(),
        status: "married",
      };

      await profilesService.createMarriage(data);

      if (onAdded) onAdded();
      collapse();
    } catch (error) {
      console.error("Error adding spouse:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    collapse();
    if (onCancel) onCancel();
  };

  const handleSubmit = () => {
    if (spouseName.trim()) {
      handleSave();
    }
  };

  if (!isExpanded && !visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: animatedHeight,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={22} color="#C7C7CC" />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={spouseName}
          onChangeText={setSpouseName}
          placeholder={
            person?.gender === "male" ? "اسم الزوجة..." : "اسم الزوج..."
          }
          placeholderTextColor="#8E8E93"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          textAlign="right"
          editable={!loading}
        />

        {loading ? (
          <ActivityIndicator
            size="small"
            color="#007AFF"
            style={styles.saveButton}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.saveButton,
              !spouseName.trim() && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!spouseName.trim()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={spouseName.trim() ? "#007AFF" : "#C7C7CC"}
            />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 60,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: "#000",
    marginHorizontal: 12,
  },
  cancelButton: {
    padding: 4,
  },
  saveButton: {
    padding: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});
