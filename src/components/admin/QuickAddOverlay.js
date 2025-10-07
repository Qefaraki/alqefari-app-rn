import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../../services/profiles";
import useStore from "../../hooks/useStore";
import MotherSelectorSimple from "./fields/MotherSelectorSimple";
import ChildListCard from "./ChildListCard";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;
const SEPARATOR_HEIGHT = 2; // 2px gap between cards

const QuickAddOverlay = ({ visible, parentNode, siblings = [], onClose }) => {
  const [currentName, setCurrentName] = useState("");
  const [currentGender, setCurrentGender] = useState("male");
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [mothers, setMothers] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [averageCardHeight, setAverageCardHeight] = useState(80);
  const inputRef = useRef(null);
  const cardHeights = useRef(new Map()).current;
  const { refreshProfile } = useStore();
  const insets = useSafeAreaInsets();

  // Initialize with existing siblings
  useEffect(() => {
    if (visible && parentNode) {
      // Sort by sibling_order - filter out any undefined/null entries first
      const validSiblings = (siblings || []).filter(s => s && s.id);

      const sortedSiblings = [...validSiblings]
        .sort((a, b) => {
          const orderA = a.sibling_order ?? 999;
          const orderB = b.sibling_order ?? 999;
          if (orderA === orderB) {
            return (a.id || "").localeCompare(b.id || "");
          }
          return orderA - orderB;
        })
        .map((s, index) => ({
          ...s,
          isNew: false,
          isExisting: true,
          isEdited: false,
          mother_id: s?.mother_id || s?.parent2 || null,
          mother_name: s?.mother_name || null,
          sibling_order: index,
        }));

      setAllChildren(sortedSiblings);
      setCurrentName("");
      setCurrentGender("male");
      setSelectedMotherId(null);
      setHasReordered(false);

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible, parentNode, siblings]);

  // Auto-add child on Return key
  const handleAutoAdd = () => {
    const trimmedName = currentName.trim();

    if (trimmedName.length === 0) {
      Keyboard.dismiss();
      return;
    }

    // Validate name length
    if (trimmedName.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال اسم صحيح (حرفين على الأقل)");
      return;
    }
    if (trimmedName.length > 100) {
      Alert.alert("خطأ", "الاسم طويل جداً (100 حرف كحد أقصى)");
      return;
    }

    // Calculate the next sibling_order
    const maxOrder = allChildren.reduce(
      (max, child) => Math.max(max, child.sibling_order ?? 0),
      -1
    );

    const newChild = {
      id: `new-${Date.now()}`,
      name: trimmedName,
      gender: currentGender,
      mother_id: selectedMotherId,
      mother_name: selectedMotherId
        ? mothers.find((m) => m.id === selectedMotherId)?.name
        : null,
      isNew: true,
      isExisting: false,
      isEdited: false,
      sibling_order: maxOrder + 1,
    };

    setAllChildren((prev) => [...prev, newChild]);
    setCurrentName("");
    // Keep gender and mother selection for next child
    inputRef.current?.focus();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Handle updating a child
  const handleUpdateChild = (childId, updates) => {
    setAllChildren((prev) =>
      prev.map((child) =>
        child.id === childId
          ? {
              ...child,
              ...updates,
              isEdited: child.isExisting ? true : child.isEdited,
              mother_name:
                updates.mother_id && mothers
                  ? mothers.find((m) => m.id === updates.mother_id)?.name
                  : child.mother_name,
            }
          : child
      )
    );
  };

  // Handle deleting a child
  const handleDeleteChild = (child) => {
    setAllChildren((prev) =>
      prev
        .filter((c) => c.id !== child.id)
        .map((c, i) => ({
          ...c,
          sibling_order: i,
          isEdited: c.isExisting ? true : c.isEdited,
        }))
    );
    setHasReordered(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Handle reordering children
  const handleReorder = (childId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const newChildren = [...allChildren];
    const [movedChild] = newChildren.splice(fromIndex, 1);
    newChildren.splice(toIndex, 0, movedChild);

    const updatedChildren = newChildren.map((child, index) => ({
      ...child,
      sibling_order: index,
      isEdited: child.isExisting ? true : child.isEdited,
    }));

    setAllChildren(updatedChildren);
    setHasReordered(true);
  };

  // Save all changes
  const handleSave = async () => {
    if (!parentNode) return;

    const newChildren = allChildren.filter((c) => c.isNew);
    const editedChildren = allChildren.filter((c) => c.isEdited);

    if (newChildren.length === 0 && !hasReordered && editedChildren.length === 0) {
      Alert.alert("تنبيه", "لا توجد تغييرات للحفظ");
      return;
    }

    setLoading(true);

    try {
      const promises = [];

      // 1. Create new children
      for (const child of newChildren) {
        if (
          parentNode.generation === null ||
          parentNode.generation === undefined
        ) {
          Alert.alert(
            "خطأ",
            "لا يمكن إضافة أطفال لملف غير مكتمل. يرجى تعيين جيل الوالد أولاً."
          );
          setLoading(false);
          return;
        }

        const profileData = {
          name: child.name,
          gender: child.gender,
          father_id: parentNode.gender === "male" ? parentNode.id : null,
          mother_id:
            parentNode.gender === "female" ? parentNode.id : child.mother_id,
          sibling_order: child.sibling_order,
          generation: (parentNode.generation || 0) + 1,
          status: "alive",
        };

        if (parentNode.gender === "male" && child.mother_id) {
          profileData.mother_id = child.mother_id;
        }

        promises.push(
          profilesService.createProfile(profileData).then(({ data, error }) => {
            if (error) throw error;
            return { childId: child.id, newId: data?.id };
          })
        );
      }

      // 2. Update edited children
      for (const child of editedChildren) {
        const updates = {
          name: child.name,
          gender: child.gender,
          sibling_order: child.sibling_order,
        };

        if (child.mother_id !== undefined) {
          updates.mother_id = child.mother_id;
        }

        promises.push(profilesService.updateProfile(child.id, 1, updates));
      }

      // 3. Update sibling orders for ALL existing children if reordered
      if (hasReordered) {
        const existingChildren = allChildren.filter((c) => c.isExisting);
        for (const child of existingChildren) {
          if (!editedChildren.find((ec) => ec.id === child.id)) {
            promises.push(
              profilesService.updateProfile(child.id, 1, {
                sibling_order: child.sibling_order,
              })
            );
          }
        }
      }

      const results = await Promise.allSettled(promises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      await refreshProfile(parentNode.id);

      if (failed === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("نجاح", "تم حفظ التغييرات بنجاح", [
          { text: "حسناً", onPress: onClose },
        ]);
      } else if (successful > 0) {
        Alert.alert(
          "تحديث جزئي",
          `تم حفظ ${successful} من ${results.length} بنجاح. فشل ${failed} عملية.`,
          [{ text: "حسناً", onPress: onClose }]
        );
      } else {
        Alert.alert(
          "خطأ",
          "فشل حفظ جميع التعديلات. يرجى المحاولة مرة أخرى.",
          [{ text: "حسناً" }]
        );
      }
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
  const totalChanges = newChildrenCount + editedChildrenCount;
  const hasChanges = totalChanges > 0 || hasReordered;

  const getSaveButtonText = () => {
    if (loading) return "جاري الحفظ...";
    if (newChildrenCount > 0 && editedChildrenCount === 0) {
      return newChildrenCount === 1
        ? "حفظ طفل واحد"
        : `حفظ ${newChildrenCount} أطفال جدد`;
    }
    if (editedChildrenCount > 0 && newChildrenCount === 0) {
      return editedChildrenCount === 1
        ? "حفظ تعديل واحد"
        : `حفظ ${editedChildrenCount} تعديلات`;
    }
    if (totalChanges > 0) {
      return `حفظ ${totalChanges} تغيير`;
    }
    return "حفظ";
  };

  // Calculate average height when card heights change
  const updateAverageHeight = useCallback(() => {
    const heights = Array.from(cardHeights.values());
    if (heights.length > 0) {
      const avg = heights.reduce((sum, h) => sum + h, 0) / heights.length;
      setAverageCardHeight(Math.round(avg));
    }
  }, [cardHeights]);

  // Memoized render function for FlatList performance
  const renderChild = useCallback(
    ({ item, index }) => (
      <ChildListCard
        child={item}
        index={index}
        totalChildren={allChildren.length}
        onUpdate={handleUpdateChild}
        onDelete={handleDeleteChild}
        onReorder={handleReorder}
        mothers={mothers}
        cardHeight={averageCardHeight}
        onHeightMeasured={(height) => {
          cardHeights.set(item.id, height);
          updateAverageHeight();
        }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      />
    ),
    [
      allChildren.length,
      mothers,
      averageCardHeight,
      cardHeights,
      updateAverageHeight,
      handleUpdateChild,
      handleDeleteChild,
      handleReorder,
    ]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.flex}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="chevron-back" size={28} color={COLORS.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>إضافة أطفال</Text>
                  <Text style={styles.headerSubtitle}>
                    {parentNode?.arabic_name || parentNode?.name}
                  </Text>
                </View>
                <View style={styles.headerStats}>
                  <Text style={styles.statsText}>{allChildren.length}</Text>
                  <Text style={styles.statsLabel}>طفل</Text>
                </View>
              </View>

              {/* Quick Add Input (Sticky) */}
              <View style={styles.quickAddContainer}>
                <View style={styles.nameInputContainer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.nameInput}
                    placeholder="اسم الطفل الجديد..."
                    placeholderTextColor={COLORS.textMuted}
                    value={currentName}
                    onChangeText={setCurrentName}
                    onSubmitEditing={handleAutoAdd}
                    returnKeyType="done"
                    textAlign="right"
                    blurOnSubmit={false}
                  />

                  {/* Inline Gender Toggles */}
                  <View style={styles.genderToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.genderToggle,
                        currentGender === "male" && styles.genderToggleActive,
                      ]}
                      onPress={() => {
                        setCurrentGender("male");
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.genderToggleText,
                          currentGender === "male" &&
                            styles.genderToggleTextActive,
                        ]}
                      >
                        ذكر
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.genderToggle,
                        currentGender === "female" &&
                          styles.genderToggleActive,
                      ]}
                      onPress={() => {
                        setCurrentGender("female");
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.genderToggleText,
                          currentGender === "female" &&
                            styles.genderToggleTextActive,
                        ]}
                      >
                        أنثى
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Mother Selector (for male parents) */}
                {parentNode?.gender === "male" && (
                  <View style={styles.motherSelectorSection}>
                    <MotherSelectorSimple
                      fatherId={parentNode.id}
                      value={selectedMotherId}
                      onChange={(id, mothersData) => {
                        setSelectedMotherId(id);
                        if (mothersData) setMothers(mothersData);
                      }}
                      label="الأم (اختياري)"
                    />
                  </View>
                )}
              </View>

              {/* Children List */}
              <View style={styles.childrenListSection}>
                {allChildren.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>👶</Text>
                    <Text style={styles.emptyStateTitle}>
                      ابدأ بإضافة الأطفال
                    </Text>
                    <Text style={styles.emptyStateSubtitle}>
                      اكتب الاسم في الحقل أعلاه واضغط Enter للإضافة
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={allChildren}
                    keyExtractor={(item) => item.id}
                    renderItem={renderChild}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={Platform.OS === "android"}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={10}
                    scrollEnabled={!isDragging}
                    getItemLayout={(data, index) => ({
                      length: averageCardHeight,
                      offset: averageCardHeight * index,
                      index,
                    })}
                  />
                )}
              </View>

              {/* Bottom Actions */}
              <View
                style={[
                  styles.bottomActions,
                  { paddingBottom: Math.max(insets.bottom, tokens.spacing.sm) },
                ]}
              >
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                >
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
                    {getSaveButtonText()}
                  </Text>
                  {hasChanges && totalChanges > 0 && !loading && (
                    <View style={styles.changeCountBadge}>
                      <Text style={styles.changeCountText}>{totalChanges}</Text>
                    </View>
                  )}
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
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingVertical: tokens.spacing.sm, // 12px
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "20",
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
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: tokens.spacing.xxs, // 4px
  },
  headerStats: {
    alignItems: "center",
    paddingHorizontal: tokens.spacing.sm, // 12px
  },
  statsText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  statsLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: tokens.spacing.xxs, // 4px
  },
  quickAddContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingVertical: tokens.spacing.md, // 16px
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "20",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 100, // Ensure dropdown appears above cards below
  },
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.container + "15",
    borderRadius: tokens.radii.md, // 12px
    borderWidth: 1.5,
    borderColor: COLORS.container + "40",
    paddingHorizontal: tokens.spacing.sm, // 12px
    minHeight: 48,
  },
  nameInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "400",
    color: COLORS.text,
    textAlign: "left", // Native RTL mode flips this automatically
    paddingVertical: tokens.spacing.xs, // 8px
  },
  genderToggleContainer: {
    flexDirection: "row",
    gap: tokens.spacing.xxs, // 4px
    marginLeft: tokens.spacing.xs, // 8px
  },
  genderToggle: {
    minWidth: 44, // iOS minimum touch target
    height: 44, // iOS minimum touch target
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    paddingHorizontal: tokens.spacing.xs, // 8px for text
  },
  genderToggleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderToggleText: {
    fontSize: 15, // iOS subheadline
    fontWeight: "600",
    color: COLORS.text,
  },
  genderToggleTextActive: {
    color: COLORS.background,
  },
  motherSelectorSection: {
    marginTop: tokens.spacing.sm, // 12px
    width: "100%",
  },
  quickAddHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: tokens.spacing.xs, // 8px
    textAlign: "center",
  },
  childrenListSection: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.xxl, // 32px
    paddingVertical: tokens.spacing.xxl * 2, // 64px
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: tokens.spacing.md, // 16px
    opacity: 0.3,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: tokens.spacing.xs, // 8px
  },
  emptyStateSubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  listContent: {
    paddingVertical: 0, // No padding - cards stick together with separator
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingVertical: tokens.spacing.sm, // 12px
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "20",
    gap: tokens.spacing.sm, // 12px
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radii.md, // 12px
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.container + "20",
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
  },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: tokens.radii.md, // 12px
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.container + "40",
    opacity: 0.5,
  },
  saveButtonLoading: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.background,
  },
  changeCountBadge: {
    backgroundColor: COLORS.background + "30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  changeCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.background,
  },
});

export default QuickAddOverlay;
