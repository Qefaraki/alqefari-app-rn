import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  SectionList,
  TextInput,
  RefreshControl,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  I18nManager,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ar } from "date-fns/locale";
import tokens from "../../components/ui/tokens";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import InlineDiff from "../../components/ui/InlineDiff";
import { getFieldLabel } from "../../services/activityLogTranslations";
import { formatRelativeTime, formatAbsoluteTime } from "../../utils/formatTimestamp";
import UserFilterModal from "../../components/admin/UserFilterModal";
import DateRangePickerModal from "../../components/admin/DateRangePickerModal";
import { useAuth } from "../../contexts/AuthContext";
import undoService from "../../services/undoService";
import { useUndoStore } from "../../stores/undoStore";
import { useTreeStore } from "../../stores/useTreeStore";
import Toast from "../../components/ui/Toast";
import BatchOperationCard from "../../components/admin/BatchOperationCard";

const colors = {
  ...tokens.colors.najdi,
  textMuted: tokens.colors.najdi.textMuted,
  white: "#FFFFFF",
};

const isRTL = I18nManager.isRTL;

const TREE_ACTION_TYPES = [
  "profile_create",
  "profile_update",
  "profile_soft_delete",
  "create_node",
  "update_node",
  "delete_node",
  "merge_nodes",
];

const MARRIAGE_ACTION_TYPES = [
  "add_marriage",
  "update_marriage",
  "delete_marriage",
];

const PHOTO_ACTION_TYPES = [
  "upload_photo",
  "update_photo",
  "delete_photo",
];

const ADMIN_ACTION_TYPES = [
  "grant_admin",
  "revoke_admin",
  "update_settings",
];

const ACTION_CONFIGS = {
  create_node: { label: "إضافة" },
  update_node: { label: "تحديث" },
  delete_node: { label: "حذف" },
  merge_nodes: { label: "دمج" },
  add_marriage: { label: "إضافة زواج" },
  update_marriage: { label: "تحديث زواج" },
  delete_marriage: { label: "حذف زواج" },
  upload_photo: { label: "رفع صورة" },
  update_photo: { label: "تحديث صورة" },
  delete_photo: { label: "حذف صورة" },
  grant_admin: { label: "منح صلاحيات" },
  revoke_admin: { label: "سحب صلاحيات" },
  update_settings: { label: "تحديث إعدادات" },
  default: { label: "إجراء" },
};

const ACTION_VISUALS = {
  create_node: { icon: "leaf", fallback: "leaf-outline", color: tokens.colors.najdi.primary + "14", accent: tokens.colors.najdi.primary },
  update_node: { icon: "square.and.pencil", fallback: "create-outline", color: tokens.colors.najdi.focus + "18", accent: tokens.colors.najdi.focus },
  delete_node: { icon: "trash", fallback: "trash-outline", color: tokens.colors.najdi.primary + "18", accent: tokens.colors.najdi.primary },
  merge_nodes: { icon: "point.topleft.down.curvedto.point.bottomright.up", fallback: "git-merge-outline", color: tokens.colors.najdi.secondary + "18", accent: tokens.colors.najdi.secondary },
  add_marriage: { icon: "heart.circle", fallback: "heart", color: tokens.colors.najdi.secondary + "18", accent: tokens.colors.najdi.secondary },
  update_marriage: { icon: "heart.text.square", fallback: "heart-circle-outline", color: tokens.colors.najdi.secondary + "16", accent: tokens.colors.najdi.secondary },
  delete_marriage: { icon: "heart.slash", fallback: "heart-dislike-outline", color: tokens.colors.najdi.primary + "18", accent: tokens.colors.najdi.primary },
  upload_photo: { icon: "photo.on.rectangle.angled", fallback: "image-outline", color: tokens.colors.najdi.focus + "18", accent: tokens.colors.najdi.focus },
  update_photo: { icon: "photo.fill.on.rectangle.fill", fallback: "images-outline", color: tokens.colors.najdi.focus + "16", accent: tokens.colors.najdi.focus },
  delete_photo: { icon: "trash.slash", fallback: "trash-bin-outline", color: tokens.colors.najdi.primary + "16", accent: tokens.colors.najdi.primary },
  grant_admin: { icon: "shield.checkerboard", fallback: "shield-checkmark-outline", color: tokens.colors.najdi.primary + "16", accent: tokens.colors.najdi.primary },
  revoke_admin: { icon: "shield.slash", fallback: "shield-outline", color: tokens.colors.najdi.primary + "18", accent: tokens.colors.najdi.primary },
  update_settings: { icon: "gearshape", fallback: "settings-outline", color: tokens.colors.najdi.container + "26", accent: tokens.colors.najdi.text },
  default: { icon: "doc.text", fallback: "document-text-outline", color: tokens.colors.najdi.container + "24", accent: tokens.colors.najdi.text },
};

const getActionVisuals = (actionType) => ACTION_VISUALS[actionType] || ACTION_VISUALS.default;

const CATEGORY_OPTIONS = [
  { key: "all", label: "الجميع", icon: "square.grid.2x2", fallback: "grid-outline" },
  { key: "tree", label: "الشجرة", icon: "person.3.sequence", fallback: "git-branch" },
  { key: "marriages", label: "الأزواج", icon: "heart.circle", fallback: "heart" },
  { key: "photos", label: "الصور", icon: "photo.on.rectangle", fallback: "image" },
  { key: "admin", label: "الإدارة", icon: "shield.lefthalf.fill", fallback: "shield" },
];

const SEVERITY_OPTIONS = [
  { key: "all", label: "كل المستويات", icon: "line.3.horizontal", fallback: "options" },
  { key: "high", label: "عالي", icon: "exclamationmark.triangle", fallback: "warning" },
  { key: "critical", label: "حرج", icon: "exclamationmark.octagon", fallback: "alert" },
];

const SEVERITY_BADGES = {
  high: { label: "عالي", color: "#D58C4A", text: "#F9F7F3" },
  critical: { label: "حرج", color: tokens.colors.najdi.crimson, text: "#F9F7F3" },
};

const METADATA_FIELDS = new Set([
  "version",
  "updated_at",
  "created_at",
  "request_id",
  "time_since_previous",
  "updated_by",
  "updated_by_id",
  "updated_by_profile_id",
]);

const formatSimpleValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    const preview = value.slice(0, 3).map((item) => String(item)).join("، " );
    return value.length > 3 ? `${preview}…` : preview;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value || {});
    if (!keys.length) return "—";
    const preview = keys.slice(0, 3).map((key) => getFieldLabel(key) || key).join("، " );
    return keys.length > 3 ? `${preview}…` : preview;
  }
  if (typeof value === "string" && value.length > 80) return `${value.substring(0, 80)}…`;
  return String(value);
};

const formatDetailedValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

const getSeverityBadge = (severity) => {
  const key = severity?.toLowerCase?.();
  return key && SEVERITY_BADGES[key] ? SEVERITY_BADGES[key] : null;
};

const getShortName = (name) => {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return parts[0];
};

const SFIcon = ({ name, fallback, rtlFallback, size = 20, color, weight = "regular", style }) => {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        weight={weight}
        scale="medium"
        tintColor={color}
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  const iconName = I18nManager.isRTL && rtlFallback ? rtlFallback : fallback;
  return <Ionicons name={iconName} size={size} color={color} style={style} />;
};

const getMeaningfulFields = (fields = []) => fields.filter((field) => !METADATA_FIELDS.has(field));

const getPrimaryField = (activity) => {
  const changed = activity.changed_fields || [];
  if (!changed.length) return null;
  const meaningful = getMeaningfulFields(changed);
  return meaningful[0] || changed[0];
};

