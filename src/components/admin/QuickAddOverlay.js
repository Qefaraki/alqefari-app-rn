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
  
  I18nManager,
  Animated,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import MotherSelectorSimple from "./fields/MotherSelectorSimple";

// Enable RTL
I18nManager.forceRTL(true);

// Design System Colors from CLAUDE.md
const COLORS = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  textLight: "#24212199", // Sadu Night 60%
  textMedium: "#242121CC", // Sadu Night 80%
};

// Card dimensions - thinner
const CARD_WIDTH = 75;
const CARD_HEIGHT = 85;
const CARD_SPACING = 8;

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
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onEdit(child);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <ReAnimated.View style={[styles.cardWrapper, animatedStyle]}>
        <Animated.View
          style={[{ transform: [{ scale: scaleAnim }] }, { opacity: fadeAnim }]}
        >
          <TouchableOpacity
            style={[
              styles.childCard,
              isActive && styles.childCardActive,
              child.isNew && styles.newCard,
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
          >
            {/* Delete button - top left in RTL (appears right) */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(child)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color="rgba(36, 33, 33, 0.3)"
              />
            </TouchableOpacity>

            {/* Order badge - RTL aware */}
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>{index + 1}</Text>
            </View>

            <Text style={styles.childName} numberOfLines={1}>
              {child.name}
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
    mother_id: null, // Track mother for editing
  });
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [editingChildId, setEditingChildId] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const { refreshProfile } = useStore();

  // Initialize with existing siblings
  useEffect(() => {
    if (visible && parentNode) {
      // First sort by sibling_order, then fix any duplicates
      const sortedSiblings = [...siblings]
        .sort((a, b) => {
          const orderA = a.sibling_order ?? 999;
          const orderB = b.sibling_order ?? 999;
          if (orderA === orderB) {
            // If same order, sort by ID to have consistent ordering
            return (a.id || "").localeCompare(b.id || "");
          }
          return orderA - orderB;
        })
        .map((s, index) => ({
          ...s,
          isNew: false,
          isExisting: true,
          mother_id: s.mother_id || s.parent2, // Get mother ID
          sibling_order: index, // Fix duplicate orders by using index
        }));

      // For RTL: Reverse array so oldest (index 0) appears on the right
      const rtlSiblings = I18nManager.isRTL
        ? [...sortedSiblings].reverse()
        : sortedSiblings;
      setAllChildren(rtlSiblings);
      setCurrentChild({ name: "", gender: "male", id: null, mother_id: null });
      setEditingChildId(null);
      setSelectedMotherId(null);
      setHasReordered(false);
      setHasEdits(false);

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible, parentNode, siblings]);

  // Handle adding or updating a child
  const handleAddOrUpdateChild = () => {
    const trimmedName = currentChild.name.trim();

    // Don't require name if just dismissing keyboard
    if (!trimmedName && !editingChildId) {
      Keyboard.dismiss();
      return;
    }

    if (editingChildId) {
      // Update existing child in list
      setAllChildren((prev) =>
        prev.map((child) =>
          child.id === editingChildId
            ? {
                ...child,
                name: trimmedName || child.name,
                gender: currentChild.gender,
                mother_id: selectedMotherId,
                isEdited: true,
              }
            : child,
        ),
      );
      setHasEdits(true);
      setEditingChildId(null);
    } else if (trimmedName) {
      // Add new child
      // Calculate the next sibling_order (should be highest + 1)
      const maxOrder = allChildren.reduce(
        (max, child) => Math.max(max, child.sibling_order ?? 0),
        -1,
      );

      const newChild = {
        id: `new-${Date.now()}`,
        name: trimmedName,
        gender: currentChild.gender,
        mother_id: selectedMotherId,
        isNew: true,
        isExisting: false,
        sibling_order: maxOrder + 1, // Will be youngest (highest sibling_order)
      };

      // In RTL: Add to beginning of array (leftmost position for youngest)
      if (I18nManager.isRTL) {
        setAllChildren((prev) => [newChild, ...prev]);
        // Scroll to start for RTL
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: 0, animated: true });
        }, 100);
      } else {
        setAllChildren((prev) => [...prev, newChild]);
        // Scroll to end for LTR
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }

    // Reset form
    setCurrentChild({ name: "", gender: "male", id: null, mother_id: null });
    setSelectedMotherId(null);
    inputRef.current?.focus();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle editing a child
  const handleEditChild = (child) => {
    setCurrentChild({
      name: child.name,
      gender: child.gender,
      id: child.id,
      mother_id: child.mother_id,
    });
    setEditingChildId(child.id);
    setSelectedMotherId(child.mother_id || null);
    inputRef.current?.focus();
  };

  // Handle deleting a child
  const handleDeleteChild = (child) => {
    Alert.alert(
      "حذف الطفل",
      `هل تريد حذف ${child.name}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            setAllChildren((prev) =>
              prev
                .filter((c) => c.id !== child.id)
                .map((c, i) => ({
                  ...c,
                  sibling_order: i,
                })),
            );
            setHasReordered(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Handle reordering children
  const handleReorder = (childId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const newChildren = [...allChildren];
    const [movedChild] = newChildren.splice(fromIndex, 1);
    newChildren.splice(toIndex, 0, movedChild);

    // For RTL: Since display is reversed, we need to reverse the sibling_order
    const updatedChildren = newChildren.map((child, index) => {
      // In RTL, the rightmost card (index 0) should have lowest sibling_order
      const actualOrder = I18nManager.isRTL
        ? newChildren.length - 1 - index
        : index;
      return {
        ...child,
        sibling_order: actualOrder,
        isEdited: child.isExisting ? true : child.isEdited, // Mark as edited if it's an existing child
      };
    });

    setAllChildren(updatedChildren);
    setHasReordered(true);
    setHasEdits(true);
  };

  // Save all changes
  const handleSave = async () => {
    if (!parentNode) return;

    const newChildren = allChildren.filter((c) => c.isNew);
    const editedChildren = allChildren.filter((c) => c.isEdited);

    if (
      newChildren.length === 0 &&
      !hasReordered &&
      editedChildren.length === 0
    ) {
      Alert.alert("تنبيه", "لا توجد تغييرات للحفظ");
      return;
    }

    setLoading(true);

    try {
      const promises = [];

      // 1. Create new children
      for (const child of newChildren) {
        const profileData = {
          name: child.name,
          gender: child.gender,
          father_id: parentNode.gender === "male" ? parentNode.id : null,
          mother_id:
            parentNode.gender === "female" ? parentNode.id : child.mother_id,
          sibling_order: child.sibling_order,
          status: "alive",
        };

        // If parent is male and mother is selected, use it
        if (parentNode.gender === "male" && child.mother_id) {
          profileData.mother_id = child.mother_id;
        }

        promises.push(
          profilesService.createProfile(profileData).then(({ data, error }) => {
            if (error) throw error;
            return { childId: child.id, newId: data?.id };
          }),
        );
      }

      // 2. Update edited children
      for (const child of editedChildren) {
        const updates = {
          name: child.name, // profilesService expects 'name' not 'arabic_name'
          gender: child.gender,
          sibling_order: child.sibling_order,
        };

        if (child.mother_id !== undefined) {
          updates.mother_id = child.mother_id;
        }

        promises.push(profilesService.updateProfile(child.id, updates));
      }

      // 3. Update sibling orders for ALL existing children if reordered
      if (hasReordered) {
        const existingChildren = allChildren.filter((c) => c.isExisting);
        for (const child of existingChildren) {
          // Skip if already handled in edited children
          if (!editedChildren.find((ec) => ec.id === child.id)) {
            promises.push(
              profilesService.updateProfile(child.id, {
                sibling_order: child.sibling_order,
              }),
            );
          }
        }
      }

      await Promise.all(promises);
      await refreshProfile(parentNode.id);

      Alert.alert("نجاح", "تم حفظ التغييرات بنجاح", [
        { text: "حسناً", onPress: onClose },
      ]);
    } catch (error) {
      console.error("Error saving children:", error);
      Alert.alert("خطأ", "فشل حفظ التغييرات. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const newChildrenCount = allChildren.filter((c) => c.isNew).length;
  const editedChildrenCount = allChildren.filter((c) => c.isEdited).length;
  const totalChildrenCount = allChildren.length;
  const hasChanges =
    newChildrenCount > 0 || hasReordered || hasEdits || editedChildrenCount > 0;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.container}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.flex}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>إضافة أطفال</Text>
                  <Text style={styles.headerSubtitle}>
                    {parentNode?.arabic_name}
                  </Text>
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
                        color={COLORS.textLight}
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
                        setCurrentChild({
                          name: "",
                          gender: "male",
                          id: null,
                          mother_id: null,
                        });
                        setEditingChildId(null);
                        setSelectedMotherId(null);
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
                    placeholderTextColor={COLORS.textLight}
                    value={currentChild.name}
                    onChangeText={(text) =>
                      setCurrentChild((prev) => ({ ...prev, name: text }))
                    }
                    onSubmitEditing={handleAddOrUpdateChild}
                    returnKeyType="done"
                    textAlign="right"
                    blurOnSubmit={false}
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
                        setCurrentChild((prev) => ({
                          ...prev,
                          gender: "female",
                        }))
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

                {/* Add/Update Button - just adds to list, doesn't save to database */}
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
                    {editingChildId ? "تحديث" : "إضافة طفل"}
                  </Text>
                </TouchableOpacity>

                {/* Mother Selector - Available for both new and edit */}
                {parentNode?.gender === "male" && (
                  <View style={styles.motherSelectorContainer}>
                    <MotherSelectorSimple
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
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>إلغاء</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    !hasChanges && styles.saveButtonDisabled,
                    loading && styles.saveButtonLoading,
                  ]}
                  onPress={handleSave}
                  disabled={!hasChanges || loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? "جاري الحفظ..." : "حفظ"}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "40",
  },
  headerButton: {
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
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  headerStats: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  statsText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  statsLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  cardsSection: {
    backgroundColor: "#FFF",
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "flex-start",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textMedium,
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  cardsScroll: {
    height: CARD_HEIGHT + 20,
  },
  cardsScrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
  },
  emptyCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: COLORS.container + "20",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.container + "40",
  },
  emptyCardText: {
    fontSize: 13,
    color: COLORS.textLight,
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
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  childCardActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "08",
  },
  newCard: {
    borderColor: COLORS.secondary,
    borderWidth: 1.5,
  },

  deleteButton: {
    position: "absolute",
    top: 4,
    left: 4,
    zIndex: 10,
  },
  orderBadge: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  childName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 6,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  genderLabel: {
    position: "absolute",
    bottom: 8,
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
    backgroundColor: COLORS.primary + "10",
    color: COLORS.primary,
  },
  genderFemale: {
    backgroundColor: COLORS.secondary + "10",
    color: COLORS.secondary,
  },
  editIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  inputForm: {
    flex: 1,
    backgroundColor: "#FFF",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formHeader: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  cancelEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelEditText: {
    color: COLORS.primary,
    fontSize: 15,
  },
  inputContainer: {
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: COLORS.container + "20",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    textAlign: I18nManager.isRTL ? "right" : "left",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  genderSection: {
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.container + "20",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  genderButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  genderButtonTextActive: {
    color: "#FFF",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  addButtonDisabled: {
    backgroundColor: COLORS.container + "40",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  motherSelectorContainer: {
    width: "100%",
    marginTop: 8,
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "40",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.container + "20",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.container + "40",
  },
  saveButtonLoading: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
});

export default QuickAddOverlay;
