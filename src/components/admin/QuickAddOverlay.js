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
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import profilesService from "../../services/profiles";
import useStore from "../../hooks/useStore";
import { useNetworkGuard } from "../../hooks/useNetworkGuard";
import { invalidateStructureCache } from "../../utils/cacheInvalidation";
import MotherSelectorSimple from "./fields/MotherSelectorSimple";
import FatherSelectorSimple from "./fields/FatherSelectorSimple";
import ChildListCard from "./ChildListCard";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const QuickAddOverlay = ({ visible, parentNode, siblings = [], onClose, onChildAdded }) => {
  const [currentName, setCurrentName] = useState("");
  const [currentGender, setCurrentGender] = useState("male");
  const [allChildren, setAllChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState(null);
  const [selectedFatherId, setSelectedFatherId] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);
  const [mothers, setMothers] = useState([]);
  const [deletedExistingChildren, setDeletedExistingChildren] = useState([]);
  const [inputError, setInputError] = useState(null);
  const [statusBanner, setStatusBanner] = useState(null);
  const statusAnim = useRef(new Animated.Value(0)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;
  const parentDisplayName = parentNode?.name?.trim?.() || "العائلة";

  // Network guard for offline protection
  const { checkBeforeAction } = useNetworkGuard();

  // Warning banner state for duplicate sibling_order detection
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState([]);

  // Detect duplicate sibling_order values in children array
  const detectDuplicates = useCallback((children) => {
    const orderCounts = {};

    children.forEach(child => {
      const order = child.sibling_order;
      orderCounts[order] = (orderCounts[order] || 0) + 1;
    });

    const duplicates = [];
    Object.entries(orderCounts).forEach(([order, count]) => {
      if (count > 1) {
        duplicates.push({
          order: parseInt(order),
          count,
        });
      }
    });

    return duplicates;
  }, []);

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
  const clearStatusBanner = useCallback(() => setStatusBanner(null), []);
  const handleAddPressIn = useCallback(() => {
    Animated.spring(addButtonScale, {
      toValue: 0.92,
      useNativeDriver: true,
      damping: 16,
      stiffness: 220,
    }).start();
  }, [addButtonScale]);

  const handleAddPressOut = useCallback(() => {
    Animated.spring(addButtonScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [addButtonScale]);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => setStatusBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  useEffect(() => {
    Animated.timing(statusAnim, {
      toValue: statusBanner ? 1 : 0,
      duration: statusBanner ? 220 : 180,
      easing: statusBanner ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [statusBanner, statusAnim]);

  // Initialize with existing siblings and detect/fix duplicates
  useEffect(() => {
    if (visible && parentNode) {
      // Load siblings with ORIGINAL database sibling_order values (preserve user intent)
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
        .map((s, index) => {
          // ⚠️ DEVELOPER SAFETY CHECK: Ensure version field is present
          // This prevents concurrent edit conflicts (optimistic locking)
          if (__DEV__ && s.version === undefined) {
            console.error('[QuickAdd] ⚠️ Child missing version field - concurrent edits will not be protected!', {
              id: s.id,
              name: s.name,
              loadedKeys: Object.keys(s).sort(),
              suggestion: 'Ensure the data-loading query includes the "version" field. Check ChildrenManager.js, DraggableChildrenList.js, or the RPC function being used.'
            });
          }

          // ✅ DEFENSIVE: Ensure version exists (handles both null and undefined)
          const safeChild = {
            ...s,
            version: s.version ?? 1  // Fallback if data loader fails
          };

          return {
            ...safeChild,
            isNew: false,
            isExisting: true,
            isEdited: false,
            mother_id: s?.mother_id || s?.parent2 || null,
            mother_name: s?.mother_name || null,
            sibling_order: s.sibling_order ?? index,  // ✅ PRESERVE database value
            original_sibling_order: s.sibling_order ?? index,
            original_snapshot: {
              name: s.name,
              gender: s.gender,
              mother_id: s?.mother_id || s?.parent2 || null,
            },
          };
        });

      // Detect duplicates in the loaded data
      const duplicates = detectDuplicates(sortedSiblings);

      if (duplicates.length > 0) {
        // Auto-fix by renumbering sequentially
        const fixed = applyOrdering(sortedSiblings);
        setAllChildren(fixed);
        setShowDuplicateWarning(true);
        setDuplicateInfo(duplicates);

        if (__DEV__) {
          console.warn('[QuickAdd] Duplicate sibling_order detected and auto-fixed:', duplicates);
        }
      } else {
        // No duplicates, use as-is
        setAllChildren(sortedSiblings);
        setShowDuplicateWarning(false);
        setDuplicateInfo([]);
      }

      setCurrentName("");
      setCurrentGender("male");
      setSelectedMotherId(null);
      setDeletedExistingChildren([]);
      setInputError(null);
      setStatusBanner(null);

      // Auto-focus after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible, parentNode, siblings, applyOrdering, detectDuplicates]);

  // Auto-add child on Return key
  const handleAutoAdd = () => {
    clearStatusBanner();
    if (loading) return;
    const trimmedName = currentName.trim();

    if (trimmedName.length === 0) {
      setInputError("أدخل الاسم لإضافة الطفل");
      inputRef.current?.focus();
      return;
    }

    // Validate name length
    if (trimmedName.length < 2) {
      setInputError("الاسم يجب أن يكون حرفين على الأقل");
      inputRef.current?.focus();
      return;
    }
    if (trimmedName.length > 100) {
      setInputError("الاسم يجب ألا يتجاوز 100 حرف");
      inputRef.current?.focus();
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

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAllChildren((prev) => applyOrdering([...prev, newChild]));
    setInputError(null);
    setCurrentName("");
    // Keep gender and mother selection for next child
    inputRef.current?.focus();
  };

  // Handle updating a child
  const handleUpdateChild = (childId, updates) => {
    clearStatusBanner();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
  const handleDeleteChild = async (child) => {
    clearStatusBanner();
    // New children (not yet in database) - just remove from state
    if (child.isNew) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAllChildren((prev) => applyOrdering(prev.filter((c) => c.id !== child.id)));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    // Existing children - check for descendants before allowing deletion
    try {
      // Use existing RPC for permission-aware descendant checking
      const { data: impact, error } = await profilesService.previewDeleteImpact(child.id);

      if (error) {
        console.error('Error checking descendants:', error);
        Alert.alert('خطأ', 'حدث خطأ في التحقق. حاول مرة أخرى');
        return;
      }

      const descendantCount = impact?.total_descendants || 0;

      if (descendantCount > 0) {
        Alert.alert(
          'لا يمكن الحذف',
          `${child.name} ${child.gender === 'female' ? 'لديها' : 'لديه'} ${descendantCount} ${
            descendantCount === 1 ? 'طفل' : 'أطفال'
          }. احذفهم أولاً أو استخدم الحذف المتسلسل.`
        );
        return;
      }

      // Safe to delete - track for database deletion on save (no confirmation needed)
      setDeletedExistingChildren((prev) => [...prev, child]);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAllChildren((prev) => applyOrdering(prev.filter((c) => c.id !== child.id)));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Error checking delete impact:', err);
      Alert.alert('خطأ', 'حدث خطأ. حاول مرة أخرى');
    }
  };

  // Handle moving child (unified function with functional setState for performance)
  const handleMove = useCallback((childId, direction) => {
    clearStatusBanner();
    let moved = false;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
  }, [applyOrdering, clearStatusBanner]);

  // Convenience wrappers for backward compatibility
  const handleMoveUp = useCallback((childId) => handleMove(childId, 'up'), [handleMove]);
  const handleMoveDown = useCallback((childId) => handleMove(childId, 'down'), [handleMove]);

  // Handle jump to specific position via Alert.prompt
  const handleJumpToPosition = useCallback((childId, currentIndex, totalChildren) => {
    // Dismiss keyboard first to avoid dual-focus state
    Keyboard.dismiss();

    // Brief delay for smooth keyboard dismissal before Alert appears
    setTimeout(() => {
      Alert.prompt(
        "الموقع",
        `1-${totalChildren}`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "موافق",
            onPress: (input) => {
              // Sanitize input: trim spaces, convert Arabic numerals to Western
              const sanitized = (input || "")
                .trim()
                .replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x0660) // Arabic-Indic digits (٠-٩)
                .replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 0x06F0); // Extended Arabic-Indic digits (۰-۹)

              const target = parseInt(sanitized, 10) - 1; // Convert to 0-based index
              if (isNaN(target) || target < 0 || target >= totalChildren || target === currentIndex) {
                return; // Invalid input or same position
              }

              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setAllChildren((prev) => {
                const arr = [...prev];
                const [moved] = arr.splice(currentIndex, 1);
                arr.splice(target, 0, moved);
                return applyOrdering(arr);
              });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          },
        ],
        "plain-text",
        "",
        "numeric"
      );
    }, 100); // 100ms delay for clean transition
  }, [applyOrdering]);

  // Feature flag for batch save (set to false for emergency rollback via OTA)
  const USE_BATCH_SAVE = true;

  // Save all changes
  const handleSave = async () => {
    if (!parentNode) return;

    // Network guard: prevent save if offline
    if (!await checkBeforeAction('إضافة أطفال جدد')) {
      return;
    }

    clearStatusBanner();

    const newChildren = allChildren.filter((c) => c.isNew);
    const editedChildren = allChildren.filter((c) => c.isEdited);
    const reorderedChildren = hasReordered
      ? allChildren.filter((c) => c.isExisting && !editedChildren.find(ec => ec.id === c.id))
      : [];

    if (newChildren.length === 0 && editedChildren.length === 0 && reorderedChildren.length === 0 && deletedExistingChildren.length === 0) {
      setStatusBanner({
        type: 'info',
        message: 'لا توجد تغييرات جديدة للحفظ',
      });
      return;
    }

    setLoading(true);

    // Front-end validation (before sending to backend)
    try {
      // Validate names
      for (const child of newChildren) {
        if (!child.name || child.name.trim().length < 2) {
          Alert.alert("خطأ", `اسم غير صحيح: "${child.name}"`);
          setLoading(false);
          return;
        }
      }

      // Validate parent generation
      if (parentNode.generation === null || parentNode.generation === undefined) {
        Alert.alert("خطأ", "حدد جيل الوالد أولاً");
        setLoading(false);
        return;
      }

      // Validate father selection for female parents
      if (parentNode.gender === "female" && !selectedFatherId) {
        Alert.alert("خطأ", "اختر الزوج من القائمة");
        setLoading(false);
        return;
      }

      // Note: Duplicate sibling_order validation removed - duplicates are now auto-fixed
      // on modal open (see initialization useEffect). Warning banner shows when duplicates
      // are detected, and applyOrdering() ensures sequential ordering before save.

      if (USE_BATCH_SAVE) {
        // =========================================================================
        // 🚀 NEW: BATCH SAVE PATH (95% reduction in RPC calls)
        // =========================================================================

        // Prepare children arrays for batch RPC
        const childrenToCreate = newChildren.map(child => ({
          name: child.name,
          gender: child.gender,
          sibling_order: child.sibling_order,
          kunya: child.kunya || null,
          nickname: child.nickname || null,
          status: 'alive',
        }));

        const childrenToUpdate = [
          ...editedChildren.map(child => ({
            id: child.id,
            version: child.version || 1,
            name: child.name,
            gender: child.gender,
            sibling_order: child.sibling_order,
            mother_id: child.mother_id !== undefined ? child.mother_id : null,
          })),
          ...reorderedChildren.map(child => ({
            id: child.id,
            version: child.version || 1,
            sibling_order: child.sibling_order,
          }))
        ];

        const childrenToDelete = deletedExistingChildren.map(child => ({
          id: child.id,
          version: child.version || 1,
        }));

        // Single atomic RPC call (replaces 23+ individual calls)
        const { data, error } = await profilesService.quickAddBatchSave(
          parentNode.id,
          parentNode.gender,
          selectedMotherId,
          selectedFatherId,
          childrenToCreate,
          childrenToUpdate,
          childrenToDelete,
          'إضافة سريعة جماعية'
        );

        if (error) {
          console.error('Batch save error:', error);
          // Humanize backend errors
          let friendlyError = error;
          if (error.includes('صلاحية')) {
            friendlyError = 'ليس لديك صلاحية';
          } else if (error.includes('version')) {
            friendlyError = 'تم تحديث البيانات من مستخدم آخر. أغلق النافذة وحاول مرة أخرى';
          } else if (error.includes('lock')) {
            friendlyError = 'عملية أخرى قيد التنفيذ. انتظر قليلاً';
          } else {
            friendlyError = 'حدث خطأ. حاول مرة أخرى';
          }
          Alert.alert("خطأ", friendlyError);
          setLoading(false);
          return;
        }

        // Validate RPC actually processed operations (catch silent failures)
        const totalExpected =
          childrenToCreate.length +
          childrenToUpdate.length +
          childrenToDelete.length;

        const totalProcessed =
          (data.results?.created || 0) +
          (data.results?.updated || 0) +
          (data.results?.deleted || 0);

        if (totalProcessed === 0 && totalExpected > 0) {
          console.error('[QuickAdd] Silent failure: RPC succeeded but 0 operations processed', {
            expected: totalExpected,
            results: data.results
          });
          Alert.alert("خطأ", "لم يتم حفظ أي تغييرات. يرجى المحاولة مرة أخرى");
          setLoading(false);
          return;
        }

        if (totalProcessed < totalExpected) {
          console.warn('[QuickAdd] Partial save:', {
            expected: totalExpected,
            processed: totalProcessed,
            results: data.results
          });
          // Continue anyway (some operations succeeded)
        }

        // Success! Refresh profile and invalidate cache
        await refreshProfile(parentNode.id);
        await invalidateStructureCache(); // Ensure fresh data after app restart

        // Brief delay for haptic feedback
        await new Promise(resolve => setTimeout(resolve, 300));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Close modal (refresh complete, no race condition)
        onChildAdded?.();
        onClose();
      } else {
        // =========================================================================
        // 📦 FALLBACK: SEQUENTIAL SAVE PATH (legacy)
        // =========================================================================

        const promises = [];

        // 1. Create new children
        for (const child of newChildren) {
          const profileData = {
            name: child.name,
            gender: child.gender,
            sibling_order: child.sibling_order,
            generation: (parentNode.generation || 0) + 1,
            status: "alive",
          };

          // Set parent IDs based on parent gender
          if (parentNode.gender === "male") {
            profileData.father_id = parentNode.id;
            profileData.mother_id = child.mother_id || selectedMotherId || null;
          } else {
            profileData.father_id = selectedFatherId;
            profileData.mother_id = parentNode.id;
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
          promises.push(profilesService.updateProfile(child.id, child.version || 1, updates));
        }

        // 3. Update reordered children
        for (const child of reorderedChildren) {
          promises.push(
            profilesService.updateProfile(child.id, child.version || 1, {
              sibling_order: child.sibling_order,
            })
          );
        }

        // 4. Delete removed children
        for (const child of deletedExistingChildren) {
          promises.push(
            profilesService.deleteProfile(child.id, child.version || 1)
              .then(({ data, error }) => {
                if (error) throw error;
                return { deleted: true, childId: child.id, childName: child.name };
              })
          );
        }

        const results = await Promise.allSettled(promises);
        const successful = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected");

        await refreshProfile(parentNode.id);

        if (failed.length === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Close modal after brief feedback (prevents duplicate saves)
          setTimeout(() => {
            onChildAdded?.();
            onClose();
          }, 300);
        } else if (successful > 0) {
          Alert.alert(
            "تحديث جزئي",
            `تم حفظ ${successful} من ${results.length} بنجاح.\n\nفشل ${failed.length} عملية.`,
            [{ text: "حسناً", onPress: onChildAdded }]
          );
        } else {
          const firstError = failed[0]?.reason?.message || failed[0]?.reason || "خطأ غير معروف";
          Alert.alert(
            "خطأ",
            `فشل حفظ ${failed.length} من ${results.length} عملية.\n\nالخطأ: ${firstError}`,
            [{ text: "حسناً" }]
          );
        }
      }
    } catch (error) {
      console.error("Error saving children:", error);
      Alert.alert("خطأ", "فشل الحفظ. حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const newChildrenCount = allChildren.filter((c) => c.isNew).length;
  const editedChildrenCount = allChildren.filter((c) => c.isEdited).length;
  const deleteCount = deletedExistingChildren.length;
  const totalChanges = newChildrenCount + editedChildrenCount;
  const hasChanges = totalChanges > 0 || hasReordered || deleteCount > 0;

  const getSaveButtonText = () => {
    if (loading) return "جاري الحفظ...";

    if (newChildrenCount > 0 && editedChildrenCount === 0 && deleteCount === 0) {
      return newChildrenCount === 1 ? "حفظ طفل واحد" : `حفظ ${newChildrenCount} أطفال جدد`;
    }
    if (editedChildrenCount > 0 && newChildrenCount === 0 && deleteCount === 0) {
      return editedChildrenCount === 1 ? "حفظ تعديل واحد" : `حفظ ${editedChildrenCount} تعديلات`;
    }
    if (deleteCount > 0 && newChildrenCount === 0 && editedChildrenCount === 0) {
      return deleteCount === 1 ? "حذف طفل واحد" : `حذف ${deleteCount} أطفال`;
    }
    if (totalChanges > 0 || deleteCount > 0) {
      const parts = [];
      if (newChildrenCount > 0) parts.push(`${newChildrenCount} جديد`);
      if (editedChildrenCount > 0) parts.push(`${editedChildrenCount} تعديل`);
      if (deleteCount > 0) parts.push(`${deleteCount} حذف`);
      return `حفظ (${parts.join('، ')})`;
    }
    return "حفظ";
  };

  const trimmedCurrentName = currentName.trim();
  const canQuickAdd = trimmedCurrentName.length >= 2 && trimmedCurrentName.length <= 100 && !inputError && !loading;

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
        onJumpToPosition={handleJumpToPosition}
        mothers={mothers}
      />
    ),
    [allChildren.length, mothers, handleUpdateChild, handleDeleteChild, handleMoveUp, handleMoveDown, handleJumpToPosition]
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
              keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
              style={styles.flex}
            >
              <View style={styles.navBar}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.navAction}
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق النافذة"
                >
                  <Text style={styles.navActionText}>إغلاق</Text>
                </TouchableOpacity>

                <View style={styles.navTitleBlock}>
                  <Text style={styles.navTitle}>أبناء {parentDisplayName}</Text>
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
                    {loading ? "جاري..." : "حفظ"}
                  </Text>
                  {hasChanges && totalChanges > 0 && !loading && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{totalChanges}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {(statusBanner || hasChanges) && (
                <Animated.View
                  style={[
                    styles.statusBanner,
                    {
                      opacity: statusBanner ? statusAnim : 1,
                      transform: [
                        {
                          translateY: statusBanner
                            ? statusAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 0],
                              })
                            : 0,
                        },
                      ],
                    },
                    statusBanner?.type === 'success'
                      ? styles.statusBannerSuccess
                      : statusBanner?.type === 'error'
                      ? styles.statusBannerError
                      : styles.statusBannerInfo,
                  ]}
                >
                  <Ionicons
                    name={
                      statusBanner?.type === 'success'
                        ? "checkmark-circle"
                        : statusBanner?.type === 'error'
                        ? "alert-circle"
                        : "information-circle"
                    }
                    size={18}
                    color={
                      statusBanner?.type === 'success'
                        ? tokens.colors.success
                        : statusBanner?.type === 'error'
                        ? tokens.colors.danger
                        : COLORS.primary
                    }
                  />
                  <Text style={styles.statusBannerText}>
                    {statusBanner?.message || getSaveButtonText()}
                  </Text>
                  {statusBanner && (
                    <TouchableOpacity
                      onPress={clearStatusBanner}
                      style={styles.statusDismiss}
                      accessibilityLabel="إخفاء الرسالة"
                    >
                      <Ionicons name="close" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </Animated.View>
              )}

              {/* Duplicate Order Warning Banner */}
              {showDuplicateWarning && (
                <View style={styles.duplicateWarningBanner}>
                  <Ionicons name="warning-outline" size={20} color="#D58C4A" style={styles.warningIcon} />
                  <View style={styles.warningTextContainer}>
                    <Text style={styles.warningTitle}>تم اكتشاف خطأ في الترتيب</Text>
                    <Text style={styles.warningMessage}>
                      تم العثور على تكرار في أرقام الترتيب ({duplicateInfo.map(d => d.order).join('، ')}) وتم إصلاحه تلقائياً. يرجى مراجعة الترتيب والتأكد من صحته.
                    </Text>
                  </View>
                </View>
              )}

              <BlurView intensity={24} tint="light" style={styles.quickAddBlur}>
                <View style={styles.quickAddSection}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>اسم الطفل</Text>
                  <View style={styles.nameRow}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.inputField, inputError && styles.inputFieldError]}
                      placeholder="اكتب الاسم الكامل"
                      placeholderTextColor={`${COLORS.textMuted  }AA`}
                      value={currentName}
                      onChangeText={(text) => {
                        setCurrentName(text);
                        if (inputError) {
                          const trimmed = text.trim();
                          if (trimmed.length >= 2 && trimmed.length <= 100) {
                            setInputError(null);
                          }
                        }
                      }}
                      onSubmitEditing={handleAutoAdd}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      allowFontScaling
                      maxLength={100}
                    />
                    <Animated.View
                      style={[
                        styles.inlineAddButtonWrapper,
                        { transform: [{ scale: addButtonScale }] },
                        !canQuickAdd && styles.inlineAddButtonDisabled,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.inlineAddButton}
                        onPress={handleAutoAdd}
                        onPressIn={handleAddPressIn}
                        onPressOut={handleAddPressOut}
                        disabled={!canQuickAdd}
                        accessibilityRole="button"
                        accessibilityLabel="إضافة الطفل"
                      >
                        <Ionicons
                          name="add"
                          size={22}
                          color={canQuickAdd ? COLORS.primary : COLORS.textMuted}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                  {inputError ? <Text style={styles.fieldError}>{inputError}</Text> : null}
                </View>

                <View style={styles.inlineControlsRow}>
                  <View style={styles.genderGroup}>
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

                  <View style={styles.selectorGroup}>
                    {parentNode?.gender === "male" ? (
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
                            Alert.alert("تنبيه", "لم نستطع تحميل بيانات الأمهات");
                          }
                        }}
                        label="الأم (اختياري)"
                        showLabel={false}
                      />
                    ) : (
                      <FatherSelectorSimple
                        motherId={parentNode.id}
                        value={selectedFatherId}
                        onChange={(id, husbandsData) => {
                          setSelectedFatherId(id);
                          if (!husbandsData && id) {
                            Alert.alert("تنبيه", "لم نستطع تحميل بيانات الأزواج");
                          }
                        }}
                        label="الأب (مطلوب)"
                        required
                        showLabel={false}
                      />
                    )}
                  </View>
                </View>

                </View>
              </BlurView>

              <View style={styles.childrenListSection}>
                {allChildren.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>👶</Text>
                    <Text style={styles.emptyStateTitle}>ابدأ بإضافة الأطفال</Text>
                    <Text style={styles.emptyStateSubtitle}>
                      اكتب الاسم ثم اضغط إدخال أو زر + للإضافة
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
    borderBottomColor: `${COLORS.container  }33`,
    backgroundColor: COLORS.background,
  },
  navAction: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  navActionText: {
    fontSize: tokens.typography.subheadline.fontSize,
    fontWeight: "600",
    color: COLORS.text,
  },
  navTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: tokens.spacing.sm,
  },
  navTitle: {
    fontSize: tokens.typography.title2.fontSize,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  navSubtitle: {},
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
    backgroundColor: `${COLORS.container  }33`,
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
    backgroundColor: `${COLORS.background  }30`,
    alignItems: "center",
  },
  navBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "700",
    color: COLORS.background,
  },
  quickAddBlur: {
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    overflow: "visible",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container  }25`,
    backgroundColor: `${COLORS.background  }66`,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    zIndex: 100,
  },
  quickAddSection: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
    backgroundColor: `${COLORS.background  }F6`,
    borderRadius: tokens.radii.lg,
    position: "relative",
    zIndex: 50,
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
    flex: 1,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: `${COLORS.container  }40`,
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
    textAlign: "auto",
  },
  inputFieldError: {
    borderColor: `${tokens.colors.danger  }66`,
    backgroundColor: `${tokens.colors.danger  }12`,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  fieldError: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.danger,
    textAlign: "right",
  },
  inlineAddButtonWrapper: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container  }33`,
    backgroundColor: `${COLORS.background  }F2`,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flexShrink: 0,
  },
  inlineAddButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.md,
  },
  inlineAddButtonDisabled: {
    opacity: 0.4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
  },
  statusBannerSuccess: {
    backgroundColor: `${tokens.colors.success  }15`,
  },
  statusBannerError: {
    backgroundColor: `${tokens.colors.danger  }15`,
  },
  statusBannerInfo: {
    backgroundColor: `${COLORS.container  }20`,
  },
  statusBannerText: {
    flex: 1,
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.text,
    fontWeight: "500",
  },
  statusDismiss: {
    padding: tokens.spacing.xxs,
  },
  // Duplicate sibling_order warning banner styles
  duplicateWarningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFF4E6",
    borderLeftWidth: 4,
    borderLeftColor: "#D58C4A",
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  warningIcon: {
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: tokens.spacing.sm,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  warningMessage: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
    alignItems: "center",
  },
  segmentButton: {
    flex: 1,
    height: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${COLORS.container  }40`,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.sm,
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
  inlineControlsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    flexWrap: "nowrap",
  },
  genderGroup: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    gap: tokens.spacing.xxs,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  selectorGroup: {
    flexBasis: 0,
    flexGrow: 1.2,
    flexShrink: 1,
    gap: tokens.spacing.xxs,
    alignSelf: "stretch",
    justifyContent: "center",
    zIndex: 200,
  },
  childrenListSection: {
    flex: 1,
    marginTop: tokens.spacing.sm,
    zIndex: 1,
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
