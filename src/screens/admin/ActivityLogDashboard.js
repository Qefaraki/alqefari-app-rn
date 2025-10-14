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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  formatDistanceToNow,
} from "date-fns";
import { ar } from "date-fns/locale";
import tokens from "../../components/ui/tokens";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import InlineDiff from "../../components/ui/InlineDiff";
import { getFieldLabel } from "../../services/activityLogTranslations";
import { formatRelativeTime } from "../../utils/formatTimestamp";
import UserFilterModal from "../../components/admin/UserFilterModal";
import DateRangePickerModal from "../../components/admin/DateRangePickerModal";
import { useAuth } from "../../contexts/AuthContext";
import undoService from "../../services/undoService";
import { useUndoStore } from "../../stores/undoStore";
import Toast from "../../components/ui/Toast";

const colors = {
  ...tokens.colors.najdi,
  textMuted: tokens.colors.najdi.textMuted,
};

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

const CATEGORY_OPTIONS = [
  { key: "all", label: "الجميع" },
  { key: "tree", label: "الشجرة" },
  { key: "marriages", label: "الأزواج" },
  { key: "photos", label: "الصور" },
  { key: "admin", label: "الإدارة" },
];

const SEVERITY_OPTIONS = [
  { key: "all", label: "كل المستويات" },
  { key: "high", label: "عالي" },
  { key: "critical", label: "حرج" },
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
  if (typeof value === "object") return "بيانات";
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

const formatAbsoluteTimestamp = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = parseISO(timestamp);
    if (isToday(date)) return `اليوم ${format(date, "h:mm a", { locale: ar })}`;
    if (isYesterday(date)) return `أمس ${format(date, "h:mm a", { locale: ar })}`;
    return format(date, "d MMMM yyyy h:mm a", { locale: ar });
  } catch (error) {
    return timestamp;
  }
};

