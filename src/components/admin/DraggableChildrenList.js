import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedReaction,
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import CardSurface from "../ios/CardSurface";
import QuickAddOverlay from "./QuickAddOverlay";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import profilesService from "../../services/profiles";

// Enable RTL
I18nManager.forceRTL(true);

const ITEM_HEIGHT = 80;

// Individual draggable child item
const DraggableChildItem = ({
  child,
  index,
  totalCount,
  onMove,
  onDelete,
  onPress,
  scrollOffset,
  scrollViewHeight,
}) => {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const currentIndex = useSharedValue(index);
  const opacity = useSharedValue(1);
  const itemHeight = useSharedValue(ITEM_HEIGHT);

  // Update index when it changes
  useAnimatedReaction(
    () => index,
    (newIndex) => {
      currentIndex.value = newIndex;
    },
  );

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startY = translateY.value;
      isDragging.value = true;
      itemHeight.value = withSpring(itemHeight.value * 1.05);
      opacity.value = withTiming(0.8);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    },
    onActive: (event, ctx) => {
      translateY.value = ctx.startY + event.translationY;

      // Calculate new index based on drag position
      const newIndex = Math.floor(
        (ctx.startY + event.translationY + itemHeight.value / 2) /
          itemHeight.value,
      );
      const clampedIndex = Math.max(0, Math.min(newIndex, totalCount - 1));

      if (clampedIndex !== index) {
        runOnJS(onMove)(index, clampedIndex);
      }
    },
    onEnd: () => {
      translateY.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(80);
      opacity.value = withTiming(1);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    },
    onFail: () => {
      translateY.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(80);
      opacity.value = withTiming(1);
    },
    onCancel: () => {
      translateY.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(80);
      opacity.value = withTiming(1);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 1000 : 0,
    opacity: opacity.value,
    elevation: isDragging.value ? 5 : 1,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(isDragging.value ? "#F0F0F5" : "#FFFFFF", {
      duration: 200,
    }),
  }));

  return (
    <Animated.View
      style={[styles.childItemContainer, animatedStyle]}
      layout={Layout.springify()}
    >
      <Animated.View style={[styles.childItem, containerStyle]}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={24} color="#C7C7CC" />
          </Animated.View>
        </PanGestureHandler>

        <TouchableOpacity
          style={styles.childContent}
          onPress={() => onPress(child)}
          activeOpacity={0.7}
        >
          <View style={styles.childInfo}>
            <View style={styles.childHeader}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>
              <Text style={styles.childName}>{child.name}</Text>
              {child.gender === "male" ? (
                <Ionicons name="male" size={16} color="#007AFF" />
              ) : (
                <Ionicons name="female" size={16} color="#E91E63" />
              )}
            </View>

            <View style={styles.childMeta}>
              <Text style={styles.childMetaText}>HID: {child.hid}</Text>
              {child.status === "deceased" && (
                <View style={styles.deceasedBadge}>
                  <Text style={styles.deceasedText}>متوفى</Text>
                </View>
              )}
              {child.mother?.name && (
                <Text style={styles.childMetaText}>
                  الأم: {child.mother.name}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(child)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// Main draggable children list component
const DraggableChildrenList = ({
  children: initialChildren,
  onReorder,
  onUpdate,
  parentProfile,
  isAdmin,
}) => {
  const [children, setChildren] = useState(initialChildren || []);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalOrder = useRef([]);

  const scrollViewRef = useRef(null);
  const scrollOffset = useSharedValue(0);
  const scrollViewHeight = useSharedValue(0);

  // Update children when prop changes - ensure they're sorted by sibling_order
  React.useEffect(() => {
    const sortedChildren = [...(initialChildren || [])].sort((a, b) => {
      const orderA = a.sibling_order ?? 999;
      const orderB = b.sibling_order ?? 999;
      return orderA - orderB; // Oldest first (lower sibling_order = older = should appear at top)
    });
    setChildren(sortedChildren);
    originalOrder.current = sortedChildren.map((c) => c.id);
    setHasChanges(false);
  }, [initialChildren]);

  // Group children by mother for better organization
  const groupedChildren = React.useMemo(() => {
    if (!parentProfile || parentProfile.gender !== "male") {
      return { ungrouped: children };
    }

    const groups = {};
    children.forEach((child) => {
      const motherId = child.mother_id || "unknown";
      const motherName = child.mother?.name || "غير معروف";

      if (!groups[motherId]) {
        groups[motherId] = {
          mother: { id: motherId, name: motherName },
          children: [],
        };
      }
      groups[motherId].children.push(child);
    });

    return groups;
  }, [children, parentProfile]);

  // Handle child reordering
  const handleMove = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    setChildren((prev) => {
      const newChildren = [...prev];
      const [movedChild] = newChildren.splice(fromIndex, 1);
      newChildren.splice(toIndex, 0, movedChild);

      // Check if order has changed from original
      const currentOrder = newChildren.map((c) => c.id);
      const orderChanged = !originalOrder.current.every(
        (id, index) => id === currentOrder[index],
      );
      setHasChanges(orderChanged);

      return newChildren;
    });
  }, []);

  // Save reordered children
  const saveOrder = useCallback(async () => {
    if (!hasChanges || saving) return;

    setSaving(true);
    try {
      if (onReorder) {
        await onReorder(children);
      }
      originalOrder.current = children.map((c) => c.id);
      setHasChanges(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving order:", error);
      Alert.alert("خطأ", "فشل حفظ الترتيب");
    } finally {
      setSaving(false);
    }
  }, [children, onReorder, hasChanges, saving]);

  // Removed automatic debounced save - only save when explicitly reordering
  // This was causing the modal to close after 1 second

  // Handle delete with impact preview
  const handleDeleteChild = async (child) => {
    setDeleteTarget(child);
    setLoadingImpact(true);
    setShowDeleteDialog(true);

    try {
      const { data, error } = await profilesService.previewDeleteImpact(
        child.id,
      );

      if (error) {
        console.error("Error getting delete impact:", error);
        setDeleteImpact({
          total_affected: 1,
          direct_children: 0,
          total_descendants: 0,
        });
      } else {
        setDeleteImpact(data);
      }
    } catch (error) {
      console.error("Error in handleDeleteChild:", error);
      setDeleteImpact({
        total_affected: 1,
        direct_children: 0,
        total_descendants: 0,
      });
    } finally {
      setLoadingImpact(false);
    }
  };

  // Confirm delete
  const confirmDelete = async (cascade = false) => {
    if (!deleteTarget) return;

    try {
      const { data, error } = await profilesService.deleteProfile(
        deleteTarget.id,
        cascade,
      );

      if (error) {
        Alert.alert("خطأ", "فشل حذف الملف الشخصي");
        console.error("Delete error:", error);
      } else {
        Alert.alert("نجح", `تم حذف ${data.deleted_count} ملف شخصي`);
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحذف");
      console.error("Error in confirmDelete:", error);
    } finally {
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      setDeleteImpact(null);
    }
  };

  // Handle child press (navigate to profile)
  const handleChildPress = (child) => {
    // You can implement navigation to child's profile here
    console.log("Navigate to child:", child.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Render children list (flat or grouped)
  const renderChildrenList = () => {
    if (
      parentProfile?.gender === "male" &&
      Object.keys(groupedChildren).length > 1
    ) {
      // Render grouped by mother
      return Object.entries(groupedChildren).map(([motherId, group]) => (
        <View key={motherId} style={styles.motherGroup}>
          <View style={styles.motherHeader}>
            <Text style={styles.motherName}>أم: {group.mother.name}</Text>
            <Text style={styles.motherChildCount}>
              {group.children.length} أطفال
            </Text>
          </View>

          {group.children.map((child, index) => (
            <DraggableChildItem
              key={child.id}
              child={child}
              index={children.indexOf(child)}
              totalCount={children.length}
              onMove={handleMove}
              onDelete={isAdmin ? handleDeleteChild : null}
              onPress={handleChildPress}
              scrollOffset={scrollOffset}
              scrollViewHeight={scrollViewHeight}
            />
          ))}
        </View>
      ));
    } else {
      // Render flat list
      return children.map((child, index) => (
        <DraggableChildItem
          key={child.id}
          child={child}
          index={index}
          totalCount={children.length}
          onMove={handleMove}
          onDelete={isAdmin ? handleDeleteChild : null}
          onPress={handleChildPress}
          scrollOffset={scrollOffset}
          scrollViewHeight={scrollViewHeight}
        />
      ));
    }
  };

  if (!children || children.length === 0) {
    return (
      <CardSurface>
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyText}>لا يوجد أبناء</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowQuickAdd(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.addButtonText}>إضافة أبناء</Text>
            </TouchableOpacity>
          )}
        </View>
      </CardSurface>
    );
  }

  return (
    <>
      <CardSurface>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>الأبناء ({children.length})</Text>
            <View style={styles.headerButtons}>
              {isAdmin && hasChanges && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveOrder}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={styles.saveButtonText}>حفظ الترتيب</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity
                  style={styles.addIconButton}
                  onPress={() => setShowQuickAdd(true)}
                >
                  <Ionicons name="add-circle" size={24} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Instructions */}
          {isAdmin && (
            <View style={styles.instructions}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#8A8A8E"
              />
              <Text style={styles.instructionText}>
                اسحب الأبناء لإعادة الترتيب
              </Text>
            </View>
          )}

          {/* Children List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              scrollOffset.value = e.nativeEvent.contentOffset.y;
            }}
            onLayout={(e) => {
              scrollViewHeight.value = e.nativeEvent.layout.height;
            }}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {renderChildrenList()}
          </ScrollView>
        </View>
      </CardSurface>

      {/* Quick Add Modal */}
      <QuickAddOverlay
        visible={showQuickAdd}
        onClose={() => {
          setShowQuickAdd(false);
          if (onUpdate) onUpdate();
        }}
        parentNode={parentProfile}
        siblings={children}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeleteTarget(null);
          setDeleteImpact(null);
        }}
        target={deleteTarget}
        impact={deleteImpact}
        loading={loadingImpact}
        onConfirm={confirmDelete}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic Regular",
  },
  addIconButton: {
    padding: 4,
  },
  instructions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F7F7FA",
  },
  instructionText: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    padding: 16,
  },
  motherGroup: {
    marginBottom: 24,
  },
  motherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  motherName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  motherChildCount: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  childItemContainer: {
    height: ITEM_HEIGHT,
    marginBottom: 8,
  },
  childItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F0F0F5",
  },
  dragHandle: {
    padding: 8,
    marginRight: 8,
  },
  childContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  childInfo: {
    flex: 1,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  orderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8A8A8E",
  },
  childName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  childMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  childMetaText: {
    fontSize: 13,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  deceasedBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deceasedText: {
    fontSize: 11,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  addButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 15,
    color: "#007AFF",
    fontFamily: "SF Arabic Regular",
  },
});

export default DraggableChildrenList;
