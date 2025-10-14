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
import {
  getFieldLabel,
  groupFieldsByCategory,
} from "../../services/activityLogTranslations";
import { formatRelativeTime } from "../../utils/formatTimestamp";
import UserFilterModal from "../../components/admin/UserFilterModal";
import DateRangePickerModal from "../../components/admin/DateRangePickerModal";
import { useAuth } from "../../contexts/AuthContext";
import undoService from "../../services/undoService";
import { useUndoStore } from "../../stores/undoStore";
import Toast from "../../components/ui/Toast";

const colors = {
  ...tokens.colors.najdi,
  success: tokens.colors.success,
  danger: tokens.colors.danger,
  warning: "#FF9800",
  error: "#FF3B30",
  info: tokens.colors.accent,
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
  high: {
    label: "عالي",
    color: "#D58C4A",
    text: "#F9F7F3",
  },
  critical: {
    label: "حرج",
    color: tokens.colors.najdi.crimson,
    text: "#F9F7F3",
  },
};

const formatValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }
  if (typeof value === "string" && value.length > 80) {
    return value.substring(0, 80) + "…";
  }
  return String(value);
};

const formatAbsoluteTimestamp = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = parseISO(timestamp);
    if (isToday(date)) {
      return `اليوم ${format(date, "h:mm a", { locale: ar })}`;
    }
    if (isYesterday(date)) {
      return `أمس ${format(date, "h:mm a", { locale: ar })}`;
    }
    return format(date, "d MMMM yyyy h:mm a", { locale: ar });
  } catch (error) {
    return timestamp;
  }
};

const getSeverityBadge = (severity) => {
  const key = severity?.toLowerCase?.();
  return key && SEVERITY_BADGES[key] ? SEVERITY_BADGES[key] : null;
};

const buildActivitySummary = (activity) => {
  const actorName = activity.actor_name_current || activity.actor_name_historical || "مستخدم";
  const targetName =
    activity.target_name_current || activity.target_name_historical || "الملف";
  const actionConfig = ACTION_CONFIGS[activity.action_type] || ACTION_CONFIGS.default;
  const changedFieldsCount = activity.changed_fields?.length || 0;

  if (changedFieldsCount > 1) {
    return `${actorName} حدّث ${changedFieldsCount} حقول في ${targetName}`;
  }

  if (changedFieldsCount === 1) {
    const fieldLabel = getFieldLabel(activity.changed_fields[0]);
    return `${actorName} حدّث ${fieldLabel} في ${targetName}`;
  }

  return `${actorName} ${actionConfig.label} ${targetName}`;
};

const getPrimaryField = (activity) => {
  const changed = activity.changed_fields || [];
  if (!changed.length) return null;
  const metadataFields = ["version", "updated_at", "created_at"];
  return changed.find((field) => !metadataFields.includes(field)) || changed[0];
};

const formatRelativeSince = (timestamp) => {
  if (!timestamp) return "";
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true, locale: ar });
  } catch (error) {
    return timestamp;
  }
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
    return str
      .split(/\s+/)
      .filter((p) => p.length > 0);
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
        try {
          if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onNavigate(profileId);
        } catch (error) {
          console.error("[SmartNameDisplay] Navigation error", error);
        }
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

const StatusHeader = ({ stats, latestTimestamp, onShowCritical, onShowToday, onClose }) => {
  const lastActivity = latestTimestamp ? formatRelativeTime(latestTimestamp) : "لا توجد أنشطة";

  return (
    <View style={styles.statusHeader}>
      <View style={styles.headerTopRow}>
        <Image
          source={require("../../../assets/logo/AlqefariEmblem.png")}
          style={styles.emblem}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>سجل النشاط</Text>
          <Text style={styles.screenSubtitle}>آخر تحديث {lastActivity}</Text>
        </View>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={24} color={tokens.colors.najdi.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.statusCardsRow}>
        <StatusCard
          label="اليوم"
          value={stats.today}
          onPress={onShowToday}
        />
        <StatusCard
          label="حرج"
          value={stats.critical}
          highlight
          onPress={onShowCritical}
        />
        <StatusCard label="الإجمالي" value={stats.total} />
        <StatusCard label="مستخدمون" value={stats.users} />
      </View>
    </View>
  );
};