const buildActivitySummary = (activity) => {
  const actorShort = getShortName(activity.actor_name_current || activity.actor_name_historical) || "مستخدم";
  const targetShort = getShortName(activity.target_name_current || activity.target_name_historical) || "الملف";
  const actionConfig = ACTION_CONFIGS[activity.action_type] || ACTION_CONFIGS.default;
  const meaningfulFields = getMeaningfulFields(activity.changed_fields || []);

  if (meaningfulFields.length === 1) {
    const fieldLabel = getFieldLabel(meaningfulFields[0]);
    return `${actorShort} عدّل ${fieldLabel} لـ ${targetShort}`;
  }

  if (meaningfulFields.length > 1) {
    const labels = meaningfulFields.slice(0, 2).map((field) => getFieldLabel(field));
    const labelText = labels.join('، ');
    const suffix = meaningfulFields.length > 2 ? ' وغيرها' : '';
    return `${actorShort} حدّث ${labelText}${suffix} لـ ${targetShort}`;
  }

  return `${actorShort} ${actionConfig.label} ${targetShort}`;
};

const isNameChainEquivalent = (historical, current) => {
  const h = historical?.trim();
  const c = current?.trim();

  if (!h || !c) return false;
  if (h === c) return true;

  const stripSuffix = (str) => str.replace(/ القفاري$/, "").trim();
  const hClean = stripSuffix(h);
  const cClean = stripSuffix(c);

  const splitChain = (str) => {
    if (str.includes(" بن ")) {
      return str.split(" بن ").map((p) => p.trim());
    }
    return str.split(/\s+/).filter((p) => p.length > 0);
  };

  const hParts = splitChain(hClean);
  const cParts = splitChain(cClean);
  const minLength = Math.min(hParts.length, cParts.length);

  for (let i = 0; i < minLength; i += 1) {
    if (hParts[i] !== cParts[i]) {
      return false;
    }
  }

  return true;
};

