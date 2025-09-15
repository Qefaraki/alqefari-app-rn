import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  SafeAreaView,
  I18nManager,
  Animated,
} from "react-native";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import ReAnimated from "react-native-reanimated";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../../services/profiles";
import useStore from "../../hooks/useStore";
import MotherSelector from "./fields/MotherSelector";

// Enable RTL
I18nManager.forceRTL(true);

// Card dimensions - more compact
const CARD_WIDTH = 110;
const CARD_HEIGHT = 90;
const CARD_SPACING = 10;

// Draggable Child Card Component
const DraggableChildCard = ({
  child,
  index,
  totalChildren,
  onEdit,
  onDelete,
  onReorder,
  isActive,
  isNew,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      "worklet";
      scale.value = withSpring(1.1);
      zIndex.value = 1000;
      opacity.value = withSpring(0.9);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      "worklet";
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      "worklet";
      const currentX = translateX.value;
      const cardWithSpacing = CARD_WIDTH + CARD_SPACING;
      const movement = Math.round(currentX / cardWithSpacing);
      const newIndex = Math.max(
        0,
        Math.min(totalChildren - 1, index + movement),
      );

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      opacity.value = withSpring(1);

      if (newIndex !== index) {
        runOnJS(onReorder)(child.id, index, newIndex);
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

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(child);
  };

  const handleDelete = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDelete(child.id);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <ReAnimated.View style={[styles.cardWrapper, animatedStyle]}>
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.childCard, isActive && styles.childCardActive]}
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color="#FF3B30" />
            </TouchableOpacity>

            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>{totalChildren - index}</Text>
            </View>

            <Text style={styles.childName} numberOfLines={2}>
              {child.name || "غير مسمى"}
            </Text>

            <View style={styles.genderLabel}>
              <Text
                style={[
                  styles.genderText,
                  child.gender === "male"
                    ? styles.genderMale
                    : styles.genderFemale,
                ]}
              >
                {child.gender === "male" ? "ذكر" : "أنثى"}
              </Text>
            </View>

            {isActive && (
              <View style={styles.editIndicator}>
                <Ionicons name="pencil" size={10} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ReAnimated.View>
    </GestureDetector>
  );
};

