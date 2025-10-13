import React, { useEffect, useMemo, useRef, useState } from "react";
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
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };
const statusLabels = {
  male: "ذكر",
  female: "أنثى",
};

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
  const [localMotherId, setLocalMotherId] = useState(child.mother_id || null);
  const [motherSheetVisible, setMotherSheetVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(child.isNew ? 0 : 1)).current;

  useEffect(() => {
    if (child.isNew) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  useEffect(() => {
    setLocalName(child.name);
    setLocalGender(child.gender);
    setLocalMotherId(child.mother_id || null);
  }, [child]);

  const motherName = useMemo(() => {
    if (localMotherId) {
      const match = mothers.find(
        (m) => m.id === localMotherId || m.wife_id === localMotherId || m.wifeId === localMotherId
      );
      return match?.name || match?.display_name || child.mother_name || null;
    }
    return child.mother_name || null;
  }, [localMotherId, mothers, child.mother_name]);

  const handleSave = () => {
    const trimmedName = localName.trim();

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCancel = () => {
    setLocalName(child.name);
    setLocalGender(child.gender);
    setLocalMotherId(child.mother_id || null);
    setIsEditing(false);
    Haptics.selectionAsync();
  };

  const handleDeletePress = () => {
    if (child.isNew) {
      onDelete(child);
      return;
    }

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
  };

  const badgeText = child.isNew ? "جديد" : child.isEdited ? "معدل" : null;
  const genderLabel = statusLabels[child.gender] || "غير محدد";

  const genderOptions = useMemo(
    () => [
      { value: "male", label: "ذكر" },
      { value: "female", label: "أنثى" },
    ],
    []
  );

  return (
    <Animated.View style={[styles.row, { opacity: fadeAnim }]}> 
      {totalChildren > 1 && (
        <View
          style={styles.reorderColumn}
          accessibilityRole="adjustable"
          accessibilityLabel={`${child.name}: الترتيب ${index + 1}`}
        >
          <TouchableOpacity
            style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
            disabled={index === 0}
            onPress={() => {
              onMoveUp(child.id);
              Haptics.selectionAsync();
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={`رفع ${child.name}`}
            accessibilityHint="تحريك الطفل لأعلى"
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={index === 0 ? COLORS.textMuted : COLORS.primary}
            />
          </TouchableOpacity>
          <View style={styles.positionPill}>
            <Text style={styles.positionText}>{index + 1}</Text>
          </View>
          <TouchableOpacity
            style={[styles.reorderButton, index === totalChildren - 1 && styles.reorderButtonDisabled]}
            disabled={index === totalChildren - 1}
            onPress={() => {
              onMoveDown(child.id);
              Haptics.selectionAsync();
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={`إنزال ${child.name}`}
            accessibilityHint="تحريك الطفل لأسفل"
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={index === totalChildren - 1 ? COLORS.textMuted : COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, !isEditing && styles.cardElevated, badgeText === "جديد" ? styles.cardNew : badgeText ? styles.cardEdited : null]}
        onPress={() => {
          if (!isEditing) {
            setIsEditing(true);
            Haptics.selectionAsync();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`تعديل ${child.name}`}
      >
        <View style={styles.viewBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.nameText, isEditing && styles.nameTextEditing]} numberOfLines={1}>
              {isEditing ? localName : child.name}
            </Text>
            {badgeText && !isEditing && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </View>

          {isEditing ? (
            <TextInput
              value={localName}
              onChangeText={setLocalName}
              style={styles.editInput}
              placeholder="اسم الطفل"
              placeholderTextColor={COLORS.textMuted + "99"}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              maxLength={100}
            />
          ) : null}

          <View style={styles.metadataRow}>
            {isEditing ? (
              <View style={styles.segmentedRow}>
                {genderOptions.map((option) => {
                  const active = option.value === localGender;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      onPress={() => {
                        setLocalGender(option.value);
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
            ) : (
              <Text style={styles.metadataText}>{genderLabel}</Text>
            )}

            {mothers.length > 0 && (
              isEditing ? (
                <TouchableOpacity
                  style={styles.motherSelector}
                  onPress={() => {
                    setMotherSheetVisible(true);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name="person"
                    size={16}
                    color={motherName ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text
                    style={[styles.motherSelectorText, motherName && styles.motherSelectorTextActive]}
                    numberOfLines={1}
                  >
                    {motherName || "غير محدد"}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : motherName ? (
                <View style={styles.metadataMother}>
                  <Ionicons name="person" size={12} color={COLORS.textMuted} />
                  <Text style={styles.metadataText} numberOfLines={1}>
                    {motherName}
                  </Text>
                </View>
              ) : null
            )}
          </View>
        </View>
        <View style={styles.actionColumn}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.iconButton, styles.saveButton]}
                onPress={handleSave}
                accessibilityLabel="حفظ التعديلات"
                hitSlop={HIT_SLOP}
              >
                <Ionicons name="checkmark" size={18} color={COLORS.background} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleCancel}
                accessibilityLabel="إلغاء"
                hitSlop={HIT_SLOP}
              >
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleDeletePress}
              accessibilityLabel={`حذف ${child.name}`}
              hitSlop={HIT_SLOP}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={motherSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMotherSheetVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMotherSheetVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>اختيار الأم</Text>
              <Text style={styles.sheetSubtitle}>اختر الأم من القائمة أدناه</Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {mothers.map((mother, idx) => {
                const id = mother.id || mother.wife_id || mother.wifeId;
                const selected = id === localMotherId;
                return (
                  <TouchableOpacity
                    key={id || `mother-${idx}`}
                    style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                    onPress={() => {
                      setLocalMotherId(id);
                      setMotherSheetVisible(false);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}
                      numberOfLines={1}
                    >
                      {mother.name || mother.display_name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetClear}
                onPress={() => {
                  setLocalMotherId(null);
                  setMotherSheetVisible(false);
                  Haptics.selectionAsync();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.sheetClearText}>إلغاء التحديد</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={() => setMotherSheetVisible(false)}
                accessibilityRole="button"
              >
                <Text style={styles.sheetCancelText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    gap: tokens.spacing.xxs,
  },
  reorderColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reorderButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.container + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  positionPill: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: COLORS.container + "1F",
    alignItems: "center",
  },
  positionText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
  },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    ...tokens.shadow.ios,
  },
  cardElevated: {
    borderColor: COLORS.container + "26",
  },
  cardNew: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + "10",
  },
  cardEdited: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "10",
  },
  viewBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "600",
    color: COLORS.text,
  },
  badge: {
    backgroundColor: COLORS.secondary + "18",
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metadataText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.textMuted,
  },
  metadataMother: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionColumn: {
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 6,
    marginLeft: tokens.spacing.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.container + "14",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  editBlock: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  editInput: {
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "40",
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
  },
  editControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  segmentedRow: {
    flexDirection: "row",
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    overflow: "hidden",
  },
  segmentButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    color: COLORS.text,
  },
  segmentTextActive: {
    color: COLORS.background,
  },
  motherSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 8,
  },
  motherSelectorText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.textMuted,
    maxWidth: 120,
  },
  motherSelectorTextActive: {
    color: COLORS.text,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.container + "33",
    alignSelf: "center",
    marginVertical: 12,
  },
  sheetHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
    gap: 4,
  },
  sheetTitle: {
    fontSize: tokens.typography.title3.fontSize,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  sheetContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xs,
    gap: tokens.spacing.xs,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.xs,
    gap: tokens.spacing.xs,
    minHeight: 52,
  },
  sheetOptionSelected: {
    backgroundColor: COLORS.container + "14",
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.sm,
  },
  sheetOptionText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
    marginRight: tokens.spacing.sm,
  },
  sheetOptionTextActive: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.container + "2A",
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sheetClear: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.primary,
  },
  sheetClearText: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.primary,
    fontWeight: "600",
  },
  sheetCancel: {
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: COLORS.container + "12",
    alignItems: "center",
  },
  sheetCancelText: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.text,
    fontWeight: "600",
  },
});

export default ChildListCard;