const formatRelativeSince = (timestamp) => {
  if (!timestamp) return "";
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true, locale: ar });
  } catch (error) {
    return timestamp;
  }
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
    return `${actorShort} حدّث ${meaningfulFields.length} حقول لـ ${targetShort}`;
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
          <Ionicons name="person-circle-outline" size={14} color="#736372" />
          <Text style={[style, historicalStyle]}>{displayName}</Text>
          {onNavigate && profileId && (
            <Ionicons name="chevron-back" size={12} color="#736372" />
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
            <Ionicons name="person-circle-outline" size={14} color="#73637280" />
            <Text style={[style, historicalStyle]}>{normalizedHistorical}</Text>
          </View>
          <View style={[styles.nameRow, { marginRight: 18 }]}>
            <View style={styles.nowBadge}>
              <Text style={styles.nowBadgeText}>الآن</Text>
            </View>
            <Text style={[style, currentStyle, { color: "#242121" }]}>{normalizedCurrent}</Text>
            {onNavigate && profileId && (
              <Ionicons name="chevron-back" size={12} color="#736372" />
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
        <Text style={styles.screenSubtitle}>آخر تحديث {latestTimestamp ? formatRelativeTime(latestTimestamp) : "لا توجد أنشطة"}</Text>
      </View>
      {onClose && (
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-forward" size={24} color={tokens.colors.najdi.text} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const ControlsRow = ({ onOpenFilters, activeFiltersCount, searchText, onSearchChange }) => {
  const hasFilters = activeFiltersCount > 0;
  const label = hasFilters ? `المصفيات (${activeFiltersCount})` : "المصفيات";

  return (
    <View style={styles.controlsRow}>
      <TouchableOpacity
        style={[styles.filterChip, hasFilters && styles.filterChipActive]}
        onPress={onOpenFilters}
        activeOpacity={0.75}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={hasFilters ? tokens.colors.najdi.alJass : tokens.colors.najdi.text}
        />
        <Text style={[styles.filterChipText, hasFilters && styles.filterChipTextActive]}>{label}</Text>
      </TouchableOpacity>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={tokens.colors.najdi.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث سريع"
          placeholderTextColor={tokens.colors.najdi.textMuted}
          value={searchText}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={tokens.colors.najdi.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const FiltersSheet = ({
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
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.filtersSheetOverlay}>
      <TouchableOpacity style={styles.filtersSheetBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.filtersSheetContainer}>
        <View style={styles.filtersSheetHeader}>
          <Text style={styles.filtersSheetTitle}>المصفيات</Text>
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={styles.filtersSheetReset}>إعادة الضبط</Text>
          </TouchableOpacity>
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
          <Ionicons name="calendar-outline" size={18} color={tokens.colors.najdi.text} />
          <Text style={styles.filtersSheetRowButtonText}>التاريخ: {getDatePresetLabel(datePreset)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filtersSheetRowButton} onPress={onOpenUser} activeOpacity={0.75}>
          <Ionicons name="person-outline" size={18} color={tokens.colors.najdi.text} />
          <Text style={styles.filtersSheetRowButtonText}>
            {selectedUser ? selectedUser.actor_name : "اختر المستخدم"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filtersSheetDone} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.filtersSheetDoneText}>تم</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const ActivityListCard = ({ activity, onPress, onUndo }) => {
  const summary = buildActivitySummary(activity);
  const relativeTime = formatRelativeSince(activity.created_at);
  const changedFields = getMeaningfulFields(activity.changed_fields || []);
  const primaryField = getPrimaryField(activity);
  const severityBadge = getSeverityBadge(activity.severity);
  const showUndo = activity.is_undoable === true && !activity.undone_at;

  return (
    <TouchableOpacity style={styles.activityCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.activitySummary} numberOfLines={2}>{summary}</Text>
        <View style={styles.activityMetaRow}>
          <Text style={styles.activityTime}>{relativeTime}</Text>
          {severityBadge && (
            <View style={[styles.severityPill, { backgroundColor: severityBadge.color }]}>
              <Text style={[styles.severityPillText, { color: severityBadge.text }]}>{severityBadge.label}</Text>
            </View>
          )}
        </View>
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
        {changedFields.length > 1 && (
          <Text style={styles.fieldsCountText}>{`${changedFields.length} تغييرات`}</Text>
        )}
      </View>
      <View style={styles.cardActions}>
        {showUndo && (
          <TouchableOpacity
            style={styles.undoIconButton}
            onPress={(e) => {
              e.stopPropagation();
              onUndo(activity);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={tokens.colors.najdi.crimson} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-back" size={18} color="#24212140" />
      </View>
    </TouchableOpacity>
  );
};

const ActivityDetailsSheet = ({ activity, visible, onClose, onUndo, onNavigateToProfile, onOpenAdvanced }) => {
  if (!activity) return null;

  const meaningfulFields = getMeaningfulFields(activity.changed_fields || []);
  const severityBadge = getSeverityBadge(activity.severity);
  const summary = buildActivitySummary(activity);
  const actorName = activity.actor_name_current || activity.actor_name_historical;
  const targetName = activity.target_name_current || activity.target_name_historical;
  const showUndo = activity.is_undoable === true && !activity.undone_at;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandleRow}>
            <View style={styles.sheetHandle} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{summary}</Text>
            <Text style={styles.sheetTimestamp}>{formatAbsoluteTimestamp(activity.created_at)}</Text>

            {severityBadge && (
              <View style={[styles.sheetSeverity, { backgroundColor: severityBadge.color }]}>
                <Text style={[styles.sheetSeverityText, { color: severityBadge.text }]}>{severityBadge.label}</Text>
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
                  <View key={field} style={styles.changeRow}>
                    <Text style={styles.changeBullet}>•</Text>
                    <View style={styles.changeContent}>
                      <Text style={styles.changeFieldLabel}>{getFieldLabel(field)}</Text>
                      <Text style={styles.changeFieldValue}>{`${oldValue} → ${newValue}`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>من قام بذلك؟</Text>
              <Text style={styles.sheetValue}>{actorName || "—"}</Text>
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
              <Text style={styles.sheetValueMuted}>{`تم منذ ${formatRelativeSince(activity.created_at)}`}</Text>
            </View>

            <TouchableOpacity style={styles.advancedLink} onPress={() => onOpenAdvanced(activity)} activeOpacity={0.75}>
              <Ionicons name="information-circle-outline" size={18} color={tokens.colors.najdi.text} />
              <Text style={styles.advancedLinkText}>معلومات متقدمة</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetCloseButton} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.sheetCloseText}>إغلاق</Text>
            </TouchableOpacity>
            {showUndo && (
              <TouchableOpacity style={styles.sheetUndoButton} onPress={() => onUndo(activity)} activeOpacity={0.8}>
                <Ionicons name="arrow-undo" size={18} color="#F9F7F3" style={{ marginLeft: 4 }} />
                <Text style={styles.sheetUndoText}>تراجع</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
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
      {rows.map((row) => (
        <View key={row.label} style={styles.advancedRow}>
          <Text style={styles.advancedLabel}>{row.label}</Text>
          <Text style={styles.advancedValue}>{formatDetailedValue(row.value)}</Text>
        </View>
      ))}

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
  if (!activity) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.advancedOverlay}>
        <View style={styles.advancedModalContainer}>
          <View style={styles.advancedModalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
            <Text style={styles.advancedModalTitle}>معلومات متقدمة</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.advancedModalContent} showsVerticalScrollIndicator={false}>
            <AdvancedDetails activity={activity} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ActivityLogSkeleton = () => (
  <SafeAreaView style={styles.container}>
    <View style={styles.statusHeader}>
      <SkeletonLoader width="100%" height={56} borderRadius={16} />
    </View>
    <View style={styles.controlsRow}>
      <SkeletonLoader width={120} height={36} borderRadius={18} />
      <SkeletonLoader width="60%" height={36} borderRadius={12} />
    </View>
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <SkeletonLoader width="100%" height={96} borderRadius={16} />
      <SkeletonLoader width="100%" height={96} borderRadius={16} />
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
  switch (category) {
    case "tree":
      return ["create_node", "update_node", "delete_node", "merge_nodes"].includes(activity.action_type);
    case "marriages":
      return ["add_marriage", "update_marriage", "delete_marriage"].includes(activity.action_type);
    case "photos":
      return ["upload_photo", "update_photo", "delete_photo"].includes(activity.action_type);
    case "admin":
      return ["grant_admin", "revoke_admin", "update_settings"].includes(activity.action_type) ||
        activity.actor_role === "super_admin" ||
        activity.actor_role === "admin";
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

  const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();

  const requestIdRef = useRef(0);
  const selectedUserRef = useRef(selectedUser);
  const datePresetRef = useRef(datePreset);
  const customDateRangeRef = useRef({ from: customDateFrom, to: customDateTo });
  const categoryFilterRef = useRef(categoryFilter);
  const severityFilterRef = useRef(severityFilter);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    datePresetRef.current = datePreset;
    customDateRangeRef.current = { from: customDateFrom, to: customDateTo };
    categoryFilterRef.current = categoryFilter;
    severityFilterRef.current = severityFilter;
  }, [selectedUser, datePreset, customDateFrom, customDateTo, categoryFilter, severityFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const PAGE_SIZE = 50;

  const fetchActivities = useCallback(
    async (isLoadMore = false) => {
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const currentPage = isLoadMore ? page : 0;
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;

        let query = supabase.from("activity_log_detailed").select("*", { count: "exact" });

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
        } else {
          setActivities(data || []);
        }

        setPage(currentPage + 1);
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
    [page]
  );

  useEffect(() => {
    fetchActivities(false);

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

            return [newActivity, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities, showToast]);

  useEffect(() => {
    setPage(0);
    fetchActivities(false);
  }, [selectedUser, datePreset, customDateFrom, customDateTo]);

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
    const groups = {};

    filteredActivities.forEach((activity) => {
      const date = parseISO(activity.created_at);
      let dateLabel;

      if (isToday(date)) {
        dateLabel = "اليوم";
      } else if (isYesterday(date)) {
        dateLabel = "أمس";
      } else {
        dateLabel = format(date, "d MMMM", { locale: ar });
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }

      groups[dateLabel].push(activity);
    });

    return Object.entries(groups)
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }))
      .sort((a, b) => {
        const first = a.data[0];
        const second = b.data[0];
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
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

  const handleUndo = useCallback(
    async (activity) => {
      if (!profile?.id) {
        showToast("يجب تسجيل الدخول للتراجع", "error");
        return;
      }

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
          fetchActivities(false);
        } else {
          showToast(result.error || "فشل التراجع", "error");
        }
      } catch (error) {
        console.error("Undo error:", error);
        showToast(error.message || "حدث خطأ أثناء التراجع", "error");
      }
    },
    [profile, showToast, fetchActivities]
  );

  const handleOpenDetails = (activity) => {
    setSelectedActivity(activity);
    setDetailsVisible(true);
  };

  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setSelectedActivity(null);
  };

  const handleOpenAdvanced = (activity) => {
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
  };

  if (loading && activities.length === 0) {
    return <ActivityLogSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusHeader latestTimestamp={latestActivityTimestamp} onClose={onClose} />

      <ControlsRow
        onOpenFilters={() => setFiltersSheetVisible(true)}
        activeFiltersCount={activeFiltersCount}
        searchText={searchText}
        onSearchChange={setSearchText}
      />

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityListCard activity={item} onPress={() => handleOpenDetails(item)} onUndo={handleUndo} />
        )}
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
              fetchActivities(false);
            }}
            colors={["#A13333"]}
            tintColor="#A13333"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={tokens.colors.najdi.textMuted} />
            <Text style={styles.emptyTitle}>لا توجد نشاطات في هذا النطاق</Text>
            <Text style={styles.emptySubtitle}>جرّب تغيير الفلاتر أو عرض كل الوقت</Text>
            <TouchableOpacity style={styles.emptyReset} onPress={handleResetFilters}>
              <Text style={styles.emptyResetText}>إعادة الضبط</Text>
            </TouchableOpacity>
          </View>
        }
        onEndReached={() => {
          if (hasMore && !loading && !loadingMore) {
            fetchActivities(true);
          }
        }}
        onEndReachedThreshold={0.5}
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
          activity={selectedActivity}
          visible={detailsVisible}
          onClose={handleCloseDetails}
          onUndo={handleUndo}
          onNavigateToProfile={onNavigateToProfile}
          onOpenAdvanced={handleOpenAdvanced}
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
          setFiltersSheetVisible(false);
          setShowDateFilter(true);
        }}
        onOpenUser={() => {
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
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: tokens.colors.najdi.text,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.najdi.text,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filterChipTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: tokens.colors.najdi.container + "26",
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + "26",
  },
  activitySummary: {
    fontSize: 17,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  activityTime: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  diffPreview: {
    marginTop: 10,
  },
  fieldsCountText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  cardActions: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoIconButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.crimson + "15",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    textAlign: "center",
  },
  emptyReset: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.crimson,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
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
    width: 42,
    height: 4,
    borderRadius: 2,
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
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetTimestamp: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetSeverity: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sheetSeverityText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetSection: {
    gap: 10,
  },
  sheetSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetValue: {
    fontSize: 17,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetValueMuted: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  changeBullet: {
    fontSize: 18,
    color: tokens.colors.najdi.crimson,
    marginTop: -2,
  },
  changeContent: {
    flex: 1,
    gap: 4,
  },
  changeFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  changeFieldValue: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  advancedLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
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
    color: tokens.colors.najدي.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetUndoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 12,
    paddingVertical: 12,
  },
  sheetUndoText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedContainer: {
    gap: 16,
  },
  advancedRow: {
    gap: 4,
  },
  advancedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedValue: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
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
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  filtersSheetBackdrop: {
    flex: 1,
  },
  filtersSheetContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  filtersSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetReset: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetSection: {
    gap: 12,
  },
  filtersSheetLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filtersSheetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
  },
  filtersSheetChipActive: {
    backgroundColor: tokens.colors.najdi.text,
  },
  filtersSheetChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetChipTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  filtersSheetChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
  },
  filtersSheetChipSmallActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  filtersSheetChipTextSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetChipTextSmallActive: {
    color: tokens.colors.najdi.alJass,
  },
  filtersSheetRowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.najdi.container,
  },
  filtersSheetRowButtonText: {
    fontSize: 15,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filtersSheetDone: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.text,
    paddingVertical: 12,
    alignItems: "center",
  },
  filtersSheetDoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  advancedModalContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
});
