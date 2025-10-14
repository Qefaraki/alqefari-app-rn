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
import FatherSelectorSimple from "./fields/FatherSelectorSimple";
import ChildListCard from "./ChildListCard";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;

const QuickAddOverlay = ({ visible, parentNode, siblings = [], onClose }) => {
  const [currentName, setCurrentName] = useState("");
  const [currentGender, setCurrentGender] = useState("male");
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [selectedFatherId, setSelectedFatherId] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [mothers, setMothers] = useState([]);

  const applyOrdering = useCallback((children) => {
    let orderChanged = false;
    let needsUpdate = false;

    children.forEach((child, index) => {
      const originalOrder =
        child.original_sibling_order !== undefined && child.original_sibling_order !== null
          ? child.original_sibling_order
          : index;

      if (child.isExisting && originalOrder !== index) {
        orderChanged = true;
      }

      if (child.sibling_order !== index) {
        needsUpdate = true;
      }
    });

    setHasReordered(orderChanged);

    if (!needsUpdate) {
      return children;
    }

    return children.map((child, index) => ({
      ...child,
      sibling_order: index,
    }));
  }, []);
  const inputRef = useRef(null);
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
          original_sibling_order: index,
          original_snapshot: {
            name: s.name,
            gender: s.gender,
            mother_id: s?.mother_id || s?.parent2 || null,
          },
        }));

      setAllChildren(applyOrdering(sortedSiblings));
      setCurrentName("");
      setCurrentGender("male");
      setSelectedMotherId(null);

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible, parentNode, siblings, applyOrdering]);

  // Auto-add child on Return key
  const handleAutoAdd = () => {
    const trimmedName = currentName.trim();

    if (trimmedName.length === 0) {
      Keyboard.dismiss();
      return;
    }

    // Validate name length
    if (trimmedName.length < 2) {
      Alert.alert("خطأ", "الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (trimmedName.length > 100) {
      Alert.alert("خطأ", "الاسم طويل جداً (100 حرف كحد أقصى)");
      return;
    }

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
      sibling_order: allChildren.length,
      original_sibling_order: null,
      original_snapshot: {
        name: trimmedName,
        gender: currentGender,
        mother_id: selectedMotherId,
      },
    };

    setAllChildren((prev) => applyOrdering([...prev, newChild]));
    setCurrentName("");
    // Keep gender and mother selection for next child
    inputRef.current?.focus();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Handle updating a child
  const handleUpdateChild = (childId, updates) => {
    setAllChildren((prev) =>
      prev.map((child) => {
        if (child.id !== childId) {
          return child;
        }

        const updatedChild = {
          ...child,
          ...updates,
        };

        if (updates.hasOwnProperty("mother_id")) {
          if (updates.mother_id) {
            const match = mothers.find((m) => m.id === updates.mother_id || m.wife_id === updates.mother_id);
            updatedChild.mother_name = match?.name || child.mother_name || null;
          } else {
            updatedChild.mother_name = null;
          }
        }

        if (child.isExisting) {
          const original = child.original_snapshot || {};
          const originalMother = original.mother_id ?? null;
          const currentMother = updatedChild.mother_id ?? null;

          const hasDiff =
            original.name !== updatedChild.name ||
            original.gender !== updatedChild.gender ||
            originalMother !== currentMother;

          updatedChild.isEdited = hasDiff;
        }

        return updatedChild;
      })
    );
  };

  // Handle deleting a child
  const handleDeleteChild = (child) => {
    setAllChildren((prev) => applyOrdering(prev.filter((c) => c.id !== child.id)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Handle moving child (unified function with functional setState for performance)
  const handleMove = useCallback((childId, direction) => {
    let moved = false;

    setAllChildren((prev) => {
      const currentIndex = prev.findIndex((c) => c.id === childId);

      // Calculate target index based on direction
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Boundary checks
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev; // No change, prevents unnecessary re-render
      }

      // Perform the swap
      const newChildren = [...prev];
      const [movedChild] = newChildren.splice(currentIndex, 1);
      newChildren.splice(targetIndex, 0, movedChild);

      moved = true;
      return applyOrdering(newChildren);
    });

    if (moved) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [applyOrdering]);

  // Convenience wrappers for backward compatibility
  const handleMoveUp = useCallback((childId) => handleMove(childId, 'up'), [handleMove]);
  const handleMoveDown = useCallback((childId) => handleMove(childId, 'down'), [handleMove]);

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
      // Validate before creating promises
      for (const child of newChildren) {
        if (!child.name || child.name.trim().length < 2) {
          Alert.alert("خطأ", `اسم الطفل غير صالح: "${child.name}"`);
          setLoading(false);
          return;
        }
      }

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

        // Validate father selection for female parents
        if (parentNode.gender === "female" && !selectedFatherId) {
          Alert.alert(
            "خطأ",
            "يجب اختيار والد الطفل. يرجى تحديد الزوج من القائمة."
          );
          setLoading(false);
          return;
        }

        const profileData = {
          name: child.name,
          gender: child.gender,
          sibling_order: child.sibling_order,
          generation: (parentNode.generation || 0) + 1,
          status: "alive",
        };

        // Set parent IDs based on parent gender
        if (parentNode.gender === "male") {
          // For male parents: They are the father
          profileData.father_id = parentNode.id;
          profileData.mother_id = child.mother_id || selectedMotherId || null;
        } else {
          // For female parents: They are the mother
          profileData.father_id = selectedFatherId; // Required for women
          profileData.mother_id = parentNode.id;
        }

        promises.push(
          profilesService.createProfile(profileData).then(({ data, error }) => {
            if (error) throw error;
            return { childId: child.id, newId: data?.id };
          })
        );
      }

      // 2. Update edited children (with sibling_order if reordered)
      for (const child of editedChildren) {
        const updates = {
          name: child.name,
          gender: child.gender,
          sibling_order: child.sibling_order, // Always include sibling_order
        };

        if (child.mother_id !== undefined) {
          updates.mother_id = child.mother_id;
        }

        promises.push(profilesService.updateProfile(child.id, child.version || 1, updates));
      }

      // 3. Update sibling_order for children that were ONLY reordered (not edited)
      if (hasReordered) {
        const existingChildren = allChildren.filter((c) => c.isExisting);
        for (const child of existingChildren) {
          // Skip if already updated as edited child (avoid duplicate update)
          if (editedChildren.find(ec => ec.id === child.id)) {
            continue;
          }
          promises.push(
            profilesService.updateProfile(child.id, child.version || 1, {
              sibling_order: child.sibling_order,
            })
          );
        }
      }

      const results = await Promise.allSettled(promises);

      // Log detailed errors for debugging
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Child ${index + 1} creation failed:`, result.reason);
        }
      });

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected");

      await refreshProfile(parentNode.id);

      if (failed.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose?.();
      } else if (successful > 0) {
        Alert.alert(
          "تحديث جزئي",
          `تم حفظ ${successful} من ${results.length} بنجاح. فشل ${failed.length} عملية.`,
          [{ text: "حسناً", onPress: onClose }]
        );
      } else {
        // Extract first error for user display
        const firstError = failed[0]?.reason?.message || failed[0]?.reason || "خطأ غير معروف";

        console.error("All failed operations:", failed.map(f => f.reason));

        Alert.alert(
          "خطأ",
          `فشل حفظ ${failed.length} من ${results.length} طفل.\n\nالخطأ: ${firstError}`,
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

  // Memoized render function for FlatList
  const renderChild = useCallback(
    ({ item, index }) => (
      <ChildListCard
        child={item}
        index={index}
        totalChildren={allChildren.length}
        onUpdate={handleUpdateChild}
        onDelete={handleDeleteChild}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        mothers={mothers}
      />
    ),
    [allChildren.length, mothers, handleUpdateChild, handleDeleteChild, handleMoveUp, handleMoveDown]
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
              <View style={styles.navBar}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.navAction}
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق النافذة"
                >
                  <Text style={styles.navActionText}>إلغاء</Text>
                </TouchableOpacity>

                <View style={styles.navTitleBlock}>
                  <Text style={styles.navTitle}>إضافة أطفال</Text>
                  <Text style={styles.navSubtitle} numberOfLines={1}>
                    {parentNode?.name}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!hasChanges || loading}
                  style={[styles.navActionSave, (!hasChanges || loading) && styles.navActionDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="حفظ التغييرات"
                  accessibilityState={{ disabled: !hasChanges || loading }}
                >
                  <Text
                    style={[styles.navSaveText, (!hasChanges || loading) && styles.navSaveTextDisabled]}
                  >
                    {loading ? "جاري..." : "تم"}
                  </Text>
                  {hasChanges && totalChanges > 0 && !loading && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{totalChanges}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {hasChanges && (
                <View style={styles.changesSummary}>
                  <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.changesSummaryText}>{getSaveButtonText()}</Text>
                </View>
              )}

              <View style={styles.quickAddSection}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>اسم الطفل</Text>
                  <TextInput
                    ref={inputRef}
                    style={styles.inputField}
                    placeholder="اكتب الاسم الكامل"
                    placeholderTextColor={COLORS.textMuted + "AA"}
                    value={currentName}
                    onChangeText={setCurrentName}
                    onSubmitEditing={handleAutoAdd}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    allowFontScaling
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>الجنس</Text>
                  <View style={styles.segmentedRow}>
                    {[
                      { value: "male", label: "ذكر" },
                      { value: "female", label: "أنثى" },
                    ].map((option) => {
                      const active = currentGender === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.segmentButton, active && styles.segmentButtonActive]}
                          onPress={() => {
                            setCurrentGender(option.value);
                            Haptics.selectionAsync();
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {parentNode?.gender === "male" && (
                  <View style={styles.selectorWrapper}>
                    <MotherSelectorSimple
                      fatherId={parentNode.id}
                      value={selectedMotherId}
                      onChange={(id, mothersData) => {
                        setSelectedMotherId(id);
                        if (mothersData) {
                          const formattedMothers = mothersData.map((w) => ({
                            id: w.wife_id,
                            name: w.wife_name,
                            display_name: w.display_name,
                          }));
                          setMothers(formattedMothers);
                        } else if (id) {
                          Alert.alert("تنبيه", "تعذر تحميل بيانات الأم");
                        }
                      }}
                      label="الأم (اختياري)"
                    />
                  </View>
                )}

                {parentNode?.gender === "female" && (
                  <View style={styles.selectorWrapper}>
                    <FatherSelectorSimple
                      motherId={parentNode.id}
                      value={selectedFatherId}
                      onChange={(id, husbandsData) => {
                        setSelectedFatherId(id);
                        if (!husbandsData && id) {
                          Alert.alert("تنبيه", "تعذر تحميل بيانات الزوج");
                        }
                      }}
                      label="الأب (مطلوب)"
                      required
                    />
                  </View>
                )}

              </View>

              <View style={styles.childrenListSection}>
                {allChildren.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>👶</Text>
                    <Text style={styles.emptyStateTitle}>ابدأ بإضافة الأطفال</Text>
                    <Text style={styles.emptyStateSubtitle}>
                      اكتب الاسم في الحقل أعلاه واضغط إدخال للإضافة
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={allChildren}
                    keyExtractor={(item) => item.id}
                    renderItem={renderChild}
                    contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, tokens.spacing.xl) }]}
                    showsVerticalScrollIndicator={false}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews
                    initialNumToRender={10}
                  />
                )}
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
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.container + "33",
    backgroundColor: COLORS.background,
  },
  navAction: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  navActionText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "500",
    color: COLORS.text,
  },
  navTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: tokens.spacing.sm,
  },
  navTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: "700",
    color: COLORS.text,
  },
  navSubtitle: {
    fontSize: tokens.typography.footnote.fontSize,
    color: COLORS.textMuted,
  },
  navActionSave: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    backgroundColor: COLORS.primary,
  },
  navActionDisabled: {
    backgroundColor: COLORS.container + "33",
  },
  navSaveText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    color: COLORS.background,
  },
  navSaveTextDisabled: {
    color: COLORS.textMuted,
  },
  navBadge: {
    minWidth: 24,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: COLORS.background + "30",
    alignItems: "center",
  },
  navBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "700",
    color: COLORS.background,
  },
  changesSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: COLORS.container + "18",
  },
  changesSummaryText: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.text,
    fontWeight: "500",
  },
  quickAddSection: {
    marginTop: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: COLORS.container + "10",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "2A",
    gap: tokens.spacing.sm,
  },
  fieldGroup: {
    gap: tokens.spacing.xxs,
  },
  fieldLabel: {
    fontSize: tokens.typography.subheadline.fontSize,
    fontWeight: "500",
    color: COLORS.text,
  },
  inputField: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
    textAlign: "auto",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  segmentButton: {
    flex: 1,
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentText: {
    fontSize: tokens.typography.subheadline.fontSize,
    fontWeight: "600",
    color: COLORS.text,
  },
  segmentTextActive: {
    color: COLORS.background,
  },
  selectorWrapper: {
    gap: tokens.spacing.xs,
  },
  childrenListSection: {
    flex: 1,
    marginTop: tokens.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.xxl,
  },
  emptyStateIcon: {
    fontSize: 56,
    marginBottom: tokens.spacing.md,
    opacity: 0.3,
  },
  emptyStateTitle: {
    fontSize: tokens.typography.title3.fontSize,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: tokens.spacing.xs,
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  listContent: {
    paddingTop: tokens.spacing.xs,
  },
});

export default QuickAddOverlay;
