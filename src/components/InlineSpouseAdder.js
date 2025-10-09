import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
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
import tokens from "./ui/tokens";

export default function InlineSpouseAdder({
  person,
  onAdded,
  visible = false,
  onCancel,
  onNeedsSearch, // NEW: Callback when Al-Qefari detected
  feedback,      // NEW: Success message
}) {
  const [spouseName, setSpouseName] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reanimated shared values
  const heightSV = useSharedValue(0);
  const opacitySV = useSharedValue(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) expand();
    else collapse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Focus input shortly after expansion finishes
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
    const trimmedName = spouseName.trim();
    if (!trimmedName) return;

    // Validate minimum 2 words (name + surname)
    const words = trimmedName.split(/\s+/);
    if (words.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الكامل مع اسم العائلة");
      return;
    }

    // Determine spouse gender
    const spouseGender = person?.gender === "male" ? "female" : "male";

    // SMART DETECTION: Check if Al-Qefari family member
    const parsed = familyNameService.parseFullName(trimmedName, spouseGender);

    if (familyNameService.isAlQefariFamily(parsed.familyName)) {
      // Al-Qefari detected → Need to search tree first
      collapse();
      if (onNeedsSearch) {
        onNeedsSearch(trimmedName); // Pass to parent to open SpouseManager
      }
      return;
    }

    // Non-Al-Qefari → Create munasib inline
    setLoading(true);
    try {
      // Extract family origin from spouse name
      const familyOrigin = parsed.familyOrigin || parsed.familyName;

      // Step 1: Create Munasib spouse profile using secure RPC
      const { data: newSpouse, error: createError } = await supabase
        .rpc('admin_create_munasib_profile', {
          p_name: trimmedName,
          p_gender: spouseGender,
          p_generation: person?.generation || 1,
          p_family_origin: familyOrigin,
          p_sibling_order: 0,
          p_status: 'alive',
          p_phone: null,
        });

      if (createError) throw createError;
      if (!newSpouse?.id) throw new Error("Failed to create spouse profile");

      // Step 2: Create the marriage
      const husband_id = person?.gender === "male" ? person.id : newSpouse.id;
      const wife_id = person?.gender === "female" ? person.id : newSpouse.id;

      const { error: marriageError } = await profilesService.createMarriage({
        husband_id,
        wife_id,
        munasib: familyOrigin, // FIXED: Use string (not boolean)
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
    <View style={styles.wrapper}>
      {/* Feedback Banner (MotherQuickActions pattern) */}
      {feedback ? (
        <View style={styles.feedback}>
          <Ionicons name="checkmark-circle" size={16} color={tokens.colors.success} />
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {/* Inline Input */}
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={22}
              color={tokens.colors.najdi.textMuted}
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={spouseName}
            onChangeText={setSpouseName}
            placeholder="مثال: فاطمة بنت محمد العتيبي"
            accessibilityLabel="الاسم الكامل"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            textAlign="right"
            editable={!loading}
          />

          {loading ? (
            <ActivityIndicator
              size="small"
              color={tokens.colors.najdi.primary}
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
                color={
                  spouseName.trim()
                    ? tokens.colors.najdi.primary
                    : tokens.colors.najdi.textMuted
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: tokens.spacing.sm,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: tokens.colors.success + "10",
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.xs,
  },
  feedbackText: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: tokens.colors.success,
    fontWeight: '600',
  },
  container: {
    backgroundColor: tokens.colors.najdi.container + "20",
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + "40",
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
    fontFamily: "SF Arabic",
    color: tokens.colors.najdi.text,
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
