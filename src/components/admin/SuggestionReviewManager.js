import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
  RefreshControl,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import suggestionService from "../../services/suggestionService";
import * as Haptics from "expo-haptics";
import LargeTitleHeader from "../ios/LargeTitleHeader";
import tokens from "../../components/ui/tokens";
import SegmentedControl from "../ui/SegmentedControl";
import SkeletonLoader from "../ui/SkeletonLoader";
import { useNetworkGuard } from "../../hooks/useNetworkGuard";

// Najdi Sadu Design System Colors
const COLORS = {
  background: tokens.colors.najdi.background,
  container: tokens.colors.najdi.container,
  text: tokens.colors.najdi.text,
  primary: tokens.colors.najdi.primary,
  secondary: tokens.colors.najdi.secondary,
  textLight: tokens.colors.najdi.textMuted,
  textMedium: tokens.colors.textMuted,
  success: tokens.colors.success,
  error: tokens.colors.danger,
  warning: "#F59E0B",
};
const spacing = tokens.spacing;
const typography = tokens.typography;
const STATUS_STYLES = {
  approved: {
    background: `${tokens.colors.success}20`,
    color: tokens.colors.success,
    icon: "checkmark-circle",
    label: "مقبولة",
  },
  rejected: {
    background: `${tokens.colors.danger}20`,
    color: tokens.colors.danger,
    icon: "close-circle",
    label: "مرفوض",
  },
  pending: {
    background: `${tokens.colors.najdi.secondary}20`,
    color: tokens.colors.najdi.secondary,
    icon: "time-outline",
    label: "قيد المراجعة",
  },
};

