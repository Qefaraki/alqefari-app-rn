import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface from "../glass/GlassSurface";
import profilesService from "../../services/profiles";
import { supabase } from "../../services/supabase";
import useStore from "../../hooks/useStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const NODE_WIDTH = 100;
const NODE_HEIGHT = 40;
const NODE_SPACING = 20;

// Draggable node component for reordering
const DraggableNode = ({
  child,
  index,
  totalChildren,
  onReorder,
  isGhost,
  isNew,
}) => {
  const translateX = useSharedValue(index * (NODE_WIDTH + NODE_SPACING));
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(isGhost ? 0.6 : 1);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.1);
      zIndex.value = 1000;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX + index * (NODE_WIDTH + NODE_SPACING);
      translateY.value = e.translationY;

      // Calculate potential new index
      const newIndex = Math.round(
        translateX.value / (NODE_WIDTH + NODE_SPACING),
      );
      if (newIndex !== index && newIndex >= 0 && newIndex < totalChildren) {
        runOnJS(Haptics.selectionAsync)();
      }
    })
    .onEnd(() => {
      const newIndex = Math.round(
        translateX.value / (NODE_WIDTH + NODE_SPACING),
      );
      const clampedIndex = Math.max(0, Math.min(totalChildren - 1, newIndex));

      translateX.value = withSpring(clampedIndex * (NODE_WIDTH + NODE_SPACING));
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;

      if (clampedIndex !== index) {
        runOnJS(onReorder)(child.id, index, clampedIndex);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: opacity.value,
  }));

  useEffect(() => {
    translateX.value = withSpring(index * (NODE_WIDTH + NODE_SPACING));
  }, [index]);

  // Update opacity when name changes
  useEffect(() => {
    if (isGhost) {
      opacity.value = withTiming(child.name ? 1 : 0.6);
    }
  }, [child.name, isGhost]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.node, animatedStyle]}>
        <GlassSurface
          style={[
            styles.nodeContent,
            isGhost && styles.ghostNode,
            isNew && styles.newNode,
          ]}
        >
          <Text
            style={[
              styles.nodeText,
              isGhost && !child.name && styles.ghostText,
            ]}
            numberOfLines={1}
          >
            {child.name || "جديد..."}
          </Text>
          {isNew && <Text style={styles.newBadge}>جديد</Text>}
          <Text style={styles.orderBadge}>{index + 1}</Text>
        </GlassSurface>
      </Animated.View>
    </GestureDetector>
  );
};