const SmartNameDisplay = React.memo(
  ({
    historicalName,
    currentName,
    profileId,
    onNavigate,
    style,
    historicalStyle,
    currentStyle,
  }) => {
    const normalizedHistorical = historicalName?.trim() || null;
    const normalizedCurrent = currentName?.trim() || null;

    const namesAreDifferent =
      normalizedHistorical &&
      normalizedCurrent &&
      !isNameChainEquivalent(normalizedHistorical, normalizedCurrent);

    const handlePress = useCallback(
      (e) => {
        if (!onNavigate || !profileId) return;
        if (e && typeof e.stopPropagation === "function") {
          e.stopPropagation();
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onNavigate(profileId);
      },
      [onNavigate, profileId]
    );

    if (!normalizedHistorical && !normalizedCurrent) {
      return <Text style={style}>مستخدم</Text>;
    }

    if (!namesAreDifferent) {
      const displayName = normalizedHistorical || normalizedCurrent;
      return (
        <TouchableOpacity
          onPress={handlePress}
          disabled={!onNavigate || !profileId}
          activeOpacity={0.7}
          style={styles.nameRow}
        >
          <SFIcon name="person.circle" fallback="person-circle-outline" size={14} color="#736372" />
          <Text style={[style, historicalStyle]}>{displayName}</Text>
          {onNavigate && profileId && (
            <SFIcon name="chevron.forward" fallback="chevron-forward" rtlFallback="chevron-back" size={12} color="#736372" />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={!onNavigate || !profileId}
        activeOpacity={0.7}
      >
        <View style={{ gap: 4 }}>
          <View style={styles.nameRow}>
            <SFIcon name="person.circle" fallback="person-circle-outline" size={14} color="#73637280" />
            <Text style={[style, historicalStyle]}>{normalizedHistorical}</Text>
          </View>
          <View style={[styles.nameRow, { marginRight: 16 }]}>
            <View style={styles.nowBadge}>
              <Text style={styles.nowBadgeText}>الآن</Text>
            </View>
            <Text style={[style, currentStyle, { color: "#242121" }]}>{normalizedCurrent}</Text>
            {onNavigate && profileId && (
              <SFIcon name="chevron.forward" fallback="chevron-forward" rtlFallback="chevron-back" size={12} color="#736372" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

const getDatePresetLabel = (preset) => {
  switch (preset) {
    case "today":
      return "اليوم";
    case "week":
      return "هذا الأسبوع";
    case "month":
      return "هذا الشهر";
    case "custom":
      return "نطاق مخصص";
    default:
      return "كل الأوقات";
  }
};

const StatusHeader = ({ latestTimestamp, onClose }) => (
  <View style={styles.statusHeader}>
    <View style={styles.headerRow}>
      <Image
        source={require("../../../assets/logo/AlqefariEmblem.png")}
        style={styles.emblem}
        resizeMode="contain"
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.screenTitle}>سجل النشاط</Text>
        {latestTimestamp && (
          <Text style={styles.screenSubtitle}>
            {`آخر تحديث ${formatRelativeTime(latestTimestamp)}`}
          </Text>
        )}
      </View>
      {onClose && (
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <SFIcon
            name="chevron.forward"
            fallback="chevron-forward"
            rtlFallback="chevron-back"
            size={22}
            color={tokens.colors.najdi.text}
          />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const ControlsRow = ({ onOpenFilters, activeFiltersCount, searchText, onSearchChange, searchInputRef }) => {
  const hasFilters = activeFiltersCount > 0;
  const handleClear = () => {
    if (searchInputRef?.current) {
      searchInputRef.current.blur();
    }
    onSearchChange("");
  };

  return (
    <View style={styles.controlsRow}>
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <SFIcon name="magnifyingglass" fallback="search" size={18} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="بحث سريع"
            placeholderTextColor={colors.textMuted + "99"}
            value={searchText}
            onChangeText={onSearchChange}
            returnKeyType="search"
            textAlign="right"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <SFIcon name="xmark.circle.fill" fallback="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.filterFab, hasFilters && styles.filterFabActive]}
        onPress={onOpenFilters}
        activeOpacity={0.75}
        accessibilityLabel="تصفية السجل"
      >
        <SFIcon
          name="line.3.horizontal.decrease.circle"
          fallback="options-outline"
          size={18}
          color={hasFilters ? colors.white : colors.text}
        />
        {hasFilters && <View style={styles.filterFabBadge} />}
      </TouchableOpacity>
    </View>
  );
};

const CATEGORY_SEGMENTS = [
  { key: "all", label: "كل الأنشطة" },
  { key: "tree", label: "الشجرة" },
  { key: "marriages", label: "الزواج" },
  { key: "photos", label: "الصور" },
  { key: "admin", label: "الإدارة" },
];

const SEVERITY_SEGMENTS = [
  { key: "all", label: "كل المستويات" },
  { key: "high", label: "عالي" },
  { key: "critical", label: "حرج" },
];

const InlineFilters = ({
  category,
  severity,
  onCategoryChange,
  onSeverityChange,
}) => {
  const handleSelectCategory = (value) => {
    if (value === category) return;
    Haptics.selectionAsync();
    onCategoryChange(value);
  };

  const handleSelectSeverity = (value) => {
    if (value === severity) return;
    Haptics.selectionAsync();
    onSeverityChange(value);
  };

  return (
    <View style={styles.inlineFiltersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedScrollContent}
      >
        {CATEGORY_SEGMENTS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterChip,
              category === option.key && styles.filterChipActive,
            ]}
            onPress={() => handleSelectCategory(option.key)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                category === option.key && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.segmentedControl}>
        {SEVERITY_SEGMENTS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.segmentButton,
              severity === option.key && styles.segmentButtonActive,
            ]}
            onPress={() => handleSelectSeverity(option.key)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                severity === option.key && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const FiltersSheet = React.forwardRef((
  {
    visible,
    onClose,
    categoryFilter,
    severityFilter,
    datePreset,
    onSelectCategory,
    onSelectSeverity,
    onOpenDate,
    onOpenUser,
    selectedUser,
    onClear,
    renderBackdrop,
    renderHandle,
    snapPoints,
  },
  ref,
) => {
  useEffect(() => {
    if (visible) {
      ref?.current?.snapToIndex(0);
    } else {
      ref?.current?.close();
    }
  }, [visible, ref]);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBackground}
      handleComponent={renderHandle}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.filtersSheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filtersSheetHeader}>
          <Text style={styles.filtersSheetTitle}>المصفيات</Text>
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={styles.filtersSheetReset}>إعادة الضبط</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersSheetIntro}>
          <Text style={styles.filtersSheetIntroText}>اضبط ما يظهر في الخط الزمني الآن.</Text>
        </View>

        <View style={styles.filtersSheetSection}>
          <Text style={styles.filtersSheetLabel}>نوع النشاط</Text>
          <View style={styles.filtersSheetRow}>
            {CATEGORY_OPTIONS.map((option) => {
              const isActive = categoryFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.filtersSheetChip, isActive && styles.filtersSheetChipActive]}
                  onPress={() => onSelectCategory(option.key)}
                  activeOpacity={0.75}
                >
                  <SFIcon
                    name={option.icon}
                    fallback={option.fallback}
                    size={16}
                    color={isActive ? tokens.colors.najdi.alJass : tokens.colors.najdi.text}
                  />
                  <Text
                    style={[styles.filtersSheetChipText, isActive && styles.filtersSheetChipTextActive]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.filtersSheetSection}>
          <Text style={styles.filtersSheetLabel}>الأهمية</Text>
          <View style={styles.filtersSheetRow}>
            {SEVERITY_OPTIONS.map((option) => {
              const isActive = severityFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.filtersSheetChipSmall, isActive && styles.filtersSheetChipSmallActive]}
                  onPress={() => onSelectSeverity(option.key)}
                  activeOpacity={0.75}
                >
                  <SFIcon
                    name={option.icon}
                    fallback={option.fallback}
                    size={15}
                    color={isActive ? tokens.colors.najdi.alJass : tokens.colors.najdi.text}
                  />
                  <Text
                    style={[styles.filtersSheetChipTextSmall, isActive && styles.filtersSheetChipTextSmallActive]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.filtersSheetRowButton} onPress={onOpenDate} activeOpacity={0.75}>
          <SFIcon name="calendar" fallback="calendar-outline" size={18} color={tokens.colors.najdi.text} />
          <Text style={styles.filtersSheetRowButtonText}>التاريخ: {getDatePresetLabel(datePreset)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filtersSheetRowButton} onPress={onOpenUser} activeOpacity={0.75}>
          <SFIcon name="person.crop.circle" fallback="person-outline" size={18} color={tokens.colors.najdi.text} />
          <Text style={styles.filtersSheetRowButtonText}>
            {selectedUser ? selectedUser.actor_name : "اختر المستخدم"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filtersSheetDone} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.filtersSheetDoneText}>تم</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const ActivityListCard = ({ activity, onPress, onUndo, actorPhotos, undoingActivityId }) => {
  const summary = buildActivitySummary(activity);
  const relativeTime = formatRelativeTime(activity.created_at);
  const changedFields = getMeaningfulFields(activity.changed_fields || []);
  const primaryField = getPrimaryField(activity);
  const severityBadge = getSeverityBadge(activity.severity);
  const isUndone = Boolean(activity.undone_at);
  const showUndo = activity.is_undoable === true && !isUndone;
  const actionVisuals = getActionVisuals(activity.action_type);
  const isUndoing = undoingActivityId === activity.id;
  const isDangerous = undoService.isDangerousAction(activity.action_type);

  const actorPhotoUrl = (() => {
    if (activity.actor_profile_id && actorPhotos) {
      const mapped = actorPhotos[activity.actor_profile_id];
      if (mapped !== undefined) {
        return mapped;
      }
    }
    return activity.actor_photo_url || null;
  })();

  const actorName = activity.actor_name_current || activity.actor_name_historical || "";
  const metaParts = [];
  if (actorName) {
    metaParts.push(actorName);
  }
  metaParts.push(relativeTime);
  const metaDetails = metaParts.join(" • ");

  const hasStatusBadges = (!isUndone && isDangerous) || Boolean(severityBadge) || isUndone;

  const multiFieldSummary = (() => {
    if (changedFields.length <= 1) return null;
    const labels = changedFields.slice(0, 2).map((field) => getFieldLabel(field) || field).filter(Boolean);
    if (!labels.length) return null;
    const remaining = changedFields.length - labels.length;
    const base = labels.join("، ");
    return remaining > 0 ? `تغييرات في: ${base}، +${remaining}` : `تغييرات في: ${base}`;
  })();

  return (
    <TouchableOpacity
      style={[
        styles.activityCard,
        isUndone && styles.activityCardUndone,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.activityLeading}>
        <View
          style={[
            styles.activityAvatarFrame,
            {
              borderColor: actionVisuals.accent + (actorPhotoUrl ? "3d" : "55"),
              backgroundColor: actorPhotoUrl ? colors.white : actionVisuals.color,
            },
          ]}
        >
          {actorPhotoUrl ? (
            <Image source={{ uri: actorPhotoUrl }} style={styles.activityAvatarImage} resizeMode="cover" />
          ) : (
            <SFIcon
              name={actionVisuals.icon}
              fallback={actionVisuals.fallback}
              size={20}
              color={actionVisuals.accent}
            />
          )}
        </View>
      </View>

      <View style={styles.activityCardContent}>
        <View style={styles.activityHeaderRow}>
          <Text
            style={[
              styles.activitySummary,
              isUndone && styles.activitySummaryUndone,
            ]}
            numberOfLines={2}
          >
            {summary}
          </Text>
        </View>

        {metaDetails && (
          <Text
            style={styles.metaDetailsText}
            numberOfLines={1}
          >
            {metaDetails}
          </Text>
        )}

        {(hasStatusBadges || showUndo) && (
          <View style={styles.activityStatusRow}>
            <View style={styles.statusBadges}>
              {isDangerous && !isUndone && (
                <View style={styles.dangerBadge}>
                  <SFIcon
                    name="exclamationmark.octagon.fill"
                    fallback="warning"
                    size={12}
                    color={tokens.colors.najdi.primary}
                  />
                  <Text style={styles.dangerBadgeText}>حساس</Text>
                </View>
              )}
              {severityBadge && (
                <View
                  style={[
                    styles.severityTag,
                    {
                      backgroundColor: `${severityBadge.color}20`,
                      borderColor: `${severityBadge.color}33`,
                    },
                  ]}
                >
                  <Text style={[styles.severityTagText, { color: severityBadge.color }]}>{severityBadge.label}</Text>
                </View>
              )}
              {isUndone && (
                <View style={styles.undoneBadge}>
                  <SFIcon
                    name="checkmark.circle"
                    fallback="checkmark-circle"
                    size={12}
                    color={tokens.colors.najdi.secondary}
                  />
                  <Text style={styles.undoneBadgeText}>تم التراجع</Text>
                </View>
              )}
            </View>

            {showUndo && (
              <TouchableOpacity
                style={[
                  styles.undoButton,
                  isUndoing && styles.undoButtonDisabled,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onUndo(activity);
                }}
                activeOpacity={0.75}
                disabled={isUndoing}
              >
                {isUndoing ? (
                  <ActivityIndicator size="small" color={tokens.colors.najdi.primary} style={styles.undoSpinner} />
                ) : (
                  <SFIcon
                    name="arrow.uturn.backward"
                    fallback="arrow-undo-outline"
                    size={14}
                    color={tokens.colors.najdi.primary}
                    style={styles.undoIcon}
                  />
                )}
                <Text style={styles.undoButtonText}>{isUndoing ? "جارٍ التراجع" : "تراجع"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {changedFields.length === 1 && primaryField && (
          <View style={styles.diffPreview}>
            <InlineDiff
              field={primaryField}
              oldValue={activity.old_data?.[primaryField]}
              newValue={activity.new_data?.[primaryField]}
              showLabels={false}
            />
          </View>
        )}

        {multiFieldSummary && (
          <Text
            style={styles.fieldsSummaryText}
            numberOfLines={1}
          >
            {multiFieldSummary}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const ActivityDetailsSheet = React.forwardRef(
  (
    {
      activity,
      onClose,
      onUndo,
      onNavigateToProfile,
      onOpenAdvanced,
      renderBackdrop,
      renderHandle,
      snapPoints,
    },
    ref,
  ) => {
    const meaningfulFields = activity ? getMeaningfulFields(activity.changed_fields || []) : [];
    const severityBadge = activity ? getSeverityBadge(activity.severity) : null;
    const summary = activity ? buildActivitySummary(activity) : "";
    const actorName = activity?.actor_name_current || activity?.actor_name_historical;
    const targetName = activity?.target_name_current || activity?.target_name_historical;
    const showUndo = activity?.is_undoable === true && !activity?.undone_at;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={styles.sheetBackground}
        handleComponent={renderHandle}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          {activity ? (
            <>
              <Text style={styles.sheetTitle}>{summary}</Text>
              <Text style={styles.sheetTimestamp}>{formatAbsoluteTime(activity.created_at)}</Text>

              {severityBadge && (
                <View
                  style={[
                    styles.sheetSeverity,
                    {
                      backgroundColor: `${severityBadge.color}26`,
                      borderColor: `${severityBadge.color}40`,
                    },
                  ]}
                >
                  <Text style={[styles.sheetSeverityText, { color: severityBadge.color }]}>{severityBadge.label}</Text>
                </View>
              )}

              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>ما الذي تغيّر؟</Text>
                {meaningfulFields.length === 0 && (
                  <Text style={styles.sheetValueMuted}>لا توجد تفاصيل إضافية</Text>
                )}
                {meaningfulFields.map((field) => {
                  const oldValue = formatSimpleValue(activity.old_data?.[field]);
                  const newValue = formatSimpleValue(activity.new_data?.[field]);
                  return (
                    <View key={field} style={styles.changeCard}>
                      <Text style={styles.changeFieldLabel}>{getFieldLabel(field)}</Text>
                      <View style={styles.changeCardValues}>
                        <View style={[styles.changeValueBox, styles.changeValueBoxOld]}>
                          <Text style={styles.changeValueBoxLabel}>قبل</Text>
                          <Text style={styles.changeValueBoxText}>{oldValue}</Text>
                        </View>
                        <SFIcon
                          name="arrow.right"
                          fallback="arrow-forward"
                          rtlFallback="arrow-back"
                          size={14}
                          color={tokens.colors.najdi.text}
                          style={styles.changeArrow}
                        />
                        <View style={[styles.changeValueBox, styles.changeValueBoxNew]}>
                          <Text style={styles.changeValueBoxLabel}>بعد</Text>
                          <Text style={[styles.changeValueBoxText, styles.changeValueBoxTextNew]}>{newValue}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>من قام بذلك؟</Text>
                {activity.actor_profile_id ? (
                  <SmartNameDisplay
                    historicalName={activity.actor_name_historical}
                    currentName={activity.actor_name_current}
                    profileId={activity.actor_profile_id}
                    onNavigate={onNavigateToProfile}
                    style={styles.sheetValue}
                  />
                ) : (
                  <Text style={styles.sheetValue}>{actorName || "—"}</Text>
                )}
                {activity.actor_phone && <Text style={styles.sheetValueMuted}>{activity.actor_phone}</Text>}
              </View>

              {targetName && (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>على من؟</Text>
                  <SmartNameDisplay
                    historicalName={activity.target_name_historical}
                    currentName={activity.target_name_current}
                    profileId={activity.target_profile_id}
                    onNavigate={onNavigateToProfile}
                    style={styles.sheetValue}
                  />
                  {activity.target_phone && <Text style={styles.sheetValueMuted}>{activity.target_phone}</Text>}
                </View>
              )}

              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>السياق</Text>
                {activity.description && <Text style={styles.sheetValue}>{activity.description}</Text>}
                <Text style={styles.sheetValueMuted}>{formatRelativeTime(activity.created_at)}</Text>
              </View>

              {onOpenAdvanced && (
                <TouchableOpacity
                  style={styles.advancedLink}
                  onPress={() => activity && onOpenAdvanced(activity)}
                  activeOpacity={0.75}
                >
                  <SFIcon
                    name="info.circle"
                    fallback="information-circle-outline"
                    size={18}
                    color={tokens.colors.najdi.text}
                  />
                  <Text style={styles.advancedLinkText}>معلومات متقدمة</Text>
                </TouchableOpacity>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={onClose} activeOpacity={0.75}>
                  <Text style={styles.sheetCloseText}>إغلاق</Text>
                </TouchableOpacity>
                {showUndo && (
                  <TouchableOpacity style={styles.sheetUndoButton} onPress={() => onUndo(activity)} activeOpacity={0.8}>
                    <SFIcon name="arrow.uturn.backward" fallback="arrow-undo" size={18} color="#F9F7F3" style={styles.sheetUndoIcon} />
                    <Text style={styles.sheetUndoText}>تراجع</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptySheetState}>
              <Text style={styles.sheetValueMuted}>لا يوجد نشاط محدد</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

const useModalOverlay = (isVisible) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isVisible ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isVisible, opacity]);

  return opacity;
};

const AdvancedDetails = ({ activity }) => {
  const version = activity.new_data?.version || activity.old_data?.version;
  const metadata = activity.metadata || activity.meta || {};

  const rows = [
    { label: "المعرف", value: activity.id },
    version ? { label: "الإصدار", value: version } : null,
    metadata.request_id ? { label: "Request ID", value: metadata.request_id } : null,
    metadata.time_since_previous
      ? { label: "المدة منذ آخر تحديث", value: metadata.time_since_previous }
      : null,
  ].filter(Boolean);

  return (
    <View style={styles.advancedContainer}>
      <View style={styles.advancedMetaGrid}>
        {rows.map((row) => (
          <View key={row.label} style={styles.advancedMetaCard}>
            <Text style={styles.advancedLabel}>{row.label}</Text>
            <Text style={styles.advancedMetaValue}>{formatDetailedValue(row.value)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.advancedJsonBlock}>
        <Text style={styles.advancedLabel}>البيانات الجديدة</Text>
        <ScrollView style={styles.jsonScroll} horizontal>
          <Text style={styles.jsonText}>{JSON.stringify(activity.new_data || {}, null, 2)}</Text>
        </ScrollView>
      </View>

      <View style={styles.advancedJsonBlock}>
        <Text style={styles.advancedLabel}>البيانات السابقة</Text>
        <ScrollView style={styles.jsonScroll} horizontal>
          <Text style={styles.jsonText}>{JSON.stringify(activity.old_data || {}, null, 2)}</Text>
        </ScrollView>
      </View>
    </View>
  );
};

const AdvancedDetailsModal = ({ activity, visible, onClose }) => {
  const overlayOpacity = useModalOverlay(visible && !!activity);

  if (!activity) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Animated.View style={[styles.advancedOverlay, { opacity: overlayOpacity }]}>
        <View style={styles.advancedModalContainer}>
          <View style={styles.advancedModalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <SFIcon name="xmark" fallback="close" size={24} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
            <Text style={styles.advancedModalTitle}>معلومات متقدمة</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.advancedModalContent} showsVerticalScrollIndicator={false}>
            <AdvancedDetails activity={activity} />
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
};

const ActivityLogSkeleton = () => (
  <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.statusHeader}>
      <SkeletonLoader width={160} height={34} borderRadius={16} />
      <SkeletonLoader width={120} height={14} borderRadius={7} style={{ marginTop: 8 }} />
    </View>
    <View style={styles.controlsRow}>
      <View style={styles.searchWrapper}>
        <SkeletonLoader width="100%" height={44} borderRadius={22} />
      </View>
      <SkeletonLoader width={44} height={44} borderRadius={22} />
    </View>
    <View style={styles.inlineFiltersSkeleton}>
      <SkeletonLoader width="100%" height={32} borderRadius={16} />
      <SkeletonLoader width="100%" height={32} borderRadius={16} />
    </View>
    <View style={styles.skeletonCards}>
      <SkeletonLoader width="100%" height={104} borderRadius={16} />
      <SkeletonLoader width="100%" height={104} borderRadius={16} />
    </View>
  </SafeAreaView>
);

const getDateRangeForPreset = (preset) => {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: null, end: null };
  }
};

const matchesCategoryFilter = (activity, category) => {
  if (category === "all") return true;
  const actionCategory = activity.action_category;
  const actionType = activity.action_type;

  switch (category) {
    case "tree":
      return (
        actionCategory === "tree" ||
        TREE_ACTION_TYPES.includes(actionType)
      );
    case "marriages":
      return (
        actionCategory === "marriages" ||
        MARRIAGE_ACTION_TYPES.includes(actionType)
      );
    case "photos":
      return (
        actionCategory === "photos" ||
        PHOTO_ACTION_TYPES.includes(actionType)
      );
    case "admin":
      return (
        actionCategory === "admin" ||
        ADMIN_ACTION_TYPES.includes(actionType) ||
        activity.actor_role === "super_admin" ||
        activity.actor_role === "admin"
      );
    default:
      return true;
  }
};

const matchesSeverityFilter = (activity, severity) => {
  if (severity === "all") return true;
  if (severity === "high") {
    return activity.severity === "high" || activity.severity === "critical";
  }
  if (severity === "critical") {
    return activity.severity === "critical";
  }
  return true;
};

// Enhanced error message parser for undo operations
const parseUndoError = (error) => {
  const msg = error?.message || '';

  // Version conflict - profile was updated after the change being undone
  if (msg.includes('تم تحديث الملف من مستخدم آخر') || msg.includes('الإصدار الحالي')) {
    return {
      type: 'version_conflict',
      message: 'توجد تغييرات أحدث. قم بالتراجع عن التغييرات الأحدث أولاً (بالترتيب العكسي).',
      shouldRefresh: true
    };
  }

  // Already undone
  if (msg.includes('تم التراجع عن هذا الإجراء بالفعل')) {
    return {
      type: 'already_undone',
      message: 'تم التراجع عن هذا الإجراء بالفعل',
      shouldRefresh: true
    };
  }

  // Parent profile deleted
  if (msg.includes('محذوف')) {
    return {
      type: 'parent_deleted',
      message: 'تم حذف ملف الأب/الأم. استعد الملف المحذوف أولاً.',
      shouldRefresh: true
    };
  }

  // Profile being edited or stale data
  if (msg.includes('الملف قيد التعديل') || msg.includes('foreign key') || msg.includes('constraint')) {
    return {
      type: 'stale_data',
      message: 'تم تحديث الملف. جاري تحديث الصفحة...',
      shouldRefresh: true
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('Failed to fetch')) {
    return {
      type: 'network',
      message: 'خطأ في الاتصال. تحقق من الإنترنت وحاول مرة أخرى.',
      shouldRefresh: false
    };
  }

  // Permission denied
  if (msg.includes('غير مصرح') || msg.includes('صلاحية')) {
    return {
      type: 'permission',
      message: msg,
      shouldRefresh: false
    };
  }

  // Generic fallback
  return {
    type: 'unknown',
    message: msg || 'حدث خطأ أثناء التراجع',
    shouldRefresh: false
  };
};

export default function ActivityLogDashboard({ onClose, onNavigateToProfile, profile: profileProp }) {
  const authContext = useAuth();
  const profile = profileProp || authContext.profile;

  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);

  const [datePreset, setDatePreset] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [advancedActivity, setAdvancedActivity] = useState(null);
  const [advancedModalVisible, setAdvancedModalVisible] = useState(false);

  const [inlineFiltersVisible, setInlineFiltersVisible] = useState(false);
  const [undoingActivityId, setUndoingActivityId] = useState(null);

  const [actorPhotoMap, setActorPhotoMap] = useState({});
  const requestedPhotoIdsRef = useRef(new Set());

  const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();
  const searchInputRef = useRef(null);
  const sectionListRef = useRef(null);
  const detailSheetRef = useRef(null);
  const filterSheetRef = useRef(null);
  const refreshTimeoutRef = useRef(null);
  const detailSnapPoints = useMemo(() => ['60%', '90%'], []);
  const filterSnapPoints = useMemo(() => ['45%', '75%'], []);

  const renderBottomSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.08}
      />
    ),
    []
  );

  const renderSheetHandle = useCallback(() => (
    <View style={styles.sheetHandleRow}>
      <View style={styles.sheetHandleIndicator} />
    </View>
  ), []);


  const requestIdRef = useRef(0);
  const lastLoadTimeRef = useRef(0); // Throttle infinite scroll
  const selectedUserRef = useRef(selectedUser);
  const datePresetRef = useRef(datePreset);
  const customDateRangeRef = useRef({ from: customDateFrom, to: customDateTo });
  const categoryFilterRef = useRef(categoryFilter);
  const severityFilterRef = useRef(severityFilter);

  useEffect(() => {
    if (detailsVisible && selectedActivity) {
      detailSheetRef.current?.snapToIndex(0);
    } else {
      detailSheetRef.current?.close();
    }
  }, [detailsVisible, selectedActivity]);

  useEffect(() => {
    if (filtersSheetVisible) {
      filterSheetRef.current?.snapToIndex(0);
    } else {
      filterSheetRef.current?.close();
    }
  }, [filtersSheetVisible]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    datePresetRef.current = datePreset;
    customDateRangeRef.current = { from: customDateFrom, to: customDateTo };
    categoryFilterRef.current = categoryFilter;
    severityFilterRef.current = severityFilter;
  }, [selectedUser, datePreset, customDateFrom, customDateTo, categoryFilter, severityFilter]);

  useEffect(() => {
    const profileIds = new Set();
    activities.forEach((activity) => {
      if (activity.actor_profile_id) {
        profileIds.add(activity.actor_profile_id);
      }
    });

    if (profileIds.size === 0) return;

    const missingIds = Array.from(profileIds).filter(
      (id) => actorPhotoMap[id] === undefined && !requestedPhotoIdsRef.current.has(id)
    );

    if (missingIds.length === 0) return;

    missingIds.forEach((id) => requestedPhotoIdsRef.current.add(id));

    const fetchPhotos = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, photo_url')
        .in('id', missingIds);

      if (error) {
        console.error('Error loading actor photos:', error);
        missingIds.forEach((id) => requestedPhotoIdsRef.current.delete(id));
        return;
      }

      const returnedIds = new Set(data?.map((row) => row.id) ?? []);

      setActorPhotoMap((prev) => {
        const next = { ...prev };
        data?.forEach((row) => {
          next[row.id] = row.photo_url || null;
        });
        missingIds.forEach((id) => {
          if (!returnedIds.has(id)) {
            next[id] = null;
          }
          requestedPhotoIdsRef.current.delete(id);
        });
        return next;
      });
    };

    fetchPhotos();
  }, [activities, actorPhotoMap]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const PAGE_SIZE = 50;

  const fetchActivities = useCallback(
    async (targetPage = 0, isLoadMore = false) => {
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const start = targetPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        let query = supabase
          .from("activity_log_detailed")
          .select("*", { count: "exact" });

        if (selectedUserRef.current) {
          query = query.eq("actor_id", selectedUserRef.current.actor_id);
        }

        const dateRange = datePresetRef.current === "custom"
          ? customDateRangeRef.current
          : getDateRangeForPreset(datePresetRef.current);

        if (dateRange.start) {
          query = query.gte("created_at", dateRange.start.toISOString());
        }
        if (dateRange.end) {
          query = query.lte("created_at", dateRange.end.toISOString());
        }

        query = query.order("created_at", { ascending: false }).range(start, end);

        const { data, error } = await query;

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (error) throw error;

        if (isLoadMore) {
          setActivities((prev) => [...prev, ...(data || [])]);
          setPage((prev) => prev + 1);
        } else {
          setActivities(data || []);
          setPage(1); // We loaded page 0, next page is 1
        }

        setHasMore((data?.length || 0) === PAGE_SIZE);
      } catch (error) {
        if (currentRequestId === requestIdRef.current) {
          console.error("Error fetching activities:", error);
          Alert.alert("خطأ", "فشل تحميل السجل");
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [] // No dependencies - filters use refs, page passed as parameter
  );

  useEffect(() => {
    fetchActivities(0, false);

    const channel = supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log_enhanced" },
        (payload) => {
          const newActivity = payload.new;

          setActivities((prev) => {
            if (prev.some((item) => item.id === newActivity.id)) {
              return prev;
            }

            const matchesUser = !selectedUserRef.current || newActivity.actor_id === selectedUserRef.current.actor_id;
            const matchesCategory = matchesCategoryFilter(newActivity, categoryFilterRef.current);
            const matchesSeverity = matchesSeverityFilter(newActivity, severityFilterRef.current);

            if (!matchesUser || !matchesCategory || !matchesSeverity) {
              showToast("حدث جديد خارج نطاق الفلاتر الحالية", "info");
              return prev;
            }

            // Optimize batch operation handling
            if (newActivity.operation_group_id !== null) {
              // Check if this operation belongs to an existing visible group
              const existingGroup = prev.find(a =>
                a.operation_group_id === newActivity.operation_group_id
              );

              if (existingGroup) {
                // Group already visible - must refresh to update group
                console.log('[ActivityLogDashboard] Batch operation for existing group - triggering refresh');
                fetchActivities(0, false);
                return prev; // Keep current state, fetchActivities will update
              } else {
                // New batch group - debounce refresh to wait for all operations
                console.log('[ActivityLogDashboard] New batch operation group detected - will refresh after debounce');

                // Clear previous timeout
                if (refreshTimeoutRef.current) {
                  clearTimeout(refreshTimeoutRef.current);
                }

                // Debounce refresh by 300ms to group all batch operations
                refreshTimeoutRef.current = setTimeout(() => {
                  fetchActivities(0, false);
                  refreshTimeoutRef.current = null;
                }, 300);

                return prev; // Don't append, wait for debounced refresh to group all operations
              }
            }

            // Individual activity - safe to append
            return [newActivity, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchActivities, showToast]);

  useEffect(() => {
    setPage(0);
    fetchActivities(0, false);
  }, [selectedUser, datePreset, customDateFrom, customDateTo, fetchActivities]);

  useEffect(() => {
    let filtered = [...activities];

    if (categoryFilter !== "all") {
      filtered = filtered.filter((activity) => matchesCategoryFilter(activity, categoryFilter));
    }

    if (severityFilter === "high") {
      filtered = filtered.filter((activity) => activity.severity === "high" || activity.severity === "critical");
    } else if (severityFilter === "critical") {
      filtered = filtered.filter((activity) => activity.severity === "critical");
    }

    if (debouncedSearch.trim()) {
      const search = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.actor_name?.toLowerCase().includes(search) ||
          activity.actor_phone?.includes(search) ||
          activity.target_name?.toLowerCase().includes(search) ||
          activity.target_phone?.includes(search) ||
          activity.description?.toLowerCase().includes(search)
      );
    }

    setFilteredActivities(filtered);
  }, [activities, categoryFilter, severityFilter, debouncedSearch]);

  const groupedSections = useMemo(() => {
    try {
      // Phase 1: Group by operation_group_id in single O(n) pass
      const groupMap = new Map();
      const individual = [];

      filteredActivities.forEach(activity => {
        if (activity.operation_group_id !== null) {
          const groupId = activity.operation_group_id;
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: `group-${groupId}`,
              type: 'batch_group',
              operation_group_id: groupId,
              group_type: activity.group_type || 'unknown',
              group_description: activity.group_description || 'عملية جماعية',
              operation_count: activity.group_operation_count,
              group_undo_state: activity.group_undo_state,
              created_at: activity.created_at,
              operations: [],

              // Inherit filter fields from first operation for filter compatibility
              actor_profile_id: activity.actor_profile_id,
              actor_name_chain: activity.actor_name_chain,
              primary_action_type: activity.action_type,
              searchableText: ''
            });
          }

          groupMap.get(groupId).operations.push(activity);

          // Aggregate searchable text for search compatibility
          groupMap.get(groupId).searchableText +=
            `${activity.actor_name_current || activity.actor_name_historical || ''} ${activity.target_name_current || activity.target_name_historical || ''} ${activity.description || ''} `;
        } else {
          individual.push({
            ...activity,
            type: 'individual'
          });
        }
      });

      // Phase 2: Convert map to array and filter empty groups
      const batchGroups = Array.from(groupMap.values())
        .filter(group => group.operations.length > 0);

      // Log critical count mismatches (only for small groups or completed loads)
      // Large batch operations (100+) are expected to show partial counts during pagination
      batchGroups.forEach(group => {
        const mismatch = Math.abs(group.operations.length - group.operation_count);
        const isLargeBatch = group.operation_count >= 100;
        const isPaginationExpected = group.operations.length < group.operation_count;

        // Only warn if:
        // 1. Small batch with large mismatch (unexpected)
        // 2. Loaded more operations than expected (data integrity issue)
        if (!isLargeBatch && mismatch > 10) {
          console.warn('[ActivityLogDashboard] Batch count mismatch in small batch', {
            group_id: group.operation_group_id,
            expected: group.operation_count,
            actual: group.operations.length
          });
        } else if (group.operations.length > group.operation_count) {
          console.error('[ActivityLogDashboard] Loaded MORE operations than expected', {
            group_id: group.operation_group_id,
            expected: group.operation_count,
            actual: group.operations.length,
            overflow: group.operations.length - group.operation_count
          });
        }
      });

      // Phase 3: Merge and sort by timestamp (with secondary sort by ID for stability)
      const allActivities = [...batchGroups, ...individual];
      allActivities.sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;

        // Secondary sort by ID to ensure stable sort order
        const aId = a.type === 'batch_group' ? a.operation_group_id : a.id;
        const bId = b.type === 'batch_group' ? b.operation_group_id : b.id;
        return String(bId).localeCompare(String(aId));
      });

      // Phase 4: Group by date sections
      const dateGroups = new Map();
      allActivities.forEach(item => {
        const date = parseISO(item.created_at);
        let dateLabel;

        if (isToday(date)) {
          dateLabel = "اليوم";
        } else if (isYesterday(date)) {
          dateLabel = "أمس";
        } else {
          dateLabel = format(date, "d MMMM", { locale: ar });
        }

        if (!dateGroups.has(dateLabel)) {
          dateGroups.set(dateLabel, []);
        }
        dateGroups.get(dateLabel).push(item);
      });

      // Phase 5: Convert to sections array and filter empty sections
      return Array.from(dateGroups.entries())
        .filter(([_, data]) => data.length > 0)
        .map(([title, data]) => ({
          title,
          data
        }));

    } catch (error) {
      console.error('[ActivityLogDashboard] Grouping error:', error);
      // Fallback: return ungrouped activities
      return [{
        title: 'خطأ في التجميع',
        data: filteredActivities.map(a => ({ ...a, type: 'individual' }))
      }];
    }
  }, [filteredActivities]);

  const latestActivityTimestamp = activities.length > 0 ? activities[0].created_at : null;

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== "all") count += 1;
    if (severityFilter !== "all") count += 1;
    if (datePreset !== "all" || (datePreset === "custom" && (customDateFrom || customDateTo))) count += 1;
    if (selectedUser) count += 1;
    return count;
  }, [categoryFilter, severityFilter, datePreset, customDateFrom, customDateTo, selectedUser]);

  const executeUndo = useCallback(
    async (activity) => {
      if (!profile?.id) {
        showToast("يجب تسجيل الدخول للتراجع", "error");
        return;
      }

      setUndoingActivityId(activity.id);

      try {
        const permissionCheck = await undoService.checkUndoPermission(activity.id, profile.id);

        if (!permissionCheck.can_undo) {
          showToast(permissionCheck.reason || "لا يمكن التراجع عن هذا الإجراء", "error");
          return;
        }

        const result = await undoService.undoAction(
          activity.id,
          profile.id,
          activity.action_type,
          "تراجع من سجل النشاط"
        );

        if (result.success) {
          showToast("✓ تم التراجع بنجاح", "success");

          if (detailsVisible) {
            setTimeout(() => {
              setDetailsVisible(false);
              setSelectedActivity(null);
              setAdvancedActivity(null);
              setAdvancedModalVisible(false);
            }, 650);
          }

          const profileId = activity.record_id;
          if (profileId) {
            const { data: freshProfile, error: fetchError } = await supabase
              .from('profiles')
              .select('*')
              .is('deleted_at', null)
              .eq('id', profileId)
              .single();

            if (freshProfile && !fetchError) {
              useTreeStore.getState().updateNode(profileId, freshProfile);
              console.log('[ActivityLogDashboard] Profile refreshed after undo:', {
                profileId,
                oldVersion: activity.new_data?.version,
                newVersion: freshProfile.version
              });
            } else if (fetchError) {
              console.warn('[ActivityLogDashboard] Failed to refetch profile after undo:', fetchError);
              showToast("⚠ تم التراجع ولكن فشل تحديث العرض. يرجى إعادة تحميل الصفحة.", "warning");
            }
          }

          fetchActivities(0, false);
        } else {
          showToast(result.error || "فشل التراجع", "error");
        }
      } catch (error) {
        console.error("Undo error:", error);
        const parsedError = parseUndoError(error);

        showToast(parsedError.message, "error");

        if (parsedError.shouldRefresh) {
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchActivities(0, false);
          }, 2000);
        }
      } finally {
        setUndoingActivityId((current) => (current === activity.id ? null : current));
      }
    },
    [
      profile,
      showToast,
      fetchActivities,
      detailsVisible,
      setDetailsVisible,
      setSelectedActivity,
      setAdvancedActivity,
      setAdvancedModalVisible,
    ]
  );

  const handleUndo = useCallback(
    (activity) => {
      if (!profile?.id) {
        showToast("يجب تسجيل الدخول للتراجع", "error");
        return;
      }

      if (undoService.isDangerousAction(activity.action_type)) {
        const actionLabel = undoService.getActionDescription(activity.action_type);
        Alert.alert(
          "تأكيد التراجع",
          `هذا إجراء حساس: ${actionLabel}.\nسيتم استرجاع جميع البيانات المرتبطة، هل أنت متأكد؟`,
          [
            {
              text: "إلغاء",
              style: "cancel",
              onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
            },
            {
              text: "تأكيد التراجع",
              style: "destructive",
              onPress: () => executeUndo(activity),
            },
          ],
          { cancelable: false }
        );
        return;
      }

      executeUndo(activity);
    },
    [profile, executeUndo, showToast]
  );

  const handleOpenDetails = useCallback((activity) => {
    setSelectedActivity(activity);
    setAdvancedActivity(null);
    setAdvancedModalVisible(false);
    setDetailsVisible(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
    setSelectedActivity(null);
    setAdvancedModalVisible(false);
    setAdvancedActivity(null);
  }, []);

  const handleRefreshActivities = useCallback(() => {
    fetchActivities(0, false);
  }, [fetchActivities]);

  const scrollListToTop = useCallback(() => {
    requestAnimationFrame(() => {
      const list = sectionListRef.current;
      if (list && typeof list.scrollToLocation === 'function') {
        try {
          list.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
        } catch (err) {
          // Fallback: silently ignore if list is empty or location invalid
        }
      } else if (list && typeof list.scrollToOffset === 'function') {
        list.scrollToOffset({ offset: 0, animated: true });
      }
    });
  }, []);

  const handleCategoryChange = useCallback((value) => {
    setCategoryFilter(value);
    scrollListToTop();
  }, [scrollListToTop]);

  const handleSeverityChange = useCallback((value) => {
    setSeverityFilter(value);
    scrollListToTop();
  }, [scrollListToTop]);

  const handleOpenAdvanced = (activity) => {
    if (!activity) return;
    setAdvancedActivity(activity);
    setAdvancedModalVisible(true);
  };

  const handleCloseAdvanced = () => {
    setAdvancedModalVisible(false);
    setAdvancedActivity(null);
  };

  const handleResetFilters = () => {
    Haptics.selectionAsync();
    setCategoryFilter("all");
    setSeverityFilter("all");
    setSelectedUser(null);
    setDatePreset("all");
    setCustomDateFrom(null);
    setCustomDateTo(null);
    setSearchText("");
    setDebouncedSearch("");
    scrollListToTop();
  };

  const openFilters = useCallback(() => {
    setInlineFiltersVisible((visible) => {
      const next = !visible;
      if (!next) {
        // Hide inline filters and close sheet if open
        setFiltersSheetVisible(false);
      } else {
        setFiltersSheetVisible(true);
      }
      return next;
    });
  }, []);

  const shouldShowInlineFilters = inlineFiltersVisible;

  if (loading && activities.length === 0) {
    return <ActivityLogSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusHeader latestTimestamp={latestActivityTimestamp} onClose={onClose} />

      <ControlsRow
        onOpenFilters={openFilters}
        activeFiltersCount={activeFiltersCount}
        searchText={searchText}
        onSearchChange={setSearchText}
        searchInputRef={searchInputRef}
      />

      {shouldShowInlineFilters && (
        <InlineFilters
          category={categoryFilter}
          severity={severityFilter}
          onCategoryChange={handleCategoryChange}
          onSeverityChange={handleSeverityChange}
        />
      )}

      <SectionList
        ref={sectionListRef}
        sections={groupedSections}
        keyExtractor={(item, index) =>
          item.type === 'batch_group'
            ? `group-${item.operation_group_id}-${index}`
            : `activity-${item.id}-${index}`
        }
        renderItem={({ item }) => {
          const wrapperStyle = item.type === 'batch_group'
            ? styles.cardWrapperBatch
            : styles.cardWrapper;

          if (item.type === 'batch_group') {
            return (
              <View style={wrapperStyle}>
                <BatchOperationCard
                  groupId={item.operation_group_id}
                  groupType={item.group_type}
                  description={item.group_description}
                  operationCount={item.operation_count}
                  operations={item.operations}
                  createdAt={item.created_at}
                  undoState={item.group_undo_state}
                  onRefresh={handleRefreshActivities}
                  onPressOperation={handleOpenDetails}
                  actorPhotos={actorPhotoMap}
                />
              </View>
            );
          }

          return (
            <View style={wrapperStyle}>
              <ActivityListCard
                activity={item}
                onPress={() => handleOpenDetails(item)}
                onUndo={handleUndo}
                actorPhotos={actorPhotoMap}
                undoingActivityId={undoingActivityId}
              />
            </View>
          );
        }}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchActivities(0, false);
            }}
            colors={["#A13333"]}
            tintColor="#A13333"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <SFIcon name="doc.text" fallback="document-text-outline" size={48} color={tokens.colors.najdi.textMuted} />
            <Text style={styles.emptyTitle}>لا توجد نشاطات في هذا النطاق</Text>
            <Text style={styles.emptySubtitle}>جرّب تغيير الفلاتر أو عرض كل الوقت</Text>
            <TouchableOpacity style={styles.emptyReset} onPress={handleResetFilters}>
              <Text style={styles.emptyResetText}>إعادة الضبط</Text>
            </TouchableOpacity>
          </View>
        }
        onEndReached={() => {
          const now = Date.now();
          // Throttle: max 1 request per second
          if (now - lastLoadTimeRef.current < 1000) return;

          if (hasMore && !loading && !loadingMore) {
            lastLoadTimeRef.current = now;
            fetchActivities(page, true);
          }
        }}
        onEndReachedThreshold={0.3}
        onMomentumScrollBegin={() => {
          // Prevent initial trigger when list mounts
          lastLoadTimeRef.current = Date.now();
        }}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={tokens.colors.najdi.crimson} />
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {selectedActivity && (
        <ActivityDetailsSheet
          ref={detailSheetRef}
          activity={selectedActivity}
          visible={detailsVisible}
          onClose={handleCloseDetails}
          onUndo={handleUndo}
          onNavigateToProfile={onNavigateToProfile}
          onOpenAdvanced={handleOpenAdvanced}
          renderBackdrop={renderBottomSheetBackdrop}
          renderHandle={renderSheetHandle}
          snapPoints={detailSnapPoints}
        />
      )}

      <FiltersSheet
        visible={filtersSheetVisible}
        onClose={() => setFiltersSheetVisible(false)}
        categoryFilter={categoryFilter}
        severityFilter={severityFilter}
        datePreset={datePreset}
        onSelectCategory={setCategoryFilter}
        onSelectSeverity={setSeverityFilter}
        onOpenDate={() => {
          filterSheetRef.current?.close();
          setFiltersSheetVisible(false);
          setShowDateFilter(true);
        }}
        onOpenUser={() => {
          filterSheetRef.current?.close();
          setFiltersSheetVisible(false);
          setShowUserFilter(true);
        }}
        selectedUser={selectedUser}
        onClear={handleResetFilters}
      />

      <UserFilterModal
        visible={showUserFilter}
        onClose={() => setShowUserFilter(false)}
        onSelectUser={(user) => {
          setSelectedUser(user);
          setShowUserFilter(false);
          setPage(0);
        }}
        selectedUser={selectedUser}
        currentUserId={profile?.id}
      />

      <DateRangePickerModal
        visible={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onApplyFilter={(preset, range) => {
          setDatePreset(preset);
          if (preset === "custom") {
            setCustomDateFrom(range.from);
            setCustomDateTo(range.to);
          }
        }}
        activePreset={datePreset}
        customRange={{ from: customDateFrom, to: customDateTo }}
      />

      <AdvancedDetailsModal
        activity={advancedActivity}
        visible={advancedModalVisible}
        onClose={handleCloseAdvanced}
      />

      <Toast visible={toastVisible} message={toastMessage} type={toastType} onDismiss={hideToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  statusHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emblem: {
    width: 52,
    height: 52,
    tintColor: tokens.colors.najdi.text,
    marginEnd: 12,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
    lineHeight: 41,
  },
  screenSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchWrapper: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 3,
      },
    }),
    marginEnd: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.najdi.text,
  },
  filterFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
  filterFabActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  filterFabBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  inlineFiltersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  segmentedScrollContent: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
    marginEnd: 8,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "600",
  },
  segmentedControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.najdi.container + '24',
    borderRadius: 14,
    padding: 4,
    marginTop: 12,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: tokens.colors.najdi.text,
    fontWeight: "700",
  },
  inlineFiltersSkeleton: {
    flexDirection: "column",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  skeletonCards: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  cardWrapperBatch: {
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#D58C4A15",
  },
  nowBadgeText: {
    fontSize: 11,
    color: "#73637280",
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  activityCard: {
    backgroundColor: colors.white,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '30',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  activityCardUndone: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '40',
  },
  activityLeading: {
    width: 48,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    marginEnd: tokens.spacing.md,
  },
  activityAvatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  activityAvatarImage: {
    width: "100%",
    height: "100%",
  },
  activityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityCardContent: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  severityTag: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  severityTagText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "700",
  },
  metaDetailsText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: colors.textMuted,
    lineHeight: 18,
  },
  activityStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  statusBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  dangerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary + '33',
    backgroundColor: tokens.colors.najdi.primary + '12',
  },
  dangerBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    color: tokens.colors.najdi.primary,
  },
  undoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
    backgroundColor: tokens.colors.najdi.container + '18',
  },
  undoneBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  undoButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary + '66',
    backgroundColor: tokens.colors.najdi.primary + '12',
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
  },
  undoButtonDisabled: {
    borderColor: tokens.colors.najdi.primary + '33',
    backgroundColor: tokens.colors.najdi.primary + '08',
  },
  undoButtonText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.primary,
    fontWeight: "600",
  },
  undoSpinner: {
    marginEnd: tokens.spacing.xs,
  },
  undoIcon: {
    marginEnd: tokens.spacing.xs,
  },
  activitySummary: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    lineHeight: 24,
  },
  activitySummaryUndone: {
    color: tokens.colors.najdi.textMuted,
  },
  diffPreview: {
    marginTop: 10,
  },
  fieldsSummaryText: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.footnote.fontSize,
    color: colors.textMuted,
    fontWeight: "600",
    lineHeight: 18,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 84,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyReset: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.crimson,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: 'transparent',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  sheetHandleRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.textMuted + "55",
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
  },
  sheetTimestamp: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sheetSeverity: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetSeverityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sheetSection: {
    gap: 12,
  },
  sheetSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  sheetValue: {
    fontSize: 17,
    color: tokens.colors.najdi.text,
  },
  sheetValueMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  changeFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  changeCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.container + '18',
    borderRadius: tokens.radii.lg,
  },
  changeCardValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
  },
  changeValueBox: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.colors.najdi.background,
  },
  changeValueBoxOld: {
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40',
  },
  changeValueBoxNew: {
    backgroundColor: tokens.colors.najdi.container + '26',
  },
  changeValueBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  changeValueBoxText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  changeValueBoxTextNew: {
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  changeArrow: {
    marginHorizontal: 4,
  },
  advancedLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  advancedLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  sheetCloseButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetCloseText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  sheetUndoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 12,
    paddingVertical: 12,
  },
  sheetUndoIcon: {
    marginStart: 4,
  },
  sheetUndoText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
  },
  advancedContainer: {
    gap: 16,
  },
  advancedMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  advancedMetaCard: {
    flexBasis: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container + '18',
    gap: 4,
  },
  advancedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  advancedMetaValue: {
    fontSize: 13,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  advancedJsonBlock: {
    gap: 8,
  },
  jsonScroll: {
    maxHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: tokens.colors.najdi.container + "26",
    padding: 12,
  },
  jsonText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: tokens.colors.najdi.text,
  },
  filtersSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: 'transparent',
  },
  filtersSheetBackdrop: {
    flex: 1,
  },
  filtersSheetContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '30',
    padding: 20,
    gap: 16,
  },
  filtersSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersSheetIntro: {
    marginTop: 4,
    marginBottom: 8,
  },
  filtersSheetIntroText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  filtersSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
  },
  filtersSheetReset: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
  },
  filtersSheetSection: {
    gap: 12,
    marginBottom: 16,
  },
  filtersSheetLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filtersSheetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filtersSheetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: tokens.colors.najdi.container + '18',
  },
  filtersSheetChipActive: {
    backgroundColor: tokens.colors.najdi.crimson,
  },
  filtersSheetChipIcon: {
    marginStart: 0,
  },
  filtersSheetChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  filtersSheetChipTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  filtersSheetChipSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: tokens.colors.najdi.container + '18',
  },
  filtersSheetChipSmallActive: {
    backgroundColor: tokens.colors.najdi.crimson,
  },
  filtersSheetChipTextSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  filtersSheetChipTextSmallActive: {
    color: tokens.colors.najdi.alJass,
  },
  filtersSheetRowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: tokens.colors.najdi.container + '18',
    marginBottom: 12,
  },
  filtersSheetRowButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
  },
  filtersSheetDone: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.crimson,
    paddingVertical: 12,
    alignItems: "center",
  },
  filtersSheetDoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
  },
  advancedOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: 'transparent',
  },
  advancedModalContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '30',
    maxHeight: "90%",
  },
  advancedModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  advancedModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
  },
  advancedModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
});
