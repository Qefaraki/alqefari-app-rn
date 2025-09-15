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
  I18nManager,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import profilesService from "../../services/profiles";
import useStore from "../../hooks/useStore";
import MotherSelector from "./fields/MotherSelector";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Enable RTL
I18nManager.forceRTL(true);

// Child Card Component - Editable
const ChildCard = ({ child, index, onEdit, onDelete, isActive, isNew }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(isNew ? 50 : 0)).current;
  const opacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

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
      Animated.timing(opacity, {
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
    <Animated.View
      style={[
        styles.childCard,
        isActive && styles.childCardActive,
        {
          transform: [{ scale: scaleAnim }, { translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.childCardContent}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.childCardHeader}>
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>{index + 1}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <View style={styles.childCardBody}>
          <Text style={styles.childName} numberOfLines={1}>
            {child.name || "غير مسمى"}
          </Text>
          <View style={styles.childGenderBadge}>
            <Ionicons
              name={child.gender === "male" ? "male" : "female"}
              size={14}
              color={child.gender === "male" ? "#007AFF" : "#FF2D55"}
            />
            <Text
              style={[
                styles.childGenderText,
                { color: child.gender === "male" ? "#007AFF" : "#FF2D55" },
              ]}
            >
              {child.gender === "male" ? "ذكر" : "أنثى"}
            </Text>
          </View>
        </View>

        {isActive && (
          <View style={styles.editIndicator}>
            <Ionicons name="pencil" size={12} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const { refreshProfile } = useStore();
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Initialize with existing siblings
  useEffect(() => {
    if (visible && parentNode) {
      // Sort siblings by sibling_order (ascending = oldest to youngest)
      const sortedSiblings = [...siblings]
        .sort((a, b) => (a.sibling_order ?? 0) - (b.sibling_order ?? 0))
        .map((s) => ({
          ...s,
          isNew: false,
          isExisting: true,
        }));

      setAllChildren(sortedSiblings);
      setCurrentChild({ name: "", gender: "male", id: null });
      setEditingChildId(null);
      setSelectedMotherId(null);

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
      // Add new child to list
      const newChild = {
        id: `new-${Date.now()}`,
        name: trimmedName,
        gender: currentChild.gender,
        isNew: true,
        isExisting: false,
        sibling_order: allChildren.filter((c) => c.isNew).length,
      };
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

  // Show success animation
  const showSuccess = () => {
    setShowSuccessAnimation(true);
    Animated.sequence([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessAnimation(false);
      onClose();
    });
  };

  // Save all children
  const handleSaveAll = async () => {
    const newChildren = allChildren.filter((child) => child.isNew);

    if (newChildren.length === 0) {
      Alert.alert("تنبيه", "لا يوجد أطفال جدد للحفظ");
      return;
    }

    setLoading(true);
    try {
      const childrenToSave = newChildren.map((child, index) => ({
        name: child.name.trim(),
        gender: child.gender,
        sibling_order: siblings.length + index,
      }));

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
              parentNode.gender === "female" ? parentNode.id : selectedMotherId,
            sibling_order: child.sibling_order,
          });

          if (result.error) {
            throw new Error(`Failed to create ${child.name}: ${result.error}`);
          }
        }
      }

      if (refreshProfile) {
        await refreshProfile(parentNode.id);
      }

      showSuccess();
    } catch (error) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
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

          {/* Children List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.childrenList}
            contentContainerStyle={styles.childrenListContent}
            showsVerticalScrollIndicator={false}
          >
            {allChildren.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>
                  لم تتم إضافة أطفال بعد
                </Text>
                <Text style={styles.emptyStateHint}>
                  ابدأ بإدخال اسم الطفل الأول
                </Text>
              </View>
            ) : (
              <View style={styles.childrenGrid}>
                {allChildren.map((child, index) => (
                  <ChildCard
                    key={child.id}
                    child={child}
                    index={index}
                    onEdit={handleEditChild}
                    onDelete={handleDeleteChild}
                    isActive={editingChildId === child.id}
                    isNew={child.isNew}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Form */}
          <View style={styles.inputForm}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingChildId ? "تعديل الطفل" : "طفل جديد"}
              </Text>
              {editingChildId && (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentChild({ name: "", gender: "male", id: null });
                    setEditingChildId(null);
                  }}
                  style={styles.cancelEditButton}
                >
                  <Text style={styles.cancelEditText}>إلغاء التعديل</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputRow}>
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

              <View style={styles.genderToggle}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    currentChild.gender === "male" && styles.genderOptionActive,
                  ]}
                  onPress={() =>
                    setCurrentChild((prev) => ({ ...prev, gender: "male" }))
                  }
                >
                  <Ionicons
                    name="male"
                    size={18}
                    color={currentChild.gender === "male" ? "#FFF" : "#666"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    currentChild.gender === "female" &&
                      styles.genderOptionActive,
                  ]}
                  onPress={() =>
                    setCurrentChild((prev) => ({ ...prev, gender: "female" }))
                  }
                >
                  <Ionicons
                    name="female"
                    size={18}
                    color={currentChild.gender === "female" ? "#FFF" : "#666"}
                  />
                </TouchableOpacity>
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
                  size={24}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>

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
                (loading || newChildrenCount === 0) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSaveAll}
              disabled={loading || newChildrenCount === 0}
            >
              {loading ? (
                <Text style={styles.saveButtonText}>جارِ الحفظ...</Text>
              ) : (
                <Text style={styles.saveButtonText}>
                  {newChildrenCount === 0
                    ? "لا يوجد أطفال جدد"
                    : newChildrenCount === 1
                      ? "حفظ الطفل"
                      : `حفظ الكل (${newChildrenCount} أطفال)`}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Success Animation Overlay */}
          {showSuccessAnimation && (
            <Animated.View
              style={[styles.successOverlay, { opacity: successOpacity }]}
              pointerEvents="none"
            >
              <View style={styles.successContent}>
                <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                <Text style={styles.successText}>تم الحفظ بنجاح!</Text>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  childrenList: {
    flex: 1,
  },
  childrenListContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 17,
    color: "#8E8E93",
    marginTop: 16,
    fontWeight: "500",
  },
  emptyStateHint: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 8,
  },
  childrenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  childCard: {
    width: (SCREEN_WIDTH - 32 - 12) / 2,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  childCardActive: {
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#F0F9FF",
  },
  childCardContent: {
    flex: 1,
  },
  childCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
  },
  deleteButton: {
    padding: 4,
  },
  childCardBody: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6,
    textAlign: "right",
  },
  childGenderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  childGenderText: {
    fontSize: 13,
    fontWeight: "500",
  },
  editIndicator: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  inputForm: {
    backgroundColor: "#FFF",
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
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
    color: "#8E8E93",
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
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    textAlign: "right",
  },
  genderToggle: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    padding: 2,
  },
  genderOption: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  genderOptionActive: {
    backgroundColor: "#000",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#C7C7CC",
    opacity: 0.6,
  },
  motherSelectorContainer: {
    marginTop: 12,
  },
  bottomActions: {
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    alignItems: "center",
  },
  successText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#34C759",
    marginTop: 16,
  },
});

export default QuickAddOverlay;
