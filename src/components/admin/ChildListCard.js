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
import PositionPicker from "./PositionPicker";

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
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [isPickerOpening, setIsPickerOpening] = useState(false);
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

  const handlePositionSelect = (newPosition) => {
    // Use batch move function to avoid race conditions
    onMoveToPosition(child.id, newPosition);
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
          {/* Reorder Controls - only show if more than 1 child */}
          {totalChildren > 1 && (
            <View style={styles.reorderControls}>
              {/* Up Arrow */}
              <TouchableOpacity
                style={[
                  styles.arrowButton,
                  (index === 0 || isMoving) && styles.arrowButtonDisabled
                ]}
                onPress={() => handleArrowPress('up')}
                disabled={index === 0 || isMoving}
              >
                <Ionicons
                  name="chevron-up"
                  size={16}
                  color={index === 0 ? COLORS.textMuted : COLORS.text}
                />
              </TouchableOpacity>

              {/* Position Badge - tap for full picker */}
              <TouchableOpacity
                style={styles.positionBadge}
                onPress={() => {
                  if (isPickerOpening) return;
                  setIsPickerOpening(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPositionPicker(true);
                }}
                disabled={isPickerOpening}
              >
                <Text style={styles.orderText}>{index + 1}</Text>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={12}
                  color={COLORS.textMuted}
                  style={styles.moreIcon}
                />
              </TouchableOpacity>

              {/* Down Arrow */}
              <TouchableOpacity
                style={[
                  styles.arrowButton,
                  (index === totalChildren - 1 || isMoving) && styles.arrowButtonDisabled
                ]}
                onPress={() => handleArrowPress('down')}
                disabled={index === totalChildren - 1 || isMoving}
              >
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={index === totalChildren - 1 ? COLORS.textMuted : COLORS.text}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Card Content */}
          <View style={styles.content}>
            {isEditing ? (
              // Edit Mode
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
                <View style={styles.editControls}>
                  <TouchableOpacity
                    style={[
                      styles.genderToggleMini,
                      localGender === "male" && styles.genderToggleMiniActive,
                    ]}
                    onPress={() => setLocalGender("male")}
                  >
                    <Text
                      style={[
                        styles.genderToggleMiniText,
                        localGender === "male" &&
                          styles.genderToggleMiniTextActive,
                      ]}
                    >
                      ذكر
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderToggleMini,
                      localGender === "female" &&
                        styles.genderToggleMiniActive,
                    ]}
                    onPress={() => setLocalGender("female")}
                  >
                    <Text
                      style={[
                        styles.genderToggleMiniText,
                        localGender === "female" &&
                          styles.genderToggleMiniTextActive,
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

      {/* Position Picker Modal */}
      <PositionPicker
        visible={showPositionPicker}
        currentPosition={index + 1}
        totalPositions={totalChildren}
        onSelect={handlePositionSelect}
        onClose={() => {
          setShowPositionPicker(false);
          setTimeout(() => setIsPickerOpening(false), 300); // Reset after modal animation
        }}
      />
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
    paddingVertical: tokens.spacing.xs, // 8px
    paddingHorizontal: tokens.spacing.sm, // 12px
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
    borderColor: COLORS.accent, // Desert Ochre
    backgroundColor: COLORS.accent + "08",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  reorderControls: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    marginRight: tokens.spacing.xs, // 8px
  },
  arrowButton: {
    width: 32,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.container + "20",
    borderRadius: 6,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.container + "30",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  orderText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  moreIcon: {
    position: "absolute",
    bottom: 2,
    opacity: 0.6,
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
    gap: tokens.spacing.xs, // 8px
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
  editControls: {
    flexDirection: "row",
    gap: tokens.spacing.xs, // 8px
  },
  genderToggleMini: {
    minWidth: 44, // iOS minimum touch target
    height: 44, // iOS minimum touch target
    borderRadius: 8,
    backgroundColor: COLORS.container + "20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    paddingHorizontal: tokens.spacing.xs, // 8px for text
  },
  genderToggleMiniActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderToggleMiniText: {
    fontSize: 13, // iOS footnote
    fontWeight: "600",
    color: COLORS.text,
  },
  genderToggleMiniTextActive: {
    color: COLORS.background,
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
    gap: tokens.spacing.xs, // 8px
    marginLeft: tokens.spacing.xs, // 8px
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