const QuickAddOverlay = ({
  visible,
  parentNode,
  siblings = [],
  position,
  onClose,
  onSave,
}) => {
  const [newChildName, setNewChildName] = useState("");
  const [newChildGender, setNewChildGender] = useState("male");
  const [allChildren, setAllChildren] = useState([]);
  const [newChildren, setNewChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const { refreshProfile } = useStore();

  // Initialize with existing siblings and one ghost node
  useEffect(() => {
    if (visible && parentNode) {
      const ghost = {
        id: `ghost-${Date.now()}`,
        name: "",
        gender: "male",
        isGhost: true,
        isNew: true,
      };

      // Place ghost at the beginning (youngest)
      setAllChildren([ghost, ...siblings.map((s) => ({ ...s, isNew: false }))]);
      setNewChildren([ghost]);
      setNewChildName("");

      // Focus input after a brief delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible, parentNode, siblings]);

  // Update ghost node as user types
  const handleNameChange = (text) => {
    setNewChildName(text);

    setAllChildren((prev) =>
      prev.map((child) =>
        child.isGhost
          ? { ...child, name: text, gender: newChildGender }
          : child,
      ),
    );
  };

  // Handle gender change
  const handleGenderChange = (gender) => {
    setNewChildGender(gender);

    setAllChildren((prev) =>
      prev.map((child) => (child.isGhost ? { ...child, gender } : child)),
    );
  };

  // Add another child
  const handleAddAnother = () => {
    if (!newChildName.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم الطفل أولاً");
      return;
    }

    // Convert ghost to real child
    const currentGhost = allChildren.find((c) => c.isGhost);
    if (currentGhost) {
      currentGhost.isGhost = false;
      currentGhost.name = newChildName;
      currentGhost.gender = newChildGender;
    }

    // Create new ghost
    const newGhost = {
      id: `ghost-${Date.now()}`,
      name: "",
      gender: "male",
      isGhost: true,
      isNew: true,
    };

    setAllChildren((prev) => {
      const updated = [...prev];
      // Insert new ghost at the beginning
      updated.unshift(newGhost);
      return updated;
    });

    setNewChildren((prev) => [...prev, newGhost]);
    setNewChildName("");
    setNewChildGender("male");

    // Refocus input
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Reorder children
  const handleReorder = (childId, fromIndex, toIndex) => {
    setAllChildren((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Save all children
  const handleSaveAll = async () => {
    // Filter out empty ghost and prepare data
    const childrenToSave = allChildren
      .filter((child) => child.isNew && !child.isGhost && child.name)
      .map((child, index) => ({
        name: child.name.trim(),
        gender: child.gender,
        sibling_order: allChildren.indexOf(child),
      }));

    if (childrenToSave.length === 0) {
      if (newChildName.trim()) {
        // Save the current ghost as well
        childrenToSave.push({
          name: newChildName.trim(),
          gender: newChildGender,
          sibling_order: 0,
        });
      } else {
        Alert.alert("تنبيه", "لا يوجد أطفال جدد للحفظ");
        return;
      }
    }

    setLoading(true);
    try {
      // Use bulk create RPC
      const { data, error } = await profilesService.bulkCreateChildren(
        parentNode.id,
        childrenToSave,
      );

      if (error) {
        // Fallback to individual creates if bulk fails
        console.warn(
          "Bulk create failed, falling back to individual creates:",
          error,
        );
        const promises = childrenToSave.map((child) =>
          profilesService.createProfile({
            name: child.name,
            gender: child.gender,
            father_id: parentNode.gender === "male" ? parentNode.id : null,
            mother_id: parentNode.gender === "female" ? parentNode.id : null,
            sibling_order: child.sibling_order,
          }),
        );

        await Promise.all(promises);
      }

      Alert.alert("نجح", `تمت إضافة ${childrenToSave.length} طفل بنجاح`);

      // Update existing siblings' order if needed
      const reorderedExisting = allChildren
        .filter((child) => !child.isNew && !child.isGhost)
        .map((child, index) => ({
          id: child.id,
          sibling_order: allChildren.indexOf(child),
        }));

      // Update sibling orders if any changed
      for (const child of reorderedExisting) {
        const original = siblings.find((s) => s.id === child.id);
        if (original && original.sibling_order !== child.sibling_order) {
          await profilesService.updateProfile(child.id, {
            sibling_order: child.sibling_order,
          });
        }
      }

      // Refresh the parent's profile to update the tree
      if (refreshProfile) {
        await refreshProfile(parentNode.id);
      }

      onClose();
    } catch (error) {
      console.error("Error saving children:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ الأطفال");
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !parentNode) return null;

  return (
    <View style={styles.overlay}>
      <BlurView intensity={80} style={StyleSheet.absoluteFillObject}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : "height"}
        style={styles.container}
      >
        {/* Parent Node */}
        <View style={styles.parentSection}>
          <GlassSurface style={styles.parentNode}>
            <Text style={styles.parentName}>{parentNode.name}</Text>
          </GlassSurface>
          <View style={styles.connectionLine} />
        </View>

        {/* Children Preview Row */}
        <GestureHandlerRootView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childrenRow}
            style={styles.childrenScroll}
          >
            {allChildren.map((child, index) => (
              <DraggableNode
                key={child.id}
                child={child}
                index={index}
                totalChildren={allChildren.length}
                onReorder={handleReorder}
                isGhost={child.isGhost}
                isNew={child.isNew}
              />
            ))}
          </ScrollView>
        </GestureHandlerRootView>

        {/* Input Section */}
        <GlassSurface style={styles.inputSection}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.nameInput}
              placeholder="اسم الطفل..."
              placeholderTextColor="#999"
              value={newChildName}
              onChangeText={handleNameChange}
              onSubmitEditing={handleAddAnother}
              returnKeyType="next"
              textAlign="right"
            />
          </View>

          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                newChildGender === "male" && styles.genderButtonActive,
              ]}
              onPress={() => handleGenderChange("male")}
            >
              <Text
                style={[
                  styles.genderText,
                  newChildGender === "male" && styles.genderTextActive,
                ]}
              >
                ♂ ذكر
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                newChildGender === "female" && styles.genderButtonActive,
              ]}
              onPress={() => handleGenderChange("female")}
            >
              <Text
                style={[
                  styles.genderText,
                  newChildGender === "female" && styles.genderTextActive,
                ]}
              >
                ♀ أنثى
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddAnother}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.addButtonText}>إضافة آخر</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSaveAll}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading
                  ? "جارِ الحفظ..."
                  : `حفظ الكل (${newChildren.filter((c) => !c.isGhost).length})`}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  parentSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  parentNode: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  parentName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  connectionLine: {
    width: 2,
    height: 30,
    backgroundColor: "#BDBDBD",
    marginTop: -1,
  },
  childrenScroll: {
    maxHeight: 80,
  },
  childrenRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  node: {
    position: "absolute",
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  },
  nodeContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  ghostNode: {
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#007AFF",
    opacity: 0.7,
  },
  newNode: {
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    borderColor: "#34C759",
    borderWidth: 1,
  },
  nodeText: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
  },
  ghostText: {
    color: "#999",
    fontStyle: "italic",
  },
  newBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#34C759",
    color: "#FFF",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: "600",
  },
  orderBadge: {
    position: "absolute",
    bottom: -8,
    left: NODE_WIDTH / 2 - 10,
    backgroundColor: "#007AFF",
    color: "#FFF",
    fontSize: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "600",
  },
  inputSection: {
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
  },
  inputRow: {
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  genderText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  genderTextActive: {
    color: "#FFF",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  addButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#34C759",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
  },
});

export default QuickAddOverlay;