const SuggestionReviewManager = ({ onClose, onBack }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const tabs = [
    { id: "pending", label: "قيد المراجعة" },
    { id: "approved", label: "مقبولة" },
    { id: "rejected", label: "مرفوضة" },
  ];

  // Network guard for offline protection
  const { checkBeforeAction } = useNetworkGuard();

  useEffect(() => {
    loadSuggestions({ useOverlay: !initialLoading });
    loadStats();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from("profile_edit_suggestions")
        .select("status", { count: "exact" });

      if (!error && data) {
        const counts = {
          pending: 0,
          approved: 0,
          rejected: 0,
        };

        data.forEach((item) => {
          if (counts[item.status] !== undefined) {
            counts[item.status]++;
          }
        });

        setStats(counts);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadSuggestions = async ({ useOverlay = false } = {}) => {
    if (!initialLoading && useOverlay) {
      setIsFetching(true);
    }
    try {
      const query = supabase
        .from("profile_edit_suggestions")
        .select(
          `
          *,
          profile:profile_id(id, name, hid),
          suggester:submitter_id(id, name)
        `
        )
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query.eq("status", activeTab);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setSuggestions(data || []);
    } catch (error) {
      console.error("Error loading suggestions:", error);
      Alert.alert("خطأ", "فشل في تحميل الاقتراحات");
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (suggestion) => {
    // Network guard: prevent action if offline
    if (!await checkBeforeAction('قبول الاقتراح')) return;

    try {
      await suggestionService.approveSuggestion(suggestion.id);

      Alert.alert("نجاح", "تم قبول الاقتراح وتطبيقه");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadSuggestions();
      loadStats();
    } catch (error) {
      console.error("Error approving suggestion:", error);
      Alert.alert("خطأ", "فشل في قبول الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleReject = async (suggestion, reason) => {
    // Network guard: prevent action if offline
    if (!await checkBeforeAction('رفض الاقتراح')) return;

    try {
      await suggestionService.rejectSuggestion(
        suggestion.id,
        reason || "لا يتوافق مع البيانات المؤكدة"
      );

      Alert.alert("تم", "تم رفض الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadSuggestions();
      loadStats();
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      Alert.alert("خطأ", "فشل في رفض الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const confirmApprove = (suggestion) => {
    Alert.alert(
      "تأكيد القبول",
      `هل تريد قبول تغيير "${getFieldLabel(suggestion.field_name)}" من "${
        suggestion.old_value ?? "فارغ"
      }" إلى "${suggestion.new_value ?? ""}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "قبول",
          style: "default",
          onPress: () => handleApprove(suggestion),
        },
      ]
    );
  };

  const confirmReject = (suggestion) => {
    Alert.alert(
      "تأكيد الرفض",
      "هل تريد رفض هذا الاقتراح؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "رفض",
          style: "destructive",
          onPress: () => handleReject(suggestion),
        },
      ]
    );
  };

  const getFieldLabel = (field) => {
    const labels = {
      name: "الاسم",
      bio: "السيرة الذاتية",
      phone: "رقم الهاتف",
      email: "البريد الإلكتروني",
      current_residence: "مكان الإقامة",
      occupation: "المهنة",
      education: "التعليم",
    };
    return labels[field] || field;
  };

  const getStatusMeta = (status) => {
    return (
      STATUS_STYLES[status] || {
        background: `${COLORS.container}20`,
        color: COLORS.textMedium,
        icon: "information-circle",
        label: status,
      }
    );
  };

  const renderSuggestion = ({ item: suggestion }) => {
    const statusMeta = getStatusMeta(suggestion.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {suggestion.profile?.name || "غير معروف"}
            </Text>
            <Text style={styles.profileMeta}>
              اقترح بواسطة: {suggestion.suggester?.name || "غير معروف"}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusMeta.background },
            ]}
          >
            <Ionicons name={statusMeta.icon} size={16} color={statusMeta.color} />
            <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <View style={styles.diffContainer}>
          <View style={styles.diffHeader}>
            <Text style={styles.fieldLabel}>{getFieldLabel(suggestion.field_name)}</Text>
            <Text style={styles.dateText}>
              {new Date(`${suggestion.created_at  }Z`).toLocaleDateString("ar-SA")}
            </Text>
          </View>
          <View style={styles.diffValues}>
            <View style={styles.valuePillOld}>
              <Text style={styles.valueOldText} numberOfLines={1}>
                {suggestion.old_value ?? "فارغ"}
              </Text>
            </View>
            <Ionicons
              name="chevron-back"
              size={16}
              color={COLORS.textMedium}
              style={styles.diffArrow}
            />
            <View style={styles.valuePillNew}>
              <Text style={styles.valueNewText} numberOfLines={1}>
                {suggestion.new_value ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {suggestion.reason && (
          <View style={styles.noteRow}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={COLORS.textLight}
            />
            <Text style={styles.noteText} numberOfLines={2}>
              {suggestion.reason}
            </Text>
          </View>
        )}

        {suggestion.status === "rejected" && suggestion.rejection_reason && (
          <View style={styles.noteRowError}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={COLORS.error}
            />
            <Text style={styles.rejectionReason}>
              سبب الرفض: {suggestion.rejection_reason}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.footerMeta}>
            ملف: {suggestion.profile?.hid ? `#${suggestion.profile.hid}` : "غير معروف"}
          </Text>
          <Text style={styles.footerMeta}>
            {new Date(`${suggestion.created_at  }Z`).toLocaleTimeString("ar-SA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {suggestion.status === "pending" && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.secondaryButton]}
              onPress={() => confirmReject(suggestion)}
            >
              <Ionicons name="close" size={18} color={COLORS.error} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.error }]}>
                رفض
              </Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => confirmApprove(suggestion)}
            >
              <Ionicons name="checkmark" size={18} color={COLORS.background} />
              <Text style={styles.primaryButtonText}>قبول</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LargeTitleHeader
        title="الاقتراحات"
        emblemSource={require('../../../assets/logo/AlqefariEmblem.png')}
        rightSlot={
          <TouchableOpacity
            onPress={onClose || onBack}
            style={styles.backButton}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
        }
      />

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>قيد المراجعة</Text>
          <Text style={styles.statValue}>{stats.pending}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>مقبولة</Text>
          <Text style={styles.statValue}>{stats.approved}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>مرفوضة</Text>
          <Text style={styles.statValue}>{stats.rejected}</Text>
        </View>
      </View>

      {/* Content */}
      {initialLoading ? (
        <View style={styles.loadingContainer}>
          {[...Array(3)].map((_, index) => (
            <View key={`skeleton-${index}`} style={styles.skeletonCard}>
              <SkeletonLoader height={20} style={{ marginBottom: spacing.xs }} />
              <SkeletonLoader height={12} width="70%" style={{ marginBottom: spacing.sm }} />
              <SkeletonLoader height={42} borderRadius={tokens.radii.md} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={renderSuggestion}
            contentContainerStyle={[
              styles.listContent,
              suggestions.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadSuggestions({ useOverlay: true });
                  loadStats();
                }}
                tintColor={COLORS.primary}
              />
            }
            getItemLayout={(data, index) => ({
              length: 140,
              offset: 140 * index + 12 * index,
              index,
            })}
            windowSize={5}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            removeClippedSubviews={true}
            ListHeaderComponent={
              <View>
                <View style={styles.inlineSkeletonContainer}>
                  {isFetching && (
                    <View style={styles.inlineSkeleton}>
                      <SkeletonLoader height={16} width="60%" style={{ marginBottom: spacing.xs }} />
                      <SkeletonLoader height={12} width="80%" />
                    </View>
                  )}
                </View>
                <View style={styles.listHeaderSpacer} />
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyCard}>
                  <Image
                    source={require("../../../assets/logo/AlqefariEmblem.png")}
                    style={styles.emptyEmblem}
                    resizeMode="contain"
                  />
                  <Text style={styles.emptyTitle}>ما فيه اقتراحات حالياً</Text>
                  <Text style={styles.emptySubtitle}>
                    كل التعديلات تمت مراجعتها. ارجع لاحقاً أو حدث القائمة.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setRefreshing(true);
                      loadSuggestions({ useOverlay: true });
                      loadStats();
                    }}
                    style={({ pressed }) => [
                      styles.emptyAction,
                      pressed && styles.emptyActionPressed,
                    ]}
                  >
                    <Text style={styles.emptyActionText}>تحديث القائمة</Text>
                  </Pressable>
                </View>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  segmentedControlContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: COLORS.background,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statChip: {
    flex: 1,
    backgroundColor: `${COLORS.container}20`,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container}40`,
  },
  statLabel: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }99`,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: COLORS.text,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingTop: spacing.lg,
  },
  listHeaderSpacer: {
    height: spacing.lg,
  },
  listWrapper: {
    flex: 1,
    position: "relative",
  },
  card: {
    backgroundColor: "white",
    borderRadius: tokens.radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container}40`,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },

  // Card header
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  profileInfo: {
    flex: 1,
    marginEnd: spacing.sm,
  },
  profileName: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: COLORS.text,
    fontWeight: "600",
  },
  profileMeta: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }99`,
    marginTop: spacing.xs / 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: tokens.radii.md,
    gap: spacing.xs / 2,
  },
  statusPillText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },

  // Diff section
  diffContainer: {
    backgroundColor: `${COLORS.container}20`,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container}40`,
    marginBottom: spacing.sm,
  },
  diffHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: COLORS.text,
    fontWeight: "600",
  },
  diffValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  valuePillOld: {
    flex: 1,
    borderRadius: tokens.radii.md,
    backgroundColor: COLORS.background,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  valuePillNew: {
    flex: 1,
    borderRadius: tokens.radii.md,
    backgroundColor: `${COLORS.primary  }15`,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  valueOldText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }AA`,
  },
  valueNewText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: COLORS.primary,
    fontWeight: "600",
  },
  diffArrow: {
    transform: [{ scaleX: -1 }],
  },

  // Notes
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  noteRowError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: `${COLORS.error}20`,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  noteText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }99`,
    flex: 1,
  },
  rejectionReason: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: COLORS.error,
    flex: 1,
  },

  // Timer Row
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: `${COLORS.secondary}20`,
    padding: spacing.xs,
    borderRadius: tokens.radii.md,
    marginTop: spacing.xs,
  },
  timerText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: COLORS.secondary,
    flex: 1,
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${COLORS.container}40`,
    paddingTop: spacing.xs,
    marginTop: spacing.sm,
  },
  footerMeta: {
    ...typography.caption1,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }80`,
  },
  dateText: {
    ...typography.caption1,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }66`,
  },

  // Actions
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: COLORS.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: COLORS.background,
    fontWeight: "600",
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.error}66`,
    paddingVertical: spacing.sm,
    backgroundColor: `${COLORS.error}12`,
  },
  secondaryButtonText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  skeletonCard: {
    width: "90%",
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container}40`,
    marginBottom: spacing.md,
  },
  inlineSkeletonContainer: {
    height: spacing.lg,
    justifyContent: "center",
  },
  inlineSkeleton: {
    paddingHorizontal: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyCard: {
    width: "80%",
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.container}40`,
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmblem: {
    width: 48,
    height: 48,
    tintColor: COLORS.primary,
  },
  emptyTitle: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: COLORS.text,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: `${COLORS.text  }99`,
    textAlign: "center",
    lineHeight: typography.subheadline.lineHeight,
  },
  emptyAction: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}66`,
    backgroundColor: COLORS.background,
  },
  emptyActionPressed: {
    backgroundColor: `${COLORS.primary}10`,
  },
  emptyActionText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: COLORS.primary,
    fontWeight: "600",
  },
  backButton: {
    padding: 8,
  },
});

export default SuggestionReviewManager;
