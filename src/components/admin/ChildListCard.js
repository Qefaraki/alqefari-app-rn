import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;

const ChildListCard = ({
  child,
  index,
  totalChildren,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToPosition,
  mothers = [],
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(child.name);
  const [localGender, setLocalGender] = useState(child.gender);
  const [localMotherId, setLocalMotherId] = useState(child.mother_id);
  const [isMoving, setIsMoving] = useState(false);
  const [motherSheetVisible, setMotherSheetVisible] = useState(false);

  // Animation values for entrance only
  const fadeAnim = useRef(new Animated.Value(child.isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(child.isNew ? 20 : 0)).current;

  // Highlight animation for reorder
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const prevIndex = useRef(index);

  // Trigger highlight animation when position changes
  useEffect(() => {
    if (prevIndex.current !== index && prevIndex.current !== undefined) {
      // Flash highlight - stronger and slower for better visibility
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    }
    prevIndex.current = index;
  }, [index, highlightAnim]);

  // Entrance animation for new cards
  useEffect(() => {
    let animation;
    let isMounted = true;

    if (child.isNew) {
      animation = Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]);
      animation.start();
    }

    return () => {
      isMounted = false;
      if (animation) {
        try {
          animation.stop();
        } catch (e) {
          console.warn('Animation cleanup error:', e);
        }
      }
      // Explicit cleanup for all animated values
      try {
        fadeAnim.stopAnimation();
        slideAnim.stopAnimation();
        highlightAnim.stopAnimation();
      } catch (e) {
        console.warn('Explicit animation cleanup error:', e);
      }
    };
  }, []);

  const getCardStyle = () => {
    if (child.isNew) return styles.cardNew;
    if (child.isEdited) return styles.cardEdited;
    return {};
  };

  const getBadge = () => {
    if (child.isNew) {
      return (
        <View style={[styles.stateBadge, styles.stateBadgeNew]}>
          <Text style={styles.stateBadgeText}>جديد</Text>
        </View>
      );
    }
    // No badge for edited - too much visual clutter
    return null;
  };

  const handleSaveEdit = () => {
    const trimmedName = localName.trim();

    // Comprehensive validation
    if (trimmedName.length === 0) {
      Alert.alert("خطأ", "الاسم مطلوب");
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert("خطأ", "الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (trimmedName.length > 100) {
      Alert.alert("خطأ", "الاسم طويل جداً (100 حرف كحد أقصى)");
      return;
    }

    onUpdate(child.id, {
      name: trimmedName,
      gender: localGender,
      mother_id: localMotherId,
    });

    setIsEditing(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCancelEdit = () => {
    setLocalName(child.name);
    setLocalGender(child.gender);
    setLocalMotherId(child.mother_id);
    setIsEditing(false);
  };

  const handleArrowPress = (direction) => {
    if (isMoving) return; // Debounce guard
    setIsMoving(true);

    if (direction === 'up') {
      onMoveUp(child.id);
    } else {
      onMoveDown(child.id);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setIsMoving(false), 300);
  };

  const handleDelete = () => {
    if (child.isNew) {
      // Delete immediately for new children
      onDelete(child);
    } else {
      // Confirmation for existing children
      Alert.alert(
        "حذف الطفل",
        `هل تريد حذف ${child.name}؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "حذف",
            style: "destructive",
            onPress: () => onDelete(child),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const getMotherName = () => {
    if (!child.mother_id) return null;
    const mother = mothers.find((m) => m.id === child.mother_id);
    return mother?.name || child.mother_name;
  };

  const getLocalMotherName = () => {
    if (!localMotherId) return "غير محدد";
    const mother = mothers.find((m) => m.id === localMotherId);
    return mother?.name || "غير محدد";
  };

  const handleMotherSelect = (motherId) => {
    setLocalMotherId(motherId);
    setMotherSheetVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearMother = () => {
    setLocalMotherId(null);
    setMotherSheetVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const motherName = getMotherName();

  // Interpolate highlight color - stronger opacity for better visibility
  const highlightColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.background, COLORS.secondary + "40"],
  });

  return (
    <>
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.View style={[styles.card, getCardStyle(), { backgroundColor: highlightColor }]}>
          {/* Reorder Controls - horizontal iOS layout */}
          {totalChildren > 1 && (
            <View style={styles.reorderControls}>
              {/* Position Badge */}
              <View style={styles.positionBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>

              {/* Up Arrow slot - always reserve space */}
              <View style={styles.arrowSlot}>
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => handleArrowPress('up')}
                    disabled={isMoving}
                  >
                    <Ionicons
                      name="chevron-up-circle-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Down Arrow slot - always reserve space */}
              <View style={styles.arrowSlot}>
                {index < totalChildren - 1 && (
                  <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => handleArrowPress('down')}
                    disabled={isMoving}
                  >
                    <Ionicons
                      name="chevron-down-circle-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Card Content */}
          <View style={styles.content}>
            {isEditing ? (
              // Edit Mode - iOS-native compact design
              <View style={styles.editContainer}>
                {/* Name Input */}
                <TextInput
                  style={styles.nameInputInline}
                  value={localName}
                  onChangeText={setLocalName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveEdit}
                  placeholder="اسم الطفل"
                  placeholderTextColor={COLORS.textMuted}
                  textAlign="left"
                />

                {/* Gender + Mother Row */}
                <View style={styles.editRow}>
                  {/* Gender Segmented Control */}
                  <View style={styles.segmentedControl}>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        localGender === "male" && styles.segmentButtonActive,
                      ]}
                      onPress={() => {
                        setLocalGender("male");
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          localGender === "male" && styles.segmentTextActive,
                        ]}
                      >
                        ذكر
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        localGender === "female" && styles.segmentButtonActive,
                      ]}
                      onPress={() => {
                        setLocalGender("female");
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          localGender === "female" && styles.segmentTextActive,
                        ]}
                      >
                        أنثى
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Mother Selector Button (if mothers available) */}
                  {mothers.length > 0 && (
                    <TouchableOpacity
                      style={styles.motherButton}
                      onPress={() => {
                        setMotherSheetVisible(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.motherButtonContent}>
                        <Ionicons
                          name="person"
                          size={16}
                          color={localMotherId ? COLORS.primary : COLORS.textMuted}
                        />
                        <Text
                          style={[
                            styles.motherButtonText,
                            localMotherId && styles.motherButtonTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {getLocalMotherName()}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={14}
                          color={COLORS.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              // View Mode
              <View style={styles.viewContainer}>
                <Text style={styles.childName} numberOfLines={1}>
                  {child.name}
                </Text>
                <View style={styles.metadata}>
                  <Text style={styles.metadataText}>
                    {child.gender === "male" ? "ذكر" : "أنثى"}
                  </Text>
                  {motherName && (
                    <>
                      <Text style={styles.metadataSeparator}>•</Text>
                      <Text style={styles.metadataText} numberOfLines={1}>
                        👩 {motherName}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* State Badge */}
            {!isEditing && getBadge()}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  style={[styles.iconButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                >
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    setIsEditing(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="pencil" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, styles.deleteButton]}
                  onPress={handleDelete}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </Animated.View>

      {/* iOS-Native Bottom Sheet for Mother Selection */}
      <Modal
        visible={motherSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMotherSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMotherSheetVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>اختيار الأم</Text>
              <Text style={styles.sheetSubtitle}>
                اختر الأم من القائمة أدناه
              </Text>
            </View>

            {/* Current Selection Indicator */}
            {localMotherId && (
              <View style={styles.currentSelectionBanner}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                <Text style={styles.currentSelectionText}>
                  الأم الحالية: {getLocalMotherName()}
                </Text>
              </View>
            )}

            {/* Mother List */}
            <ScrollView
              style={styles.sheetScrollView}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {mothers.map((mother, index) => {
                const isSelected = localMotherId === mother.id;
                return (
                  <TouchableOpacity
                    key={mother.id}
                    style={[
                      styles.sheetOption,
                      index === 0 && styles.sheetOptionFirst,
                      index === mothers.length - 1 && styles.sheetOptionLast,
                    ]}
                    onPress={() => handleMotherSelect(mother.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sheetOptionContent}>
                      <Text style={styles.sheetOptionText}>{mother.name}</Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={22}
                          color={COLORS.primary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Clear Selection Button (iOS destructive style) */}
            {localMotherId && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearMother}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.primary} />
                <Text style={styles.clearButtonText}>إلغاء التحديد</Text>
              </TouchableOpacity>
            )}

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setMotherSheetVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>إغلاق</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: tokens.spacing.md, // 16px
    marginVertical: tokens.spacing.xxs, // 4px gap between cards
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingVertical: 6, // Reduced from 8px
    paddingHorizontal: 10, // Reduced from 12px
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.container + "30",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardNew: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + "05",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  cardEdited: {
    backgroundColor: COLORS.accent + "03", // Subtle 3% tint only
  },
  reorderControls: {
    flexDirection: "row", // Horizontal iOS layout
    alignItems: "center",
    gap: 4, // Reduced from 6px
    marginRight: 6, // Reduced from 8px
    minWidth: 88, // Fixed width: badge (28) + 2 arrows (28+28) + gaps (4*2) = 88px
  },
  arrowSlot: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.container + "30",
    justifyContent: "center",
    alignItems: "center",
  },
  orderText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  viewContainer: {
    flex: 1,
    justifyContent: "center",
  },
  childName: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2, // Minimal gap (was 4px)
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // Reduced from 8px
  },
  metadataText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  metadataSeparator: {
    fontSize: 13,
    color: COLORS.textMuted,
    opacity: 0.5,
  },
  editContainer: {
    flex: 1,
    gap: 8, // iOS-standard spacing between name input and gender/mother row
  },
  nameInputInline: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    backgroundColor: COLORS.container + "15",
    borderRadius: 8,
    paddingHorizontal: tokens.spacing.sm, // 12px
    paddingVertical: tokens.spacing.xs, // 8px
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    textAlign: "left", // Native RTL mode flips this automatically
  },
  // Gender + Mother Row
  editRow: {
    flexDirection: "row",
    gap: 8, // Space between gender control and mother button
    alignItems: "center",
  },
  // iOS-style Segmented Control (compact with icons)
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: COLORS.container + "20",
    borderRadius: 8,
    padding: 2,
    height: 36,
    flex: 1, // Take available space
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    gap: 4, // Space between icon and text
  },
  segmentButtonActive: {
    backgroundColor: COLORS.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  segmentTextActive: {
    color: COLORS.primary,
  },
  // Mother Button (iOS tappable row style)
  motherButton: {
    backgroundColor: COLORS.container + "15",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    flex: 1.2, // Slightly wider than gender control
  },
  motherButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  motherButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
    flex: 1,
  },
  motherButtonTextActive: {
    color: COLORS.text,
    fontWeight: "600",
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: tokens.spacing.xs, // 8px
  },
  stateBadgeNew: {
    backgroundColor: COLORS.secondary + "15",
  },
  stateBadgeEdited: {
    backgroundColor: "#FF950015",
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  actions: {
    flexDirection: "row",
    gap: 4, // Reduced from 8px
    marginLeft: 6, // Reduced from 8px
  },
  iconButton: {
    width: 44, // iOS minimum touch target
    height: 44, // iOS minimum touch target
    borderRadius: 8,
    backgroundColor: COLORS.container + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: COLORS.primary + "15",
  },
  cancelButton: {
    backgroundColor: COLORS.container + "15",
  },
  deleteButton: {
    backgroundColor: COLORS.primary + "10",
  },

  // iOS Bottom Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // iOS standard overlay
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // iOS safe area bottom
    maxHeight: "70%", // Don't cover entire screen
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: COLORS.container,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.container + "30",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  currentSelectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary + "10",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    gap: 8,
  },
  currentSelectionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  sheetScrollView: {
    maxHeight: 320, // Max 7 items visible at 44px each
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sheetOption: {
    backgroundColor: COLORS.container + "15",
    minHeight: 52, // Generous touch target
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.container + "30",
  },
  sheetOptionFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  sheetOptionLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  sheetOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetOptionText: {
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary + "10",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  clearButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: COLORS.container + "20",
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
});

export default ChildListCard;