const StatusCard = ({ label, value, onPress, highlight }) => {
  return (
    <TouchableOpacity
      style={[styles.statusCard, highlight && styles.statusCardHighlight]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.statusCardValue, highlight && styles.statusCardValueHighlight]}>
        {value}
      </Text>
      <Text style={[styles.statusCardLabel, highlight && styles.statusCardLabelHighlight]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const FiltersToolbar = ({
  categoryFilter,
  severityFilter,
  datePreset,
  selectedUser,
  onCategoryChange,
  onSeverityChange,
  onDatePress,
  onUserPress,
  onReset,
  searchText,
  onSearchChange,
}) => {
  return (
    <View style={styles.filtersToolbar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORY_OPTIONS.map((option) => {
          const isActive = categoryFilter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => onCategoryChange(option.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.toolbarRow}>
        <View style={styles.severityGroup}>
          {SEVERITY_OPTIONS.map((option) => {
            const isActive = severityFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.severityButton, isActive && styles.severityButtonActive]}
                onPress={() => onSeverityChange(option.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.severityButtonText, isActive && styles.severityButtonTextActive]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={onDatePress}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar" size={16} color={tokens.colors.najdi.text} />
          <Text style={styles.dateButtonText}>{getDatePresetLabel(datePreset)}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbarRow}>
        <TouchableOpacity
          style={[styles.userChip, selectedUser && styles.userChipActive]}
          onPress={onUserPress}
          activeOpacity={0.75}
        >
          <Ionicons
            name="person"
            size={14}
            color={selectedUser ? tokens.colors.najdi.alJass : tokens.colors.najdi.text}
          />
          <Text style={[styles.userChipText, selectedUser && styles.userChipTextActive]}>
            {selectedUser ? selectedUser.actor_name : "تصفية حسب المستخدم"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.75}>
          <Ionicons name="refresh" size={14} color={tokens.colors.najdi.crimson} />
          <Text style={styles.resetButtonText}>إعادة الضبط</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={tokens.colors.najdi.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالاسم، الهاتف أو النشاط"
          placeholderTextColor={tokens.colors.najdi.textMuted}
          value={searchText}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")}>
            <Ionicons name="close-circle" size={18} color={tokens.colors.najdi.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const ActivityListCard = ({ activity, onPress, onUndo }) => {
  const summary = buildActivitySummary(activity);
  const relativeTime = formatRelativeSince(activity.created_at);
  const changedFields = activity.changed_fields || [];
  const primaryField = getPrimaryField(activity);
  const severityBadge = getSeverityBadge(activity.severity);
  const showUndo = activity.is_undoable === true && !activity.undone_at;

  return (
    <TouchableOpacity style={styles.activityCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.activitySummary} numberOfLines={2}>
          {summary}
        </Text>
        <View style={styles.activityMetaRow}>
          <Text style={styles.activityTime}>{relativeTime}</Text>
          {severityBadge && (
            <View style={[styles.severityPill, { backgroundColor: severityBadge.color }]}>
              <Text style={[styles.severityPillText, { color: severityBadge.text }]}>
                {severityBadge.label}
              </Text>
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

const ActivityDetailsSheet = ({
  activity,
  visible,
  onClose,
  onUndo,
  onNavigateToProfile,
  showAdvanced,
  onToggleAdvanced,
}) => {
  const changedFields = activity?.changed_fields || [];
  const groupedChanges = useMemo(() => groupFieldsByCategory(changedFields), [changedFields]);

  if (!activity) return null;

  const severityBadge = getSeverityBadge(activity.severity);
  const summary = buildActivitySummary(activity);
  const actorName = activity.actor_name_current || activity.actor_name_historical;
  const targetName = activity.target_name_current || activity.target_name_historical;
  const showUndo = activity.is_undoable === true && !activity.undone_at;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandleRow}>
            <View style={styles.sheetHandle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            <Text style={styles.sheetTitle}>{summary}</Text>
            <Text style={styles.sheetTimestamp}>{formatAbsoluteTimestamp(activity.created_at)}</Text>

            {severityBadge && (
              <View style={[styles.sheetSeverity, { backgroundColor: severityBadge.color }]}>
                <Text style={[styles.sheetSeverityText, { color: severityBadge.text }]}>
                  {severityBadge.label}
                </Text>
              </View>
            )}

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>المستخدم</Text>
              <Text style={styles.sheetValue}>{actorName || "—"}</Text>
              {activity.actor_phone && (
                <Text style={styles.sheetValueMuted}>{activity.actor_phone}</Text>
              )}
            </View>

            {targetName && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>الملف المتأثر</Text>
                <SmartNameDisplay
                  historicalName={activity.target_name_historical}
                  currentName={activity.target_name_current}
                  profileId={activity.target_profile_id}
                  onNavigate={onNavigateToProfile}
                  style={styles.sheetValue}
                />
                {activity.target_phone && (
                  <Text style={styles.sheetValueMuted}>{activity.target_phone}</Text>
                )}
              </View>
            )}

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>تفاصيل التغييرات</Text>
              {changedFields.length === 0 && (
                <Text style={styles.sheetValueMuted}>لا توجد تفاصيل إضافية</Text>
              )}

              {Object.entries(groupedChanges).map(([categoryKey, category]) => (
                <View key={categoryKey} style={styles.sheetCategoryBlock}>
                  <Text style={styles.sheetCategoryTitle}>{category.label}</Text>
                  {category.fields.map((field) => (
                    <View key={field} style={styles.sheetFieldRow}>
                      <Text style={styles.sheetFieldLabel}>{getFieldLabel(field)}</Text>
                      <InlineDiff
                        field={field}
                        oldValue={activity.old_data?.[field]}
                        newValue={activity.new_data?.[field]}
                        showLabels
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>سياق إضافي</Text>
              {activity.description && (
                <Text style={styles.sheetValue}>{activity.description}</Text>
              )}
              <Text style={styles.sheetValueMuted}>{`تم منذ ${formatRelativeSince(activity.created_at)}`}</Text>
            </View>

            <View style={styles.sheetSection}>
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={onToggleAdvanced}
                activeOpacity={0.75}
              >
                <Text style={styles.advancedToggleText}>معلومات متقدمة</Text>
                <Ionicons
                  name={showAdvanced ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={tokens.colors.najdi.text}
                />
              </TouchableOpacity>
              {showAdvanced && <AdvancedDetails activity={activity} />}
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetCloseButton} onPress={onClose} activeOpacity={0.75}>
              <Text style={styles.sheetCloseText}>إغلاق</Text>
            </TouchableOpacity>
            {showUndo && (
              <TouchableOpacity
                style={styles.sheetUndoButton}
                onPress={() => onUndo(activity)}
                activeOpacity={0.8}
              >
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
          <Text style={styles.advancedValue}>{formatValue(row.value)}</Text>
        </View>
      ))}

      <View style={styles.advancedJsonBlock}>
        <Text style={styles.advancedLabel}>البيانات الجديدة</Text>
        <ScrollView style={styles.jsonScroll} horizontal>
          <Text style={styles.jsonText}>
            {JSON.stringify(activity.new_data || {}, null, 2)}
          </Text>
        </ScrollView>
      </View>

      <View style={styles.advancedJsonBlock}>
        <Text style={styles.advancedLabel}>البيانات السابقة</Text>
        <ScrollView style={styles.jsonScroll} horizontal>
          <Text style={styles.jsonText}>
            {JSON.stringify(activity.old_data || {}, null, 2)}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

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

const ActivityLogSkeleton = () => (
  <SafeAreaView style={styles.container}>
    <View style={styles.statusHeader}>
      <SkeletonLoader width="100%" height={48} borderRadius={12} />
      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <SkeletonLoader width="25%" height={64} borderRadius={12} />
        <SkeletonLoader width="25%" height={64} borderRadius={12} />
        <SkeletonLoader width="25%" height={64} borderRadius={12} />
      </View>
    </View>
    <View style={styles.filtersToolbar}>
      <SkeletonLoader width="100%" height={36} borderRadius={18} style={{ marginBottom: 12 }} />
      <SkeletonLoader width="100%" height={36} borderRadius={12} style={{ marginBottom: 12 }} />
      <SkeletonLoader width="100%" height={44} borderRadius={12} />
    </View>
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <SkeletonLoader width="60%" height={16} borderRadius={4} />
      <SkeletonLoader width="100%" height={96} borderRadius={16} />
      <SkeletonLoader width="100%" height={96} borderRadius={16} />
    </View>
  </SafeAreaView>
);

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

  const [datePreset, setDatePreset] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();

  const requestIdRef = useRef(0);
  const statsRequestIdRef = useRef(0);
  const selectedUserRef = useRef(selectedUser);
  const datePresetRef = useRef(datePreset);
  const customDateRangeRef = useRef({ from: customDateFrom, to: customDateTo });
  const categoryFilterRef = useRef(categoryFilter);
  const severityFilterRef = useRef(severityFilter);

  const [stats, setStats] = useState({ total: 0, today: 0, critical: 0, users: 0 });

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    datePresetRef.current = datePreset;
    customDateRangeRef.current = { from: customDateFrom, to: customDateTo };
    categoryFilterRef.current = categoryFilter;
    severityFilterRef.current = severityFilter;
  }, [
    selectedUser,
    datePreset,
    customDateFrom,
    customDateTo,
    categoryFilter,
    severityFilter,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

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

  const fetchStats = useCallback(async () => {
    statsRequestIdRef.current += 1;
    const currentRequestId = statsRequestIdRef.current;

    try {
      const dateRange = datePreset === "custom"
        ? { start: customDateFrom, end: customDateTo }
        : getDateRangeForPreset(datePreset);

      const { data, error } = await supabase.rpc("get_activity_stats", {
        p_user_filter: selectedUser?.actor_id || null,
        p_date_from: dateRange.start?.toISOString() || null,
        p_date_to: dateRange.end?.toISOString() || null,
        p_action_filter: null,
      });

      if (currentRequestId !== statsRequestIdRef.current) {
        return;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        setStats({
          total: parseInt(result.total_count, 10) || 0,
          today: parseInt(result.today_count, 10) || 0,
          critical: parseInt(result.critical_count, 10) || 0,
          users: parseInt(result.users_count, 10) || 0,
        });
      }
    } catch (error) {
      if (currentRequestId === statsRequestIdRef.current) {
        console.error("Error fetching stats:", error);
      }
    }
  }, [selectedUser, datePreset, customDateFrom, customDateTo]);

  useEffect(() => {
    fetchActivities(false);
    fetchStats();

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
  }, [fetchActivities, fetchStats, showToast]);

  useEffect(() => {
    setPage(0);
    fetchActivities(false);
    fetchStats();
  }, [selectedUser, datePreset, customDateFrom, customDateTo]);

  useEffect(() => {
    let filtered = [...activities];

    if (categoryFilter !== "all") {
      filtered = filtered.filter((activity) => matchesCategoryFilter(activity, categoryFilter));
    }

    if (severityFilter === "high") {
      filtered = filtered.filter((activity) =>
        activity.severity === "high" || activity.severity === "critical"
      );
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
        data: data.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }))
      .sort((a, b) => {
        const first = a.data[0];
        const second = b.data[0];
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
  }, [filteredActivities]);

  const latestActivityTimestamp = activities.length > 0 ? activities[0].created_at : null;

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
    setShowAdvancedDetails(false);
    setDetailsVisible(true);
  };

  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setSelectedActivity(null);
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
      <StatusHeader
        stats={stats}
        latestTimestamp={latestActivityTimestamp}
        onShowCritical={() => setSeverityFilter("critical")}
        onShowToday={() => setDatePreset("today")}
        onClose={onClose}
      />

      <FiltersToolbar
        categoryFilter={categoryFilter}
        severityFilter={severityFilter}
        datePreset={datePreset}
        selectedUser={selectedUser}
        onCategoryChange={setCategoryFilter}
        onSeverityChange={setSeverityFilter}
        onDatePress={() => setShowDateFilter(true)}
        onUserPress={() => setShowUserFilter(true)}
        onReset={handleResetFilters}
        searchText={searchText}
        onSearchChange={setSearchText}
      />

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityListCard
            activity={item}
            onPress={() => handleOpenDetails(item)}
            onUndo={handleUndo}
          />
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
          showAdvanced={showAdvancedDetails}
          onToggleAdvanced={() => setShowAdvancedDetails((prev) => !prev)}
        />
      )}

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

      <Toast visible={toastVisible} message={toastMessage} type={toastType} onDismiss={hideToast} />
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  statusHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: tokens.colors.najdi.background,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emblem: {
    width: 48,
    height: 48,
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
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  statusCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container + "26",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statusCardHighlight: {
    backgroundColor: tokens.colors.najdi.crimson,
  },
  statusCardValue: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  statusCardValueHighlight: {
    color: tokens.colors.najdi.alJass,
  },
  statusCardLabel: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  statusCardLabelHighlight: {
    color: tokens.colors.najdi.alJass,
  },
  filtersToolbar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: "transparent",
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.najdi.text,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  categoryChipTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  severityGroup: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    alignItems: "center",
  },
  severityButtonActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  severityButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  severityButtonTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: tokens.colors.najdi.container + "20",
  },
  dateButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  userChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
    backgroundColor: "transparent",
  },
  userChipActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  userChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  userChipTextActive: {
    color: tokens.colors.najdi.alJass,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.crimson,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  searchContainer: {
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
    marginBottom: 6,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityTime: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
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
    marginTop: 8,
  },
  fieldsCountText: {
    marginTop: 8,
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
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
    color: tokens.colors.najdi.textMuted,
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
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: tokens.colors.najdi.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  sheetHandleRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.najdi.textMuted + "55",
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
    color: tokens.colors.najdi.textMuted,
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
    gap: 8,
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
    color: tokens.colors.najdi.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetCategoryBlock: {
    gap: 12,
  },
  sheetCategoryTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sheetFieldRow: {
    gap: 8,
  },
  sheetFieldLabel: {
    fontSize: 13,
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
    color: tokens.colors.najdi.text,
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
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedContainer: {
    gap: 12,
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
    color: tokens.colors.najdi.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  advancedJsonBlock: {
    gap: 8,
  },
  jsonScroll: {
    maxHeight: 160,
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#D58C4A15",
  },
  nowBadgeText: {
    fontSize: 10,
    color: "#73637280",
    fontWeight: "600",
  },
});
