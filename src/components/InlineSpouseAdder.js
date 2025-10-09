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
import PropTypes from "prop-types";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import profilesService from "../services/profiles";
import familyNameService from "../services/familyNameService";
import tokens from "./ui/tokens";

// Animation constants for consistent timing and behavior
const ANIMATION = {
  // Input focus delay after expansion completes
  INPUT_FOCUS_DELAY: 60,

  // Expansion animation
  EXPAND_HEIGHT: 60,
  EXPAND_SPRING: { damping: 18, stiffness: 220 },
  EXPAND_OPACITY_DURATION: 180,

  // Collapse animation
  COLLAPSE_HEIGHT_DURATION: 160,
  COLLAPSE_OPACITY_DURATION: 140,

  // State reset delay (must match or exceed collapse animation)
  STATE_RESET_DELAY: 180,
};

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
  const collapseTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Cleanup: Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (visible) {
      expand();
    } else {
      collapse();
    }

    // Cleanup: Clear collapse timeout on unmount or visibility change
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Focus input shortly after expansion finishes
  useEffect(() => {
    if (isExpanded && visible) {
      const id = setTimeout(() => inputRef.current?.focus(), ANIMATION.INPUT_FOCUS_DELAY);
      return () => clearTimeout(id);
    }
  }, [isExpanded, visible]);

  const expand = () => {
    setIsExpanded(true);
    heightSV.value = withSpring(ANIMATION.EXPAND_HEIGHT, ANIMATION.EXPAND_SPRING);
    opacitySV.value = withTiming(1, { duration: ANIMATION.EXPAND_OPACITY_DURATION });
  };

  const collapse = () => {
    Keyboard.dismiss();
    heightSV.value = withTiming(0, { duration: ANIMATION.COLLAPSE_HEIGHT_DURATION });
    opacitySV.value = withTiming(0, { duration: ANIMATION.COLLAPSE_OPACITY_DURATION });

    // Clear any existing timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }

    // Hide after the closing animation
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setSpouseName("");
      collapseTimeoutRef.current = null;
    }, ANIMATION.STATE_RESET_DELAY);
  };

  const handleSave = async () => {
    const trimmedName = spouseName.trim();
    if (!trimmedName) return;

    // Safety: Validate person prop exists
    if (!person || !person.gender || !person.id) {
      Alert.alert("خطأ", "معلومات الملف الشخصي غير متوفرة. يرجى إعادة المحاولة.");
      return;
    }

    // Validate minimum 2 words (name + surname)
    const words = trimmedName.split(/\s+/);
    if (words.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الكامل مع اسم العائلة");
      return;
    }

    // Determine spouse gender
    const spouseGender = person.gender === "male" ? "female" : "male";

    // SMART DETECTION: Check if Al-Qefari family member
    const parsed = familyNameService.parseFullName(trimmedName, spouseGender);

    // Safety: Validate parsing succeeded
    if (!parsed || !parsed.familyName) {
      Alert.alert("خطأ", "فشل في تحليل الاسم. يرجى التأكد من إدخال الاسم الكامل.");
      return;
    }

    if (familyNameService.isAlQefariFamily(parsed.familyName)) {
      // Al-Qefari detected → Need to search tree first
      collapse();
      if (onNeedsSearch) {
        onNeedsSearch(trimmedName); // Pass to parent to open SpouseManager
      } else {
        // Fallback: Inform user to use full modal
        Alert.alert(
          "معلومة",
          "يبدو أن الزوج/الزوجة من عائلة القفاري. يرجى استخدام نموذج الزواج الكامل للبحث في شجرة العائلة.",
          [{ text: "حسناً", onPress: handleCancel }]
        );
      }
      return;
    }

    // Non-Al-Qefari → Create munasib inline
    setLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Extract family origin from spouse name
      const familyOrigin = parsed.familyOrigin || parsed.familyName;

      // Safety: Validate family origin was extracted
      if (!familyOrigin || familyOrigin.trim().length < 2) {
        Alert.alert("خطأ", "لم يتم التعرف على اسم العائلة. يرجى التأكد من إدخال الاسم الكامل.");
        setLoading(false);
        return;
      }

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

      // Check if request was aborted
      if (signal.aborted) return;

      if (createError) throw createError;
      if (!newSpouse?.id) throw new Error("Failed to create spouse profile");

      // Step 2: Create the marriage
      const husband_id = person?.gender === "male" ? person.id : newSpouse.id;
      const wife_id = person?.gender === "female" ? person.id : newSpouse.id;

      // Safety: Check for duplicate marriage
      const { data: existingMarriage } = await supabase
        .from('marriages')
        .select('id')
        .eq('husband_id', husband_id)
        .eq('wife_id', wife_id)
        .is('deleted_at', null)
        .maybeSingle();

      // Check if request was aborted
      if (signal.aborted) return;

      if (existingMarriage) {
        Alert.alert("تنبيه", "يوجد زواج مسجل مسبقاً بين هذين الشخصين");
        setLoading(false);
        return;
      }

      const { error: marriageError } = await profilesService.createMarriage({
        husband_id,
        wife_id,
        munasib: familyOrigin, // FIXED: Use string (not boolean)
      });

      // Check if request was aborted
      if (signal.aborted) return;

      if (marriageError) throw marriageError;

      if (onAdded) onAdded();
      collapse();
    } catch (error) {
      // Silently ignore aborted requests
      if (error.name === 'AbortError') {
        return;
      }

      if (__DEV__) {
        console.error("Error adding spouse:", error);
      }

      Alert.alert(
        "خطأ",
        error.message || "فشل في إضافة الزوج/الزوجة. تحقق من البيانات وحاول مرة أخرى."
      );
    } finally {
      setLoading(false);
      // Clean up abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
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
                (!spouseName.trim() || loading) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!spouseName.trim() || loading}
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

// PropTypes validation for type safety
InlineSpouseAdder.propTypes = {
  person: PropTypes.shape({
    id: PropTypes.string.isRequired,
    gender: PropTypes.oneOf(['male', 'female']).isRequired,
    generation: PropTypes.number,
  }).isRequired,
  onAdded: PropTypes.func,
  visible: PropTypes.bool,
  onCancel: PropTypes.func,
  onNeedsSearch: PropTypes.func,
  feedback: PropTypes.string,
};

InlineSpouseAdder.defaultProps = {
  visible: false,
  onAdded: null,
  onCancel: null,
  onNeedsSearch: null,
  feedback: null,
};

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
