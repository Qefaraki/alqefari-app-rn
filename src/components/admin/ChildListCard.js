import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Image,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Swipeable } from "react-native-gesture-handler";
import tokens from "../ui/tokens";

const COLORS = tokens.colors.najdi;
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };
const DESERT_PALETTE = [
  "#A13333",
  "#D58C4A",
  "#D1BBA3",
  "#A13333CC",
  "#D58C4ACC",
  "#D1BBA3CC",
  "#A1333399",
  "#D58C4A99",
  "#D1BBA399",
  "#A13333",
];

const getPaletteIndex = (key) => {
  if (!key) return 0;
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
};
const ChildListCard = ({
  child,
  index,
  totalChildren,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onJumpToPosition,
  mothers = [],
}) => {
  const [localName, setLocalName] = useState(child.name);
  const [localGender, setLocalGender] = useState(child.gender);
  const [localMotherId, setLocalMotherId] = useState(child.mother_id || null);
  const [motherSheetVisible, setMotherSheetVisible] = useState(false);
  const [nameError, setNameError] = useState(null);

  const fadeAnim = useRef(new Animated.Value(child.isNew ? 0 : 1)).current;
  const swipeableRef = useRef(null);

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
    setNameError(null);
  }, [child]);

  const simplifyName = useCallback((name) => {
    if (!name) return "";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }, []);

  const motherName = useMemo(() => {
    if (localMotherId) {
      const match = mothers.find(
        (m) => m.id === localMotherId || m.wife_id === localMotherId || m.wifeId === localMotherId
      );
      const rawName = match?.name || match?.display_name || child.mother_name || null;
      return rawName ? simplifyName(rawName) : null;
    }
    return child.mother_name ? simplifyName(child.mother_name) : null;
  }, [localMotherId, mothers, child.mother_name, simplifyName]);
  const colorKey = child.id || child.temp_id || child.uuid || child.name || index;
  const avatarColor = useMemo(() => {
    const paletteIndex = getPaletteIndex(colorKey) % DESERT_PALETTE.length;
    return DESERT_PALETTE[paletteIndex];
  }, [colorKey]);
  const photoUrl =
    child.photo_url ||
    child.avatar_url ||
    child.photoUrl ||
    child.profile_photo_url ||
    null;
  const initials = useMemo(() => {
    if (!child.name) return "؟";
    const trimmed = child.name.trim();
    return trimmed.length > 0 ? trimmed[0] : "؟";
  }, [child.name]);

  const commitUpdate = useCallback((overrides = {}) => {
    const nextNameRaw = overrides.name !== undefined ? overrides.name : localName;
    const nextGender = overrides.gender ?? localGender;
    const nextMotherId = overrides.mother_id ?? localMotherId;
    const trimmedNextName = nextNameRaw.trim();

    if (trimmedNextName.length < 2) {
      setNameError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (trimmedNextName.length > 100) {
      setNameError("الاسم يجب ألا يتجاوز 100 حرف");
      return;
    }

    const originalMotherId = child.mother_id ?? null;
    const normalizedNextMotherId = nextMotherId ?? null;

    const noChanges =
      trimmedNextName === (child.name || "").trim() &&
      nextGender === (child.gender || "male") &&
      normalizedNextMotherId === originalMotherId;

    if (noChanges) {
      return;
    }

    setNameError(null);
    const rawMotherName =
      overrides.mother_id !== undefined
        ? (() => {
            const match = mothers.find(
              (m) =>
                m.id === overrides.mother_id ||
                m.wife_id === overrides.mother_id ||
                m.wifeId === overrides.mother_id,
            );
            if (!match) return "";
            return match.name || match.display_name || "";
          })()
        : child.mother_name || "";
    const simplifiedMotherName = simplifyName(rawMotherName);

    onUpdate(child.id, {
      name: trimmedNextName,
      gender: nextGender,
      mother_id: normalizedNextMotherId,
      mother_name: simplifiedMotherName || null,
    });
    setLocalName(trimmedNextName);
  }, [child.id, child.name, child.gender, child.mother_id, localName, localGender, localMotherId, onUpdate, mothers, simplifyName]);

  const handleDeletePress = useCallback(() => {
    if (child.isNew) {
      swipeableRef.current?.close();
      onDelete(child);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    Alert.alert(
      "حذف الطفل",
      `هل تريد حذف ${child.name}؟`,
      [
        {
          text: "إلغاء",
          style: "cancel",
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            swipeableRef.current?.close();
            onDelete(child);
          },
        },
      ],
      { cancelable: true }
    );
  }, [child, onDelete]);

  const renderLeftActions = useCallback(
    () => (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={styles.swipeDeleteAction}
          onPress={handleDeletePress}
          accessibilityLabel={`حذف ${child.name}`}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={22} color="#F9F7F3" />
        </TouchableOpacity>
      </View>
    ),
    [handleDeletePress, child.name],
  );

  const badgeText = child.isNew ? "جديد" : child.isEdited ? "معدل" : null;

  const genderOptions = useMemo(
    () => [
      { value: "male", label: "ذكر" },
      { value: "female", label: "أنثى" },
    ],
    []
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      enableTrackpadTwoFingerGesture
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      leftThreshold={40}
      onSwipeableOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleDeletePress();
      }}
    >
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
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onJumpToPosition?.(child.id, index, totalChildren);
            }}
            accessibilityLabel={`رفع ${child.name}`}
            accessibilityHint="تحريك الطفل لأعلى، اضغط مطولاً للقفز"
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={index === 0 ? COLORS.textMuted : COLORS.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reorderButton, index === totalChildren - 1 && styles.reorderButtonDisabled]}
            disabled={index === totalChildren - 1}
            onPress={() => {
              onMoveDown(child.id);
              Haptics.selectionAsync();
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onJumpToPosition?.(child.id, index, totalChildren);
            }}
            accessibilityLabel={`إنزال ${child.name}`}
            accessibilityHint="تحريك الطفل لأسفل، اضغط مطولاً للقفز"
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={index === totalChildren - 1 ? COLORS.textMuted : COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.card,
          styles.cardElevated,
          badgeText === "جديد" ? styles.cardNew : badgeText ? styles.cardEdited : null,
          nameError && styles.cardError,
        ]}
        accessibilityLabel={`تعديل ${child.name}`}
      >
        {/* index now handled inside reorder column */}
        <View style={styles.viewBlock}>
          <View style={styles.detailRow}>
            <View style={styles.detailsColumn}>
              <View style={styles.titleRow}>
                <View style={styles.titleInputWrapper}>
                  <TextInput
                    value={localName}
                    onChangeText={(text) => {
                      setLocalName(text);
                      if (nameError) {
                        const trimmed = text.trim();
                        if (trimmed.length >= 2 && trimmed.length <= 100) {
                          setNameError(null);
                        }
                      }
                    }}
                    style={[styles.editInputInline, nameError && styles.editInputInlineError]}
                    placeholder="اسم الطفل"
                    placeholderTextColor={COLORS.textMuted + "99"}
                    returnKeyType="done"
                    onSubmitEditing={() => commitUpdate()}
                    onBlur={() => commitUpdate()}
                    maxLength={100}
                  />
                  {nameError ? <Text style={styles.inputErrorText}>{nameError}</Text> : null}
                </View>
                {badgeText && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeText}</Text>
                  </View>
                )}
              </View>

              <View style={styles.metadataRow}>
                <View style={styles.segmentedHolderEditing}>
                  {genderOptions.map((option) => {
                    const active = option.value === localGender;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                        onPress={() => {
                          if (option.value === localGender) return;
                          const nextGender = option.value;
                          setLocalGender(nextGender);
                          Haptics.selectionAsync();
                          commitUpdate({ gender: nextGender });
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

                {mothers.length > 0 && (
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
                )}
              </View>
            </View>
          </View>
        </View>
        <View style={styles.trailingColumn}>
          <View style={styles.avatarWrapper}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleDeletePress}
            accessibilityLabel={`حذف ${child.name}`}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.cardIndex,
            I18nManager.isRTL ? styles.cardIndexRTL : styles.cardIndexLTR,
          ]}
        >
          <Text style={styles.cardIndexText}>{index + 1}</Text>
        </View>
      </View>

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
                      commitUpdate({ mother_id: id });
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
                  commitUpdate({ mother_id: null });
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
    </Swipeable>
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
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  reorderButton: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.md,
    backgroundColor: COLORS.container + "16",
    justifyContent: "center",
    alignItems: "center",
  },
  reorderButtonDisabled: {
    opacity: 0.35,
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
    position: "relative",
    overflow: "hidden",
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
  cardError: {
    borderColor: tokens.colors.danger,
    backgroundColor: tokens.colors.danger + "10",
  },
  viewBlock: {
    flex: 1,
    paddingVertical: tokens.spacing.xxs,
  },
  detailRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  detailsColumn: {
    flex: 1,
    gap: tokens.spacing.xs,
    paddingRight: tokens.spacing.lg,
  },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  avatarWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    resizeMode: "cover",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.container + "33",
  },
  avatarInitials: {
    color: "#F9F7F3",
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: "600",
  },
  titleInputWrapper: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  editInputInline: {
    flex: 1,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    backgroundColor: COLORS.background,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    minHeight: 38,
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
    textAlign: "right",
    textAlignVertical: "center",
  },
  editInputInlineError: {
    borderColor: tokens.colors.danger,
    backgroundColor: tokens.colors.danger + "12",
  },
  inputErrorText: {
    fontSize: tokens.typography.caption2.fontSize,
    color: tokens.colors.danger,
    textAlign: "right",
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
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xxs,
    paddingLeft: 20,
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
  trailingColumn: {
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginLeft: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.container + "18",
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
  segmentedHolderEditing: {
    flexDirection: "row",
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    overflow: "hidden",
    backgroundColor: COLORS.background,
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
  swipeActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: tokens.spacing.md,
  },
  swipeDeleteAction: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    minHeight: 44,
  },
  cardIndex: {
    position: "absolute",
    bottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    backgroundColor: COLORS.background + "E6",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
  },
  cardIndexRTL: {
    left: tokens.spacing.xs,
  },
  cardIndexLTR: {
    right: tokens.spacing.xs,
  },
  cardIndexText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "700",
    color: COLORS.text,
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

export default React.memo(ChildListCard);
