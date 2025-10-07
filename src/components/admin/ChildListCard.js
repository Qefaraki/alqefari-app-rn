import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
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
    if (child.isEdited) {
      return (
        <View style={[styles.stateBadge, styles.stateBadgeEdited]}>
          <Text style={styles.stateBadgeText}>معدل</Text>
        </View>
      );
    }
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
              // Edit Mode - iOS-style with segmented control
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.nameInputInline}
                  value={localName}
                  onChangeText={setLocalName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveEdit}
                  textAlign="left"
                />
                {/* iOS-style Segmented Control for Gender */}
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      styles.segmentButtonRight,
                      localGender === "male" && styles.segmentButtonActive,
                    ]}
                    onPress={() => setLocalGender("male")}
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
                      styles.segmentButtonLeft,
                      localGender === "female" && styles.segmentButtonActive,
                    ]}
                    onPress={() => setLocalGender("female")}
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
  },
  nameInputInline: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    backgroundColor: COLORS.container + "15",
    borderRadius: 8,
    paddingHorizontal: tokens.spacing.sm, // 12px
    paddingVertical: tokens.spacing.xs, // 8px
    marginBottom: tokens.spacing.xs, // 8px
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    textAlign: "left", // Native RTL mode flips this automatically
  },
  // iOS-style Segmented Control
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: COLORS.container + "20",
    borderRadius: 8,
    padding: 2,
    height: 32,
  },
  segmentButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  segmentButtonLeft: {
    // No additional style needed, flex handles layout
  },
  segmentButtonRight: {
    // No additional style needed, flex handles layout
  },
  segmentButtonActive: {
    backgroundColor: COLORS.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  segmentTextActive: {
    color: COLORS.text,
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
});

export default ChildListCard;
