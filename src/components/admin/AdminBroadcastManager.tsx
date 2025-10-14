/**
 * Admin Broadcast Manager
 *
 * Unified interface for creating and managing broadcast notifications
 * Combines composer and history in one cohesive iOS-inspired design
 * Follows Najdi Sadu design system
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Image,
  FlatList,
  I18nManager,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import tokens from '../ui/tokens';
import SkeletonLoader from '../ui/SkeletonLoader';
import {
  previewBroadcastRecipients,
  createBroadcast,
  getBroadcastHistory,
  validateBroadcastCriteria,
  getTargetingLabel,
  getPriorityIcon,
  getPriorityColor,
} from '../../services/broadcastNotifications';
import type { BroadcastCriteria, BroadcastHistoryItem } from '../../types/notifications';

// ============================================================================
// TYPES
// ============================================================================

interface AdminBroadcastManagerProps {
  onClose: () => void;
}

type TargetingType = 'all' | 'role' | 'gender';
type Importance = 'normal' | 'high' | 'urgent';

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminBroadcastManager({ onClose }: AdminBroadcastManagerProps) {
  const insets = useSafeAreaInsets();
  const dismissIcon = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

  // ========== COMPOSE STATE ==========
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [importance, setImportance] = useState<Importance>('normal');
  const [roleFilterEnabled, setRoleFilterEnabled] = useState(false);
  const [genderFilterEnabled, setGenderFilterEnabled] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [resolvedCriteria, setResolvedCriteria] = useState<BroadcastCriteria>({ type: 'all' });

  // ========== HISTORY STATE ==========
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ========== VALIDATION ==========
  const titleValid = title.trim().length >= 3 && title.length <= 200;
  const bodyValid = body.trim().length >= 10 && body.length <= 1000;
  const canSend =
    titleValid &&
    bodyValid &&
    recipientCount > 0 &&
    !sending &&
    previewState === 'ready';

  // ========== LOAD HISTORY ==========
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const { data, error } = await getBroadcastHistory(20, 0);
      if (error) {
        setHistory([]);
        setHistoryError(error.message || 'تعذر تحميل سجل الإشعارات');
      } else if (data) {
        setHistory(data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setHistory([]);
      setHistoryError('حدث خطأ أثناء تحميل سجل الإشعارات');
    } finally {
      setLoadingHistory(false);
    }
  };

  const roleOptions = [
    { value: 'super_admin', label: 'مشرف رئيسي' },
    { value: 'admin', label: 'مسؤول' },
    { value: 'moderator', label: 'مشرف فرع' },
    { value: 'user', label: 'مستخدم' },
  ];

  const genderOptions = [
    { value: 'male', label: 'ذكور' },
    { value: 'female', label: 'إناث' },
  ];

  const handleFilterChange = (value: TargetingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value === 'all') {
      setRoleFilterEnabled(false);
      setGenderFilterEnabled(false);
      setSelectedRoles([]);
      setSelectedGenders([]);
      setResolvedCriteria({ type: 'all' });
      return;
    }

    if (value === 'role') {
      const next = !roleFilterEnabled;
      setRoleFilterEnabled(next);
      if (!next && !genderFilterEnabled) {
        // Revert to all when no filters are active
        setSelectedRoles([]);
        setSelectedGenders([]);
      }
      return;
    }

    if (value === 'gender') {
      const next = !genderFilterEnabled;
      setGenderFilterEnabled(next);
      if (!next && !roleFilterEnabled) {
        setSelectedRoles([]);
        setSelectedGenders([]);
      }
    }
  };

  const renderMultiSelect = (
    options: { value: string; label: string }[],
    selectedValues: string[],
    toggleValue: (value: string) => void
  ) => (
    <View style={styles.multiSelectGrid}>
      {options.map((option) => {
        const active = selectedValues.includes(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.multiSelectChip, active && styles.multiSelectChipActive]}
            onPress={() => toggleValue(option.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={option.label}
            activeOpacity={0.85}
          >
            <Ionicons
              name={active ? 'checkbox' : 'square-outline'}
              size={18}
              color={active ? '#FFFFFF' : tokens.colors.najdi.text}
            />
            <Text style={[styles.multiSelectLabel, active && styles.multiSelectLabelActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const historyListData = history;
  const listExtraData = useMemo(
    () => ({ expandedCardId, previewState, recipientCount, history, loadingHistory, historyError }),
    [expandedCardId, previewState, recipientCount, history, loadingHistory, historyError]
  );

  const renderHistoryItem: ListRenderItem<BroadcastHistoryItem> = ({ item }) => {
    const isExpanded = expandedCardId === item.id;

    return (
      <TouchableOpacity
        style={styles.historyCard}
        onPress={() => toggleCardExpanded(item.id)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`إشعار بعنوان ${item.title}`}
      >
        <View style={styles.historyCardHeader}>
          <Ionicons
            name={getPriorityIcon(item.priority)}
            size={20}
            color={getPriorityColor(item.priority)}
          />
          <Text style={styles.historyCardTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        {!isExpanded && (
          <Text style={styles.historyCardPreview} numberOfLines={2}>
            {item.body}
          </Text>
        )}

        <View style={styles.historyStats}>
          <View style={styles.historyStat}>
            <Text style={styles.historyStatValue}>{item.total_recipients}</Text>
            <Text style={styles.historyStatLabel}>مستلم</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStat}>
            <Text style={styles.historyStatValue}>{item.read_count}</Text>
            <Text style={styles.historyStatLabel}>تمت قراءته</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStat}>
            <Text
              style={[styles.historyStatValue, { color: getReadColor(item.read_percentage) }]}
            >
              {item.read_percentage.toFixed(0)}%
            </Text>
            <Text style={styles.historyStatLabel}>نسبة القراءة</Text>
          </View>
        </View>

        <View style={styles.historyProgressContainer}>
          <View
            style={[
              styles.historyProgressFill,
              {
                width: `${item.read_percentage}%`,
                backgroundColor: getReadColor(item.read_percentage),
              },
            ]}
          />
        </View>

        <View style={styles.historyFooter}>
          <Text style={styles.historyTimestamp}>{formatRelativeTime(item.sent_at)}</Text>
          <View
            style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}
          >
            <Text style={styles.priorityBadgeText}>{getImportanceLabel(item.priority)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.historyExpandedSection}>
            <View style={styles.historyDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>النص الكامل</Text>
              <Text style={styles.detailValue}>{item.body}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>المستهدفون</Text>
              <Text style={styles.detailValue}>{getTargetingLabel(item.target_criteria)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>المرسل</Text>
              <Text style={styles.detailValue}>{item.sender_name}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHistoryEmpty = () => {
    if (loadingHistory) {
      return (
        <View style={styles.historySkeletonContainer}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.historySkeletonCard}>
              <SkeletonLoader width="60%" height={18} style={styles.historySkeletonLine} />
              <SkeletonLoader width="90%" height={12} style={styles.historySkeletonLine} />
              <SkeletonLoader width="45%" height={12} />
            </View>
          ))}
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.historyError}>
          <Ionicons name="warning-outline" size={36} color={tokens.colors.danger} />
          <Text style={styles.historyErrorText}>{historyError}</Text>
          <TouchableOpacity
            style={styles.historyRetryButton}
            onPress={loadHistory}
            activeOpacity={0.85}
          >
            <Text style={styles.historyRetryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.historyEmpty}>
        <Ionicons name="newspaper-outline" size={48} color={tokens.colors.najdi.container} />
        <Text style={styles.historyEmptyTitle}>لا توجد إشعارات سابقة</Text>
        <Text style={styles.historyEmptySubtitle}>
          الإشعارات التي ترسلها ستظهر هنا
        </Text>
      </View>
    );
  };

  const renderPreviewStatus = () => {
    let icon = 'people-outline';
    let iconColor = tokens.colors.najdi.primary;
    let title = 'عدد المستلمين المتوقع';
    let subtitle: string | null = 'اختر طريقة الاستهداف لمعرفة العدد المتوقع';
    let containerStyle = styles.previewCardIdle;

    if (previewState === 'loading') {
      icon = 'time-outline';
      iconColor = tokens.colors.najdi.secondary;
      title = 'يتم تحديث عدد المستلمين';
      subtitle = recipientCount > 0 ? `حالياً: ${recipientCount} مستخدم` : 'سيظهر العدد خلال لحظات';
      containerStyle = styles.previewCardLoading;
    } else if (previewState === 'error') {
      icon = 'alert-circle-outline';
      iconColor = tokens.colors.danger;
      title = previewMessage || 'تعذر حساب المستلمين';
      subtitle = 'راجع المعايير أو حاول مجدداً';
      containerStyle = styles.previewCardError;
    } else if (previewState === 'ready') {
      icon = 'checkmark-circle';
      iconColor = tokens.colors.success;
      title = 'جاهز للإرسال';
      subtitle = `سيتم الإرسال إلى ${recipientCount} مستخدم`;
      containerStyle = styles.previewCardReady;
    }

    const badgeText = recipientCount > 0 ? `${recipientCount}` : '—';

    return (
      <View style={[styles.previewCard, containerStyle]}>
        <View style={styles.previewIconCircle}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle}>{title}</Text>
          {subtitle && <Text style={styles.previewSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.previewBadge}>
          <Text style={styles.previewBadgeText}>{badgeText}</Text>
        </View>
      </View>
    );
  };

  const renderComposeSections = () => {
    const roleSummary = selectedRoles.length
      ? selectedRoles
          .map((role) => roleOptions.find((option) => option.value === role)?.label || role)
          .join('، ')
      : 'اختر الأدوار المستهدفة';

    const genderSummary = selectedGenders.length
      ? selectedGenders
          .map((gender) => genderOptions.find((option) => option.value === gender)?.label || gender)
          .join(' و ')
      : 'حدد الجنس المستهدف';

    const roleSummaryDisplay = selectedRoles.length ? roleSummary : 'لم يتم اختيار أدوار بعد';
    const genderSummaryDisplay = selectedGenders.length ? genderSummary : 'لم يتم اختيار جنس بعد';

    const filterOptionData: Array<{
      value: TargetingType;
      title: string;
      icon: string;
      badge?: number;
    }> = [
      {
        value: 'all',
        title: 'كل الأعضاء',
        icon: 'people-outline',
      },
      {
        value: 'role',
        title: 'تحديد الأدوار',
        icon: 'briefcase-outline',
        badge: selectedRoles.length,
      },
      {
        value: 'gender',
        title: 'تحديد الجنس',
        icon: 'male-female-outline',
        badge: selectedGenders.length,
      },
    ];

    const totalBroadcasts = historyListData.length;
    const totalRecipients = historyListData.reduce((sum, item) => sum + item.total_recipients, 0);
    const averageReadRate = totalBroadcasts
      ? Math.round(
          historyListData.reduce((sum, item) => sum + item.read_percentage, 0) / totalBroadcasts
        )
      : 0;
    const lastBroadcast = historyListData[0];
    const lastSentLabel = lastBroadcast ? formatRelativeTime(lastBroadcast.sent_at) : '—';
    const allSelected = !roleFilterEnabled && !genderFilterEnabled;
    const summaryParts: string[] = [];
    if (roleFilterEnabled) {
      summaryParts.push(`الأدوار: ${roleSummaryDisplay}`);
    }
    if (genderFilterEnabled) {
      summaryParts.push(`الجنس: ${genderSummaryDisplay}`);
    }
    const summaryText = summaryParts.join(' • ');

    return (
      <View style={styles.composer}>
        <View style={styles.section}>
          <Text style={styles.label}>العنوان</Text>
          <TextInput
            style={[styles.input, !titleValid && title.length > 0 && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان الإشعار (3-200 حرف)"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            maxLength={200}
            accessibilityLabel="عنوان الإشعار"
          />
          <View style={styles.helperRow}>
            <Text style={styles.helperText}>{title.length}/200 حرف</Text>
            {!titleValid && title.length > 0 && (
              <Text style={styles.errorText}>الحد الأدنى 3 أحرف</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>نص الرسالة</Text>
          <TextInput
            style={[
              styles.input,
              styles.bodyInput,
              !bodyValid && body.length > 0 && styles.inputError,
            ]}
            value={body}
            onChangeText={setBody}
            placeholder="نص الرسالة (10-1000 حرف)"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
            accessibilityLabel="نص الرسالة"
          />
          <View style={styles.helperRow}>
            <Text style={styles.helperText}>{body.length}/1000 حرف</Text>
            {!bodyValid && body.length > 0 && (
              <Text style={styles.errorText}>الحد الأدنى 10 أحرف</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>تصفية المستلمين</Text>
          <Text style={styles.helperText}>ابدأ بالإرسال للجميع ثم قم بالتصفية عند الحاجة</Text>

          <View style={styles.filterChipRow}>
            {filterOptionData.map(({ value, title, icon, badge }) => {
              const isActive =
                value === 'all'
                  ? allSelected
                  : value === 'role'
                  ? roleFilterEnabled
                  : genderFilterEnabled;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => handleFilterChange(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${title}${badge ? ` (${badge})` : ''}`}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={icon as any}
                    size={18}
                    color={isActive ? '#FFFFFF' : tokens.colors.najdi.textMuted}
                  />
                  <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                    {title}
                  </Text>
                  {badge ? (
                    <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                      <Text
                        style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}
                      >
                        {badge}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {summaryText.length > 0 && (
            <View style={styles.filterSummaryRow}>
              <Ionicons name="funnel-outline" size={16} color={tokens.colors.najdi.textMuted} />
              <Text style={styles.filterSummaryText}>{summaryText}</Text>
              <TouchableOpacity
                onPress={() => handleFilterChange('all')}
                style={styles.filterClearButton}
                activeOpacity={0.8}
                accessibilityLabel="إزالة عوامل التصفية"
              >
                <Text style={styles.filterClearText}>مسح التصفية</Text>
              </TouchableOpacity>
            </View>
          )}

          {roleFilterEnabled && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>الأدوار المستهدفة</Text>
              {renderMultiSelect(roleOptions, selectedRoles, toggleRole)}
            </View>
          )}

          {genderFilterEnabled && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>الجنس المستهدف</Text>
              {renderMultiSelect(genderOptions, selectedGenders, toggleGender)}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>مستوى الأهمية</Text>
          <Text style={styles.helperText}>يحدد كيفية إبراز الإشعار للمستخدمين</Text>

          <View style={styles.importanceRow}>
            {(['normal', 'high', 'urgent'] as Importance[]).map((level) => {
              const active = importance === level;
              const iconMap: Record<Importance, string> = {
                normal: 'notifications-outline',
                high: 'alert-circle-outline',
                urgent: 'warning-outline',
              };
              const labelMap: Record<Importance, string> = {
                normal: 'عادية',
                high: 'مهمة',
                urgent: 'عاجلة',
              };

              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.importanceChip, active && styles.importanceChipActive]}
                  onPress={() => toggleImportance(level)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`أهمية ${labelMap[level]}`}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={iconMap[level] as any}
                    size={18}
                    color={active ? '#FFFFFF' : '#8E8E93'}
                  />
                  <Text style={[styles.importanceLabel, active && styles.importanceLabelActive]}>
                    {labelMap[level]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {renderPreviewStatus()}

        <View style={styles.section}>
          <View style={styles.historySectionHeader}>
            <Text style={styles.label}>سجل الإشعارات</Text>
            <Text style={styles.historySectionMeta}>
              {totalBroadcasts > 0 ? `آخر إرسال ${lastSentLabel}` : 'لم يتم إرسال إشعارات بعد'}
            </Text>
          </View>

          {loadingHistory && historyListData.length === 0 ? (
            <View style={styles.historySummarySkeleton}>
              <SkeletonLoader width="100%" height={72} borderRadius={tokens.radii.md} />
            </View>
          ) : (
            <View style={styles.historySummaryRow}>
              <View style={styles.historySummaryCard}>
                <Text style={styles.historySummaryValue}>{totalBroadcasts}</Text>
                <Text style={styles.historySummaryLabel}>إشعار مرسل</Text>
              </View>
              <View style={styles.historySummaryCard}>
                <Text style={styles.historySummaryValue}>{totalRecipients}</Text>
                <Text style={styles.historySummaryLabel}>إجمالي المستلمين</Text>
              </View>
              <View style={styles.historySummaryCard}>
                <Text style={styles.historySummaryValue}>{averageReadRate}%</Text>
                <Text style={styles.historySummaryLabel}>متوسط القراءة</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ========== PREVIEW RECIPIENTS (DEBOUNCED) ==========
  useEffect(() => {
    setPreviewState('loading');
    setPreviewMessage(null);
    const timer = setTimeout(() => {
      loadRecipientPreview();
    }, 300);

    return () => clearTimeout(timer);
  }, [roleFilterEnabled, genderFilterEnabled, selectedRoles, selectedGenders]);

  const loadRecipientPreview = async () => {
    setPreviewState('loading');
    setPreviewMessage(null);

    try {
      const rolesActive = roleFilterEnabled && selectedRoles.length > 0;
      const gendersActive = genderFilterEnabled && selectedGenders.length > 0;

      if (roleFilterEnabled && !rolesActive) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage('اختر دوراً واحداً على الأقل ضمن التصفية');
        setResolvedCriteria({ type: 'all' });
        return;
      }

      if (genderFilterEnabled && !gendersActive) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage('اختر جنساً واحداً على الأقل ضمن التصفية');
        setResolvedCriteria({ type: 'all' });
        return;
      }

      if (!rolesActive && !gendersActive) {
        const criteria: BroadcastCriteria = { type: 'all' };
        const validationError = validateBroadcastCriteria(criteria);
        if (validationError) {
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(validationError);
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const { data, error } = await previewBroadcastRecipients(criteria);
        if (error) {
          console.error('Preview error:', error);
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(error.message || 'تعذر تحميل المستلمين. حاول مرة أخرى.');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const count = data?.length || 0;
        setRecipientCount(count);
        if (count === 0) {
          setPreviewState('error');
          setPreviewMessage('لا يوجد مستلمون مطابقون للمعايير الحالية');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        setResolvedCriteria(criteria);
        setPreviewState('ready');
        return;
      }

      if (rolesActive && !gendersActive) {
        const criteria: BroadcastCriteria = { type: 'role', values: selectedRoles };
        const validationError = validateBroadcastCriteria(criteria);
        if (validationError) {
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(validationError);
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const { data, error } = await previewBroadcastRecipients(criteria);
        if (error) {
          console.error('Preview error:', error);
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(error.message || 'تعذر تحميل المستلمين. حاول مرة أخرى.');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const count = data?.length || 0;
        setRecipientCount(count);
        if (count === 0) {
          setPreviewState('error');
          setPreviewMessage('لا يوجد مستلمون مطابقون للأدوار المختارة');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        setResolvedCriteria(criteria);
        setPreviewState('ready');
        return;
      }

      if (!rolesActive && gendersActive) {
        const criteria: BroadcastCriteria = { type: 'gender', values: selectedGenders };
        const validationError = validateBroadcastCriteria(criteria);
        if (validationError) {
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(validationError);
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const { data, error } = await previewBroadcastRecipients(criteria);
        if (error) {
          console.error('Preview error:', error);
          setRecipientCount(0);
          setPreviewState('error');
          setPreviewMessage(error.message || 'تعذر تحميل المستلمين. حاول مرة أخرى.');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        const count = data?.length || 0;
        setRecipientCount(count);
        if (count === 0) {
          setPreviewState('error');
          setPreviewMessage('لا يوجد مستلمون مطابقون للجنس المختار');
          setResolvedCriteria({ type: 'all' });
          return;
        }

        setResolvedCriteria(criteria);
        setPreviewState('ready');
        return;
      }

      // Both roles and genders active
      const roleCriteria: BroadcastCriteria = { type: 'role', values: selectedRoles };
      const genderCriteria: BroadcastCriteria = { type: 'gender', values: selectedGenders };

      const validationRole = validateBroadcastCriteria(roleCriteria);
      const validationGender = validateBroadcastCriteria(genderCriteria);
      if (validationRole) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(validationRole);
        setResolvedCriteria({ type: 'all' });
        return;
      }
      if (validationGender) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(validationGender);
        setResolvedCriteria({ type: 'all' });
        return;
      }

      const [roleResponse, genderResponse] = await Promise.all([
        previewBroadcastRecipients(roleCriteria),
        previewBroadcastRecipients(genderCriteria),
      ]);

      if (roleResponse.error) {
        console.error('Preview error (role):', roleResponse.error);
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(roleResponse.error.message || 'تعذر تحميل المستلمين للأدوار المختارة');
        setResolvedCriteria({ type: 'all' });
        return;
      }
      if (genderResponse.error) {
        console.error('Preview error (gender):', genderResponse.error);
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(genderResponse.error.message || 'تعذر تحميل المستلمين للجنس المختار');
        setResolvedCriteria({ type: 'all' });
        return;
      }

      const roleRecipients = roleResponse.data || [];
      const genderRecipients = genderResponse.data || [];
      const genderProfileSet = new Set(genderRecipients.map((r) => r.profile_id));
      const intersection = roleRecipients.filter((r) => genderProfileSet.has(r.profile_id));
      const uniqueProfileIds = Array.from(new Set(intersection.map((r) => r.profile_id)));

      if (uniqueProfileIds.length === 0) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage('لا يوجد مستلمون يطابقون الجمع بين الأدوار والجنس المختار');
        setResolvedCriteria({ type: 'all' });
        return;
      }

      setRecipientCount(uniqueProfileIds.length);
      setResolvedCriteria({
        type: 'custom',
        values: uniqueProfileIds,
      });
      setPreviewState('ready');
    } catch (err) {
      console.error('Preview exception:', err);
      setRecipientCount(0);
      setPreviewState('error');
      setPreviewMessage('تعذر تحميل المستلمين. حاول مرة أخرى.');
      setResolvedCriteria({ type: 'all' });
    }
  };

  // ========== HANDLERS ==========
  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!canSend) return;

    Alert.alert(
      'تأكيد الإرسال',
      `هل تريد إرسال هذا الإشعار إلى ${recipientCount} ${
        recipientCount === 1
          ? 'مستخدم'
          : recipientCount === 2
          ? 'مستخدمان'
          : 'مستخدمين'
      }؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال',
          style: 'destructive',
          onPress: () => sendBroadcast(),
        },
      ]
    );
  };

  const sendBroadcast = async () => {
    setSending(true);

    try {
      const criteria = resolvedCriteria;
      const validationError = validateBroadcastCriteria(criteria);
      if (validationError) {
        Alert.alert('خطأ', validationError);
        return;
      }
      const { data, error } = await createBroadcast({
        title: title.trim(),
        body: body.trim(),
        criteria,
        priority: importance,
      });

      if (error) {
        Alert.alert('خطأ', error.message);
        return;
      }

      if (data) {
        // Send push notifications (non-blocking)
        try {
          const { sendBroadcastPushNotifications } = await import('../../services/notifications');
          await sendBroadcastPushNotifications(
            data.broadcast_id,
            criteria,
            title.trim(),
            body.trim()
          );
        } catch (pushError) {
          console.error('Push notification error:', pushError);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Reset form
        setTitle('');
        setBody('');
        setRoleFilterEnabled(false);
        setGenderFilterEnabled(false);
        setSelectedRoles([]);
        setSelectedGenders([]);
        setImportance('normal');
        setRecipientCount(0);
        setPreviewState('loading');
        setPreviewMessage(null);
        setResolvedCriteria({ type: 'all' });
        loadRecipientPreview();

        // Refresh history
        loadHistory();

        Alert.alert(
          'تم الإرسال بنجاح',
          `تم إرسال الإشعار إلى ${data.total_recipients} ${
            data.total_recipients === 1
              ? 'مستخدم'
              : data.total_recipients === 2
              ? 'مستخدمان'
              : 'مستخدمين'
          }`,
          [{ text: 'حسناً' }]
        );
      }
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  const toggleRole = (role: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleGender = (gender: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenders((prev) =>
      prev.includes(gender)
        ? prev.filter((g) => g !== gender)
        : [...prev, gender]
    );
  };

  const toggleImportance = (level: Importance) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImportance(level);
  };

  const toggleCardExpanded = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const sent = new Date(timestamp);
    const diffMs = now.getTime() - sent.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} ${diffMins === 1 ? 'دقيقة' : 'دقائق'}`;
    if (diffHours < 24) return `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : 'ساعات'}`;
    if (diffDays < 7) return `منذ ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}`;
    return sent.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  };

  const getReadColor = (percentage: number) => {
    if (percentage >= 75) return '#34C759';
    if (percentage >= 50) return '#FF9500';
    return '#FF3B30';
  };

  const getImportanceLabel = (level: Importance) => {
    switch (level) {
      case 'urgent': return 'عاجلة';
      case 'high': return 'مهمة';
      default: return 'عادية';
    }
  };

  // ========== RENDER ==========
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <Image
                source={require('../../../assets/logo/AlqefariEmblem.png')}
                style={styles.emblem}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle} numberOfLines={1}>
                إشعارات جماعية
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <Ionicons name={dismissIcon} size={28} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={historyListData}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          ListHeaderComponent={renderComposeSections}
          ListEmptyComponent={renderHistoryEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          extraData={listExtraData}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                tokens.spacing.xl * 2 + Math.max(insets.bottom, tokens.spacing.md),
            },
          ]}
        />

        <View
          style={[
            styles.actionFooter,
            { paddingBottom: Math.max(insets.bottom, tokens.spacing.sm) },
          ]}
        >
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="إغلاق مدير الإشعارات"
          >
            <Text style={styles.cancelButtonText}>إلغاء</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            accessibilityLabel="إرسال الإشعار الجماعي"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>إرسال</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  header: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.divider,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emblem: {
    width: 44,
    height: 44,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: tokens.typography.largeTitle.fontSize,
    lineHeight: tokens.typography.largeTitle.lineHeight,
    fontWeight: tokens.typography.largeTitle.fontWeight as any,
    color: tokens.colors.najdi.text,
    marginStart: tokens.spacing.sm,
    fontFamily: 'SF Arabic',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  composer: {
    gap: tokens.spacing.lg,
  },
  section: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight as any,
    color: tokens.colors.najdi.text,
  },
  input: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.sm,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  bodyInput: {
    minHeight: 140,
    lineHeight: 22,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  errorText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.danger,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  filterChipLabel: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  filterChipLabelActive: {
    color: '#FFFFFF',
  },
  filterChipBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterChipBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  filterChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  filterSummaryText: {
    flex: 1,
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  filterClearButton: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 4,
  },
  filterClearText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.primary,
    fontWeight: '600',
  },
  subSection: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  subSectionTitle: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  multiSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  multiSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  multiSelectChipActive: {
    backgroundColor: tokens.colors.najdi.secondary,
    borderColor: tokens.colors.najdi.secondary,
  },
  multiSelectLabel: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
  },
  multiSelectLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  importanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  importanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    minWidth: 96,
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  importanceChipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  importanceLabel: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  importanceLabelActive: {
    color: '#FFFFFF',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    borderWidth: 1,
  },
  previewCardIdle: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.outline,
  },
  previewCardLoading: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.najdi.secondary,
  },
  previewCardReady: {
    backgroundColor: '#E9F9EF',
    borderColor: tokens.colors.success,
  },
  previewCardError: {
    backgroundColor: '#FDECEF',
    borderColor: tokens.colors.danger,
  },
  previewIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  previewSubtitle: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  previewBadge: {
    minWidth: 44,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '700',
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  historySectionMeta: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  historySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  historySummarySkeleton: {
    marginTop: tokens.spacing.sm,
  },
  historySummaryCard: {
    flex: 1,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    alignItems: 'center',
  },
  historySummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  historySummaryLabel: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
  },
  historyCard: {
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  historyCardTitle: {
    flex: 1,
    fontSize: tokens.typography.headline.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  historyCardPreview: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 22,
    marginBottom: tokens.spacing.sm,
  },
  historyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  historyStat: {
    flex: 1,
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  historyStatLabel: {
    fontSize: 11,
    color: tokens.colors.najdi.textMuted,
    marginTop: 2,
  },
  historyStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: tokens.colors.divider,
  },
  historyProgressContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.najdi.container,
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
  },
  historyProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTimestamp: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  historyExpandedSection: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  historyDivider: {
    height: 1,
    backgroundColor: tokens.colors.divider,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  detailValue: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 22,
  },
  historySkeletonContainer: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  historySkeletonCard: {
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  historySkeletonLine: {
    marginBottom: 8,
  },
  historyError: {
    marginTop: tokens.spacing.lg,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  historyErrorText: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  historyRetryButton: {
    marginTop: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.primary,
  },
  historyRetryText: {
    color: '#FFFFFF',
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '600',
  },
  historyEmpty: {
    marginTop: tokens.spacing.lg,
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.lg,
  },
  historyEmptyTitle: {
    fontSize: tokens.typography.headline.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  historyEmptySubtitle: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  actionFooter: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  sendButton: {
    flex: 2,
    height: 48,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
