import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import profilesService from "../services/profiles";
import familyNameService from "../services/familyNameService";

export default function InlineSpouseAdder({
  person,
  onAdded,
  visible = false,
  onCancel,
}) {
  const [spouseName, setSpouseName] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reanimated shared values (avoid RN Animated native driver limitations)
  const heightSV = useSharedValue(0);
  const opacitySV = useSharedValue(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) expand();
    else collapse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Focus input shortly after expansion finishes (JS thread only)
  useEffect(() => {
    if (isExpanded && visible) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [isExpanded, visible]);

  const expand = () => {
    setIsExpanded(true);
    heightSV.value = withSpring(60, { damping: 18, stiffness: 220 });
    opacitySV.value = withTiming(1, { duration: 180 });
  };

  const collapse = () => {
    Keyboard.dismiss();
    heightSV.value = withTiming(0, { duration: 160 });
    opacitySV.value = withTiming(0, { duration: 140 });
    // Hide after the closing animation
    setTimeout(() => {
      setIsExpanded(false);
      setSpouseName("");
    }, 180);
  };

  const handleSave = async () => {
    if (!spouseName.trim()) return;

    setLoading(true);
    try {
      // Extract family origin from spouse name
      const familyOrigin = familyNameService.extractFamilyName(spouseName.trim());
      if (!familyOrigin) {
        console.error("Could not extract family name from:", spouseName);
        // Continue anyway - not all spouses may have clear family names
      }

      // Determine spouse gender (opposite of current person)
      const spouseGender = person?.gender === "male" ? "female" : "male";

      // Step 1: Create Munasib spouse profile using secure RPC function
      // This ensures proper permissions and audit logging
      const { data: newSpouse, error: createError } = await supabase
        .rpc('admin_create_munasib_profile', {
          p_name: spouseName.trim(),
          p_gender: spouseGender,
          p_generation: person?.generation || 1, // Same generation as spouse (min 1)
          p_family_origin: familyOrigin || null, // Store family origin if found
          p_sibling_order: 0,
          p_status: 'alive',
        });

      if (createError) throw createError;
      if (!newSpouse?.id) throw new Error("Failed to create spouse profile");

      // Step 2: Create the marriage with both IDs
      const husband_id = person?.gender === "male" ? person.id : newSpouse.id;
      const wife_id = person?.gender === "female" ? person.id : newSpouse.id;

      const { data: marriage, error: marriageError } =
        await profilesService.createMarriage({
          husband_id,
          wife_id,
          status: "current",
          munasib: true, // Mark as Munasib since spouse is from another family
        });

      if (marriageError) throw marriageError;

      if (onAdded) onAdded();
      collapse();
    } catch (error) {
      console.error("Error adding spouse:", error);
      Alert.alert(
        "خطأ",
        error.message || "فشل في إضافة الزوج/الزوجة. تحقق من البيانات وحاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    collapse();
    if (onCancel) onCancel();
  };

  const handleSubmit = () => {
    if (spouseName.trim()) handleSave();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightSV.value,
    opacity: opacitySV.value,
  }));

  if (!isExpanded && !visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
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
          placeholder={"مريم محمد السعوي"}
          accessibilityLabel="الاسم الثلاثي"
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