// Main QuickAddOverlay component
const QuickAddOverlay = ({ visible, parentNode, siblings = [], onClose }) => {
  const [currentChild, setCurrentChild] = useState({
    name: "",
    gender: "male",
    id: null,
  });
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [editingChildId, setEditingChildId] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [originalOrder, setOriginalOrder] = useState([]);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const { refreshProfile } = useStore();

  // Initialize with existing siblings
  useEffect(() => {
    if (visible && parentNode) {
      // Sort siblings by sibling_order (ascending = oldest to youngest)
      // sibling_order: 0 = oldest, 1 = second oldest, etc.
      const sortedSiblings = [...siblings]
        .sort((a, b) => (a.sibling_order ?? 0) - (b.sibling_order ?? 0))
        .map((s) => ({
          ...s,
          isNew: false,
          isExisting: true,
        }));

      setAllChildren(sortedSiblings);
      setOriginalOrder(sortedSiblings.map((s) => s.id));
      setCurrentChild({ name: "", gender: "male", id: null });
      setEditingChildId(null);
      setSelectedMotherId(null);
      setHasReordered(false);

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible, parentNode, siblings]);

  // Handle adding or updating a child
  const handleAddOrUpdateChild = () => {
    const trimmedName = currentChild.name.trim();
    if (!trimmedName) {
      Alert.alert("تنبيه", "يرجى إدخال اسم الطفل");
      return;
    }

    if (editingChildId) {
      // Update existing child in list
      setAllChildren((prev) =>
        prev.map((child) =>
          child.id === editingChildId
            ? { ...child, name: trimmedName, gender: currentChild.gender }
            : child,
        ),
      );
      setEditingChildId(null);
    } else {
      // Add new child to list as youngest (at the end)
      const newChild = {
        id: `new-${Date.now()}`,
        name: trimmedName,
        gender: currentChild.gender,
        isNew: true,
        isExisting: false,
        sibling_order: allChildren.length, // Will be youngest (highest sibling_order)
      };
      // Add to end of array (youngest position in RTL: leftmost)
      setAllChildren((prev) => [...prev, newChild]);
    }

    // Reset form
    setCurrentChild({ name: "", gender: "male", id: null });
    inputRef.current?.focus();

    // Scroll to show new child
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle editing a child
  const handleEditChild = (child) => {
    setCurrentChild({
      name: child.name,
      gender: child.gender,
      id: child.id,
    });
    setEditingChildId(child.id);
    inputRef.current?.focus();
  };

  // Handle deleting a child from the list
  const handleDeleteChild = (childId) => {
    setAllChildren((prev) => prev.filter((child) => child.id !== childId));
    if (editingChildId === childId) {
      setCurrentChild({ name: "", gender: "male", id: null });
      setEditingChildId(null);
    }
  };

  // Reorder children
  const handleReorder = (_, fromIndex, toIndex) => {
    setAllChildren((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Check if existing children were reordered
      const existingChildrenOrdered = updated
        .filter((c) => c.isExisting)
        .map((c) => c.id);
      const orderChanged = !originalOrder.every(
        (id, idx) => existingChildrenOrdered[idx] === id,
      );
      setHasReordered(orderChanged);

      return updated;
    });
  };

  // Save all children
  const handleSaveAll = async () => {
    const newChildren = allChildren.filter((child) => child.isNew);

    if (newChildren.length === 0 && !hasReordered) {
      Alert.alert("تنبيه", "لا يوجد تغييرات للحفظ");
      return;
    }

    setLoading(true);
    try {
      // Save new children if any
      if (newChildren.length > 0) {
        // Calculate correct sibling_order for new children
        // They should be added at their position in the array
        const childrenToSave = newChildren.map((child) => {
          const childIndex = allChildren.indexOf(child);
          return {
            name: child.name.trim(),
            gender: child.gender,
            sibling_order: childIndex, // Position in array = sibling_order
          };
        });

        // Determine parent type and save
        const { error } =
          parentNode.gender === "male" && selectedMotherId
            ? await profilesService.bulkCreateChildrenWithMother(
                parentNode.id,
                selectedMotherId,
                childrenToSave,
              )
            : await profilesService.bulkCreateChildren(
                parentNode.id,
                childrenToSave,
              );

        if (error) {
          // Fallback to individual creates
          for (const child of childrenToSave) {
            const result = await profilesService.createProfile({
              name: child.name,
              gender: child.gender,
              generation: parentNode.generation + 1,
              father_id: parentNode.gender === "male" ? parentNode.id : null,
              mother_id:
                parentNode.gender === "female"
                  ? parentNode.id
                  : selectedMotherId,
              sibling_order: child.sibling_order,
            });

            if (result.error) {
              throw new Error(
                `Failed to create ${child.name}: ${result.error}`,
              );
            }
          }
        }
      }

      // Update existing children's order if reordered
      if (hasReordered) {
        // Build array of children that need reordering
        const reorderUpdates = [];

        for (let i = 0; i < allChildren.length; i++) {
          const child = allChildren[i];
          if (child.isExisting) {
            const newOrder = i; // Position in array = new sibling_order
            // Only include if order actually changed
            if (child.sibling_order !== newOrder) {
              reorderUpdates.push({
                id: child.id,
                new_order: newOrder,
              });
            }
          }
        }

        // Use efficient batch update if there are changes
        if (reorderUpdates.length > 0) {
          const { error } = await profilesService.reorderChildren(
            parentNode.id,
            reorderUpdates,
          );

          if (error) {
            console.error("Failed to reorder children:", error);
            throw new Error("فشل في تحديث ترتيب الأطفال");
          }
        }
      }

      if (refreshProfile) {
        await refreshProfile(parentNode.id);
      }

      // Success - close with haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false); // Clear loading state BEFORE closing

      // Refresh and close
      if (refreshProfile) {
        await refreshProfile(parentNode.id);
      }

      onClose();
    } catch (error) {
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء الحفظ");
      setLoading(false); // Keep modal open on error
    }
  };

  // Calculate counts
  const newChildrenCount = allChildren.filter((c) => c.isNew).length;
  const totalChildrenCount = allChildren.length;

  if (!visible || !parentNode) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>إضافة أطفال</Text>
                <Text style={styles.headerSubtitle}>{parentNode.name}</Text>
              </View>
              <View style={styles.headerStats}>
                <Text style={styles.statsText}>{totalChildrenCount}</Text>
                <Text style={styles.statsLabel}>إجمالي</Text>
              </View>
            </View>

            {/* Horizontal Children Cards */}
            <View style={styles.cardsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {allChildren.length === 0
                    ? "ابدأ بإضافة الأطفال"
                    : "اسحب البطاقات لإعادة الترتيب"}
                </Text>
              </View>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsScrollContent}
                style={styles.cardsScroll}
              >
                {allChildren.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="person-add-outline"
                      size={32}
                      color="#C7C7CC"
                    />
                    <Text style={styles.emptyCardText}>لا يوجد أطفال</Text>
                  </View>
                ) : (
                  allChildren.map((child, index) => (
                    <DraggableChildCard
                      key={child.id}
                      child={child}
                      index={index}
                      totalChildren={allChildren.length}
                      onEdit={handleEditChild}
                      onDelete={handleDeleteChild}
                      onReorder={handleReorder}
                      isActive={editingChildId === child.id}
                      isNew={child.isNew}
                    />
                  ))
                )}
              </ScrollView>
            </View>

            {/* Input Form */}
            <View style={styles.inputForm}>
              <View style={styles.formHeader}>
                {editingChildId && (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentChild({ name: "", gender: "male", id: null });
                      setEditingChildId(null);
                    }}
                    style={styles.cancelEditButton}
                  >
                    <Text style={styles.cancelEditText}>إلغاء</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.formTitle}>
                  {editingChildId ? "تعديل الطفل" : "طفل جديد"}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={styles.nameInput}
                  placeholder="اسم الطفل..."
                  placeholderTextColor="#999"
                  value={currentChild.name}
                  onChangeText={(text) =>
                    setCurrentChild((prev) => ({ ...prev, name: text }))
                  }
                  onSubmitEditing={handleAddOrUpdateChild}
                  returnKeyType="done"
                  textAlign="right"
                />

                <View style={styles.genderSection}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      currentChild.gender === "male" &&
                        styles.genderButtonActive,
                    ]}
                    onPress={() =>
                      setCurrentChild((prev) => ({ ...prev, gender: "male" }))
                    }
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        currentChild.gender === "male" &&
                          styles.genderButtonTextActive,
                      ]}
                    >
                      ذكر
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      currentChild.gender === "female" &&
                        styles.genderButtonActive,
                    ]}
                    onPress={() =>
                      setCurrentChild((prev) => ({ ...prev, gender: "female" }))
                    }
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        currentChild.gender === "female" &&
                          styles.genderButtonTextActive,
                      ]}
                    >
                      أنثى
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.addButton,
                  !currentChild.name.trim() && styles.addButtonDisabled,
                ]}
                onPress={handleAddOrUpdateChild}
                disabled={!currentChild.name.trim()}
              >
                <Ionicons
                  name={editingChildId ? "checkmark" : "add"}
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.addButtonText}>
                  {editingChildId ? "حفظ التعديل" : "إضافة طفل"}
                </Text>
              </TouchableOpacity>

              {/* Mother Selector */}
              {parentNode?.gender === "male" && !editingChildId && (
                <View style={styles.motherSelectorContainer}>
                  <MotherSelector
                    fatherId={parentNode.id}
                    value={selectedMotherId}
                    onChange={setSelectedMotherId}
                    label="الأم (اختياري)"
                  />
                </View>
              )}
            </View>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (loading || (newChildrenCount === 0 && !hasReordered)) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleSaveAll}
                disabled={loading || (newChildrenCount === 0 && !hasReordered)}
              >
                {loading ? (
                  <Text style={styles.saveButtonText}>جارِ الحفظ...</Text>
                ) : (
                  <Text style={styles.saveButtonText}>
                    {hasReordered && newChildrenCount === 0
                      ? "حفظ الترتيب الجديد"
                      : newChildrenCount === 0
                        ? "لا يوجد تغييرات"
                        : newChildrenCount === 1 && !hasReordered
                          ? "حفظ الطفل"
                          : `حفظ الكل (${newChildrenCount} ${newChildrenCount === 1 ? "طفل" : "أطفال"}${hasReordered ? " + ترتيب" : ""})`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    direction: "rtl",
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
    borderBottomColor: "#E5E5EA",
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
    color: "#8E8E93",
    marginTop: 2,
  },
  headerStats: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  statsText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  statsLabel: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 2,
  },
  cardsSection: {
    backgroundColor: "#FFF",
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    alignItems: "flex-end", // RTL alignment
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 12,
    textAlign: "right",
  },
  cardsScroll: {
    height: CARD_HEIGHT + 20,
  },
  cardsScrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row", // Normal direction for proper RTL ordering
  },
  emptyCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D1D6",
  },
  emptyCardText: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 8,
  },
  cardWrapper: {
    marginHorizontal: CARD_SPACING / 2,
  },
  childCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  childCardActive: {
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#F0F9FF",
  },
  deleteButton: {
    position: "absolute",
    top: 4,
    left: 4, // RTL: delete button on left
    zIndex: 10,
  },
  orderBadge: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  orderBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  childName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
    marginTop: 28,
    marginBottom: 4,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  genderLabel: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  genderText: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  genderMale: {
    backgroundColor: "#E3F2FD",
    color: "#1976D2",
  },
  genderFemale: {
    backgroundColor: "#FCE4EC",
    color: "#C2185B",
  },
  editIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  inputForm: {
    backgroundColor: "#FFF",
    marginTop: 8,
    padding: 16,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    textAlign: "right",
    flex: 1,
  },
  cancelEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelEditText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#000",
    textAlign: "right",
    marginBottom: 12,
  },
  genderSection: {
    flexDirection: "row",
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: "#000",
  },
  genderButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  genderButtonTextActive: {
    color: "#FFF",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 14,
  },
  addButtonDisabled: {
    backgroundColor: "#C7C7CC",
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFF",
  },
  motherSelectorContainer: {
    marginTop: 16,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  saveButton: {
    backgroundColor: "#000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#C7C7CC",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
  },
});

export default QuickAddOverlay;
