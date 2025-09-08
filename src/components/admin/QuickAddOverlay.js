import React, { useState, useRef, useEffect } from "react";
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
  Modal,
  SafeAreaView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../../services/profiles";
import useStore from "../../hooks/useStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Node dimensions for preview
const NODE_WIDTH = 90;
const NODE_HEIGHT = 36;
const NODE_SPACING = 15;

// Single draggable node component
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
  const isDragging = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05);
      zIndex.value = 1000;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX + index * (NODE_WIDTH + NODE_SPACING);
      translateY.value = e.translationY;
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
      isDragging.value = false;

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
  }));

  // Update position when index changes
  useEffect(() => {
    translateX.value = withSpring(index * (NODE_WIDTH + NODE_SPACING));
  }, [index]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.nodeWrapper, animatedStyle]}>
        <View
          style={[
            styles.node,
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
            {child.name || "جديد"}
          </Text>
        </View>
        {/* Order badge */}
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{index + 1}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const QuickAddOverlay = ({ visible, parentNode, siblings = [], onClose }) => {
  const [newChildName, setNewChildName] = useState("");
  const [newChildGender, setNewChildGender] = useState("male");
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const { refreshProfile } = useStore();

  // Initialize children list
  useEffect(() => {
    if (visible && parentNode) {
      // Create ghost node for new child
      const ghost = {
        id: `ghost-${Date.now()}`,
        name: "",
        gender: "male",
        isGhost: true,
        isNew: true,
      };

      // Ghost goes first (youngest)
      setAllChildren([ghost, ...siblings.map((s) => ({ ...s, isNew: false }))]);
      setNewChildName("");
      setNewChildGender("male");

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
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
      Alert.alert("تنبيه", "يرجى إدخال اسم الطفل");
      return;
    }

    // Convert current ghost to real child
    const currentGhost = allChildren.find((c) => c.isGhost);
    if (currentGhost) {
      currentGhost.isGhost = false;
      currentGhost.name = newChildName.trim();
      currentGhost.gender = newChildGender;
    }

    // Add new ghost
    const newGhost = {
      id: `ghost-${Date.now()}`,
      name: "",
      gender: "male",
      isGhost: true,
      isNew: true,
    };

    setAllChildren((prev) =>
      [newGhost, ...prev.filter((c) => !c.isGhost), currentGhost].filter(
        Boolean,
      ),
    );
    setNewChildName("");
    setNewChildGender("male");
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
    const childrenToSave = allChildren
      .filter((child) => child.isNew && !child.isGhost && child.name)
      .map((child) => ({
        name: child.name.trim(),
        gender: child.gender,
        sibling_order: allChildren.indexOf(child),
      }));

    // Include current ghost if it has a name
    if (newChildName.trim()) {
      childrenToSave.push({
        name: newChildName.trim(),
        gender: newChildGender,
        sibling_order: 0,
      });
    }

    if (childrenToSave.length === 0) {
      Alert.alert("تنبيه", "لا يوجد أطفال للحفظ");
      return;
    }

    setLoading(true);
    try {
      // Try bulk create first
      const { error } = await profilesService.bulkCreateChildren(
        parentNode.id,
        childrenToSave,
      );

      if (error) {
        // Fallback to individual creates
        console.warn("Bulk create failed, using individual creates:", error);
        for (const child of childrenToSave) {
          await profilesService.createProfile({
            name: child.name,
            gender: child.gender,
            father_id: parentNode.gender === "male" ? parentNode.id : null,
            mother_id: parentNode.gender === "female" ? parentNode.id : null,
            sibling_order: child.sibling_order,
          });
        }
      }

      // Update existing siblings' order if changed
      const reorderedExisting = allChildren
        .filter((child) => !child.isNew && !child.isGhost)
        .forEach(async (child) => {
          const newOrder = allChildren.indexOf(child);
          const original = siblings.find((s) => s.id === child.id);
          if (original && original.sibling_order !== newOrder) {
            await profilesService.updateProfile(
              child.id,
              original.version || 1,
              {
                sibling_order: newOrder,
              },
            );
          }
        });

      Alert.alert("نجح", `تمت إضافة ${childrenToSave.length} طفل بنجاح`);

      if (refreshProfile) {
        await refreshProfile(parentNode.id);
      }

      onClose();
    } catch (error) {
      console.error("Error saving children:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const newChildrenCount = allChildren.filter(
    (c) => c.isNew && !c.isGhost && c.name,
  ).length;

  if (!visible || !parentNode) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>إضافة أطفال</Text>
              <Text style={styles.headerSubtitle}>{parentNode.name}</Text>
            </View>
            <View style={styles.headerRight} />
          </View>

          {/* Preview Section */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionLabel}>معاينة الترتيب</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewScroll}
              style={styles.previewContainer}
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
            <Text style={styles.hint}>اسحب لإعادة الترتيب</Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>اسم الطفل</Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="أدخل الاسم..."
                placeholderTextColor="#999"
                value={newChildName}
                onChangeText={handleNameChange}
                onSubmitEditing={handleAddAnother}
                returnKeyType="next"
                textAlign="right"
              />
            </View>

            <View style={styles.genderSection}>
              <Text style={styles.inputLabel}>الجنس</Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    newChildGender === "male" && styles.genderButtonActive,
                  ]}
                  onPress={() => handleGenderChange("male")}
                >
                  <Ionicons
                    name="male"
                    size={20}
                    color={newChildGender === "male" ? "#FFF" : "#666"}
                  />
                  <Text
                    style={[
                      styles.genderText,
                      newChildGender === "male" && styles.genderTextActive,
                    ]}
                  >
                    ذكر
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    newChildGender === "female" && styles.genderButtonActive,
                  ]}
                  onPress={() => handleGenderChange("female")}
                >
                  <Ionicons
                    name="female"
                    size={20}
                    color={newChildGender === "female" ? "#FFF" : "#666"}
                  />
                  <Text
                    style={[
                      styles.genderText,
                      newChildGender === "female" && styles.genderTextActive,
                    ]}
                  >
                    أنثى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Add Another Button */}
            <TouchableOpacity
              style={styles.addAnotherButton}
              onPress={handleAddAnother}
            >
              <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
              <Text style={styles.addAnotherText}>إضافة آخر</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSaveAll}
              disabled={loading || newChildrenCount === 0}
            >
              <Text style={styles.saveButtonText}>
                {loading ? "جارِ الحفظ..." : `حفظ الكل (${newChildrenCount})`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  previewSection: {
    backgroundColor: "#FFF",
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  previewContainer: {
    height: 80,
  },
  previewScroll: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  nodeWrapper: {
    position: "relative",
    marginRight: NODE_SPACING,
  },
  node: {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    backgroundColor: "#FFF",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  ghostNode: {
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#F0F9FF",
  },
  newNode: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
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
  orderBadge: {
    position: "absolute",
    bottom: -8,
    left: NODE_WIDTH / 2 - 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  orderBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  inputSection: {
    backgroundColor: "#FFF",
    marginTop: 8,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#000",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  genderSection: {
    marginBottom: 20,
  },
  genderButtons: {
    flexDirection: "row",
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  genderButtonActive: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  genderText: {
    fontSize: 15,
    color: "#666",
    fontWeight: "500",
  },
  genderTextActive: {
    color: "#FFF",
  },
  addAnotherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  addAnotherText: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0E0E0",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  saveButton: {
    backgroundColor: "#000",
    borderRadius: 12,
    paddingVertical: 16,
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
