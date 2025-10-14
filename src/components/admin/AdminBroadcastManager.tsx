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
  ActivityIndicator,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import tokens from '../ui/tokens';
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

const EMPTY_HISTORY: BroadcastHistoryItem[] = [];

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
  const [targetingType, setTargetingType] = useState<TargetingType>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [importance, setImportance] = useState<Importance>('normal');
  const [recipientCount, setRecipientCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  // ========== HISTORY STATE ==========
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

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
    if (historyExpanded && history.length === 0) {
      loadHistory();
    }
  }, [historyExpanded]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await getBroadcastHistory(20, 0);
      if (!error && data) {
        setHistory(data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
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
    setTargetingType(value);

    if (value === 'all') {
      setSelectedRoles([]);
      setSelectedGenders([]);
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

  const historyData = historyExpanded ? history : [];

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
    if (!historyExpanded) {
      return null;
    }

    if (loadingHistory) {
      return (
        <View style={styles.historyLoading}>
          <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
          <Text style={styles.historyLoadingText}>جاري تحميل سجل الإشعارات...</Text>
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

    const chevronIcon = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

    const filterOptionData: Array<{ value: TargetingType; title: string; description: string }> = [
      { value: 'all', title: 'إرسال لجميع الأعضاء', description: 'بدون تحديد أو استثناءات' },
      { value: 'role', title: 'تصفية بالدور الإداري', description: roleSummary },
      { value: 'gender', title: 'تصفية بالجنس', description: genderSummary },
    ];

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

          <View style={styles.filterOptions}>
            {filterOptionData.map(({ value, title, description }) => {
              const isActive = targetingType === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterOption, isActive && styles.filterOptionActive]}
                  onPress={() => handleFilterChange(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={title}
                  activeOpacity={0.9}
                >
                  <View style={styles.filterOptionCopy}>
                    <Text
                      style={[styles.filterOptionTitle, isActive && styles.filterOptionTitleActive]}
                    >
                      {title}
                    </Text>
                    <Text style={styles.filterOptionDescription}>{description}</Text>
                  </View>
                  <Ionicons
                    name={isActive ? 'checkmark-circle' : chevronIcon}
                    size={24}
                    color={
                      isActive
                        ? tokens.colors.najdi.primary
                        : tokens.colors.najdi.textMuted
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {targetingType === 'role' && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>الأدوار المستهدفة</Text>
              {renderMultiSelect(roleOptions, selectedRoles, toggleRole)}
            </View>
          )}

          {targetingType === 'gender' && (
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
              const descriptionMap: Record<Importance, string> = {
                normal: 'إشعار عادي بدون تنبيه إضافي',
                high: 'يتم عرضه بشكل بارز للمستخدمين',
                urgent: 'تنبيه عاجل مع إبراز إضافي',
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
                    size={20}
                    color={active ? '#FFFFFF' : '#8E8E93'}
                  />
                  <View style={styles.importanceContent}>
                    <Text
                      style={[styles.importanceLabel, active && styles.importanceLabelActive]}
                    >
                      {labelMap[level]}
                    </Text>
                    <Text
                      style={[
                        styles.importanceDescription,
                        active && styles.importanceDescriptionActive,
                      ]}
                    >
                      {descriptionMap[level]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {renderPreviewStatus()}

        <TouchableOpacity
          style={styles.historyHeader}
          onPress={toggleHistoryExpanded}
          accessibilityRole="button"
          accessibilityState={{ expanded: historyExpanded }}
          accessibilityLabel="عرض سجل الإشعارات"
          activeOpacity={0.9}
        >
          <View>
            <Text style={styles.historyHeaderTitle}>سجل الإشعارات</Text>
            <Text style={styles.historyHeaderSubtitle}>
              {history.length > 0
                ? `آخر إرسال منذ ${formatRelativeTime(history[0].sent_at)}`
                : 'تابع أداء الإشعارات السابقة'}
            </Text>
          </View>
          <View style={styles.historyHeaderRight}>
            {history.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{history.length}</Text>
              </View>
            )}
            <Ionicons
              name={historyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={tokens.colors.najdi.text}
            />
          </View>
        </TouchableOpacity>
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
  }, [targetingType, selectedRoles, selectedGenders]);

  const loadRecipientPreview = async () => {
    setPreviewState('loading');
    setPreviewMessage(null);

    try {
      const criteria = buildCriteria();
      const validationError = validateBroadcastCriteria(criteria);

      if (validationError) {
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(validationError);
        return;
      }

      const { data, error } = await previewBroadcastRecipients(criteria);

      if (error) {
        console.error('Preview error:', error);
        setRecipientCount(0);
        setPreviewState('error');
        setPreviewMessage(error.message || 'تعذر تحميل المستلمين. حاول مرة أخرى.');
        return;
      }

      const count = data?.length || 0;
      setRecipientCount(count);

      if (count === 0) {
        setPreviewState('error');
        setPreviewMessage('لا يوجد مستلمون مطابقون للمعايير الحالية');
        return;
      }

      setPreviewState('ready');
    } catch (err) {
      console.error('Preview exception:', err);
      setRecipientCount(0);
      setPreviewState('error');
      setPreviewMessage('تعذر تحميل المستلمين. حاول مرة أخرى.');
    }
  };

  // ========== BUILD CRITERIA ==========
  const buildCriteria = (): BroadcastCriteria => {
    if (targetingType === 'all') {
      return { type: 'all' };
    }

    if (targetingType === 'role') {
      return { type: 'role', values: selectedRoles };
    }

    if (targetingType === 'gender') {
      return { type: 'gender', values: selectedGenders };
    }

    return { type: 'all' };
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
      const criteria = buildCriteria();
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
        setTargetingType('all');
        setSelectedRoles([]);
        setSelectedGenders([]);
        setImportance('normal');
        setRecipientCount(0);
        setPreviewState('loading');
        setPreviewMessage(null);
        loadRecipientPreview();

        // Refresh history
        if (historyExpanded) {
          loadHistory();
        }

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

  const toggleHistoryExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHistoryExpanded(!historyExpanded);
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
          data={historyData}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          ListHeaderComponent={renderComposeSections}
          ListEmptyComponent={renderHistoryEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          extraData={{
            expandedCardId,
            historyExpanded,
            previewState,
            recipientCount,
          }}
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
  filterOptions: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  filterOptionActive: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
  },
  filterOptionCopy: {
    flex: 1,
    gap: 4,
  },
  filterOptionTitle: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  filterOptionTitleActive: {
    color: tokens.colors.najdi.primary,
  },
  filterOptionDescription: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
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
    flexDirection: 'column',
    gap: tokens.spacing.sm,
  },
  importanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
  },
  importanceChipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  importanceContent: {
    flex: 1,
  },
  importanceLabel: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: '600',
  },
  importanceLabelActive: {
    color: '#FFFFFF',
  },
  importanceDescription: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  importanceDescriptionActive: {
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
  historyHeader: {
    marginTop: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  historyHeaderTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  historyHeaderSubtitle: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    marginTop: 2,
  },
  historyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  historyBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.najdi.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBadgeText: {
    color: '#FFFFFF',
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: '700',
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
  historyLoading: {
    marginTop: tokens.spacing.lg,
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  historyLoadingText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
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
