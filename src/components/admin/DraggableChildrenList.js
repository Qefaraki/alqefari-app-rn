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
  const translateX = useSharedValue(0);
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
      ctx.startX = translateX.value;
      isDragging.value = true;
      itemHeight.value = withSpring(itemHeight.value * 1.05);
      opacity.value = withTiming(0.8);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;

      // Calculate new index based on drag position (horizontal)
      // Using approximate width for gesture calculation
      const avgWidth = 100;
      const newIndex = Math.floor(
        (ctx.startX + event.translationX + avgWidth / 2) / avgWidth,
      );
      const clampedIndex = Math.max(0, Math.min(newIndex, totalCount - 1));

      if (clampedIndex !== index) {
        runOnJS(onMove)(index, clampedIndex);
      }
    },
    onEnd: () => {
      translateX.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(ITEM_HEIGHT);
      opacity.value = withTiming(1);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    },
    onFail: () => {
      translateX.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(ITEM_HEIGHT);
      opacity.value = withTiming(1);
    },
    onCancel: () => {
      translateX.value = withSpring(0);
      isDragging.value = false;
      itemHeight.value = withSpring(ITEM_HEIGHT);
      opacity.value = withTiming(1);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.childItem, containerStyle]}>
          <TouchableOpacity
            style={styles.childContent}
            onPress={() => onPress(child)}
            activeOpacity={0.7}
          >
            <View style={styles.nameRow}>
              <Text style={styles.childName}>{child.name}</Text>
              {child.mother?.name && (
                <Text style={styles.motherName}>
                  والدته: {child.mother.name}
                </Text>
              )}
            </View>
            {child.status === "deceased" && (
              <Text style={styles.deceasedText}>الله يرحمه</Text>
            )}
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(child)}
            >
              <Ionicons name="close-circle" size={18} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </PanGestureHandler>
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

  // Update children when prop changes
  // Children come pre-sorted from RelationshipManagerV2 (reversed for display)
  React.useEffect(() => {
    // Don't re-sort here - we receive them in the correct display order
    setChildren(initialChildren || []);
    originalOrder.current = (initialChildren || []).map((c) => c.id);
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
        deleteTarget.version || 1,
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
      // Render grouped by mother - for horizontal layout, render all children flat
      // but show mother labels as dividers
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
            horizontal
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              scrollOffset.value = e.nativeEvent.contentOffset.x;
            }}
            onLayout={(e) => {
              scrollViewHeight.value = e.nativeEvent.layout.width;
            }}
            scrollEventThrottle={16}
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
    height: ITEM_HEIGHT + 20,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
  },
  motherGroup: {
    marginRight: 16,
  },
  motherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 8,
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
    marginHorizontal: 4,
  },
  childItem: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F0F0F5",
    justifyContent: "space-between",
  },
  childContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  nameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  childName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  motherName: {
    fontSize: 12,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
    marginTop: 2,
  },
  deceasedText: {
    fontSize: 11,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
    alignSelf: "center",
    marginBottom: 2,
  },
  deleteButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
