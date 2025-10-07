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
  mothers = [],
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(child.name);
  const [localGender, setLocalGender] = useState(child.gender);
  const [localMotherId, setLocalMotherId] = useState(child.mother_id);

  // Animation values for entrance only
  const fadeAnim = useRef(new Animated.Value(child.isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(child.isNew ? 20 : 0)).current;

  // Entrance animation for new cards
  useEffect(() => {
    let animation;
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
      if (animation) {
        animation.stop();
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
    if (localName.trim().length < 2) {
      Alert.alert("خطأ", "يرجى إدخال اسم صحيح (حرفين على الأقل)");
      return;
    }

    onUpdate(child.id, {
      name: localName.trim(),
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

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.card, getCardStyle()]}>
        {/* Reorder Buttons */}
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
            onPress={() => onMoveUp(child.id)}
            disabled={index === 0}
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={index === 0 ? COLORS.textMuted + "40" : COLORS.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.reorderButton,
              index === totalChildren - 1 && styles.reorderButtonDisabled,
            ]}
            onPress={() => onMoveDown(child.id)}
            disabled={index === totalChildren - 1}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={
                index === totalChildren - 1 ? COLORS.textMuted + "40" : COLORS.text
              }
            />
          </TouchableOpacity>
        </View>

          {/* Order Badge */}
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>{index + 1}</Text>
          </View>

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
        </View>
      </Animated.View>
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
    borderColor: "#FF9500",
    backgroundColor: "#FF950008",
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
  },
  reorderButtons: {
    flexDirection: "column",
    marginRight: tokens.spacing.xs, // 8px
    gap: 2,
  },
  reorderButton: {
    width: 28,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.container + "20",
    borderRadius: 4,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.container + "30",
    justifyContent: "center",
    alignItems: "center",
    marginRight: tokens.spacing.xs, // 8px
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
