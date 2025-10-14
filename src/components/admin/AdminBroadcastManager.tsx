/**
 * Admin Broadcast Manager
 *
 * Unified interface for creating and managing broadcast notifications
 * Combines composer and history in one cohesive iOS-inspired design
 * Follows Najdi Sadu design system
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import tokens from '../ui/tokens';
import SegmentedControl from '../ui/SegmentedControl';
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

  // ========== PREVIEW RECIPIENTS (DEBOUNCED) ==========
  useEffect(() => {
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

  const toggleTargeting = (type: TargetingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (targetingType === type && type !== 'all') {
      setTargetingType('all');
    } else {
      setTargetingType(type);
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==================== COMPOSE SECTION ==================== */}

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>العنوان</Text>
          <TextInput
            style={[styles.input, !titleValid && title.length > 0 && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان الإشعار (3-200 حرف)"
            placeholderTextColor={tokens.colors.najdi.textMuted}
            maxLength={200}
          />
          <Text style={styles.helperText}>
            {title.length}/200 حرف
            {title.length > 0 && !titleValid && (
              <Text style={styles.errorText}> - الحد الأدنى 3 أحرف</Text>
            )}
          </Text>
        </View>

        {/* Body Input */}
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
          />
          <Text style={styles.helperText}>
            {body.length}/1000 حرف
            {body.length > 0 && !bodyValid && (
              <Text style={styles.errorText}> - الحد الأدنى 10 أحرف</Text>
            )}
          </Text>
        </View>

        {/* Recipients Targeting */}
        <View style={styles.section}>
          <Text style={styles.label}>المستلمون</Text>

          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'all' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('all')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'all' && styles.chipTextActive,
                ]}
              >
                الكل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'role' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('role')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'role' && styles.chipTextActive,
                ]}
              >
                حسب الدور
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                targetingType === 'gender' && styles.chipActive,
              ]}
              onPress={() => toggleTargeting('gender')}
            >
              <Text
                style={[
                  styles.chipText,
                  targetingType === 'gender' && styles.chipTextActive,
                ]}
              >
                حسب الجنس
              </Text>
            </TouchableOpacity>
          </View>

          {/* Role Sub-Selection - FIXED with actual app roles */}
          {targetingType === 'role' && (
            <View style={styles.subChipRow}>
              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('super_admin') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('super_admin')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('super_admin') && styles.subChipTextActive,
                  ]}
                >
                  مشرف رئيسي
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('admin') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('admin')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('admin') && styles.subChipTextActive,
                  ]}
                >
                  مسؤول
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('moderator') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('moderator')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('moderator') && styles.subChipTextActive,
                  ]}
                >
                  مشرف فرع
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedRoles.includes('user') && styles.subChipActive,
                ]}
                onPress={() => toggleRole('user')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedRoles.includes('user') && styles.subChipTextActive,
                  ]}
                >
                  مستخدم
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gender Sub-Selection */}
          {targetingType === 'gender' && (
            <View style={styles.subChipRow}>
              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedGenders.includes('male') && styles.subChipActive,
                ]}
                onPress={() => toggleGender('male')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedGenders.includes('male') && styles.subChipTextActive,
                  ]}
                >
                  ذكور
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subChip,
                  selectedGenders.includes('female') && styles.subChipActive,
                ]}
                onPress={() => toggleGender('female')}
              >
                <Text
                  style={[
                    styles.subChipText,
                    selectedGenders.includes('female') && styles.subChipTextActive,
                  ]}
                >
                  إناث
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Importance Level - RENAMED from Priority with descriptions */}
        <View style={styles.section}>
          <Text style={styles.label}>مستوى الأهمية</Text>
          <Text style={styles.helperText}>
            يحدد كيفية ظهور الإشعار للمستخدمين
          </Text>

          <View style={styles.importanceRow}>
            <TouchableOpacity
              style={[
                styles.importanceChip,
                importance === 'normal' && styles.importanceChipActive,
              ]}
              onPress={() => toggleImportance('normal')}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={importance === 'normal' ? '#FFFFFF' : '#8E8E93'}
              />
              <View style={styles.importanceContent}>
                <Text
                  style={[
                    styles.importanceLabel,
                    importance === 'normal' && styles.importanceLabelActive,
                  ]}
                >
                  عادية
                </Text>
                <Text
                  style={[
                    styles.importanceDescription,
                    importance === 'normal' && styles.importanceDescriptionActive,
                  ]}
                >
                  إشعارات عامة
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.importanceChip,
                importance === 'high' && styles.importanceChipActive,
              ]}
              onPress={() => toggleImportance('high')}
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={importance === 'high' ? '#FFFFFF' : '#FF9500'}
              />
              <View style={styles.importanceContent}>
                <Text
                  style={[
                    styles.importanceLabel,
                    importance === 'high' && styles.importanceLabelActive,
                  ]}
                >
                  مهمة
                </Text>
                <Text
                  style={[
                    styles.importanceDescription,
                    importance === 'high' && styles.importanceDescriptionActive,
                  ]}
                >
                  تحديثات مهمة
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.importanceChip,
                importance === 'urgent' && styles.importanceChipActive,
              ]}
              onPress={() => toggleImportance('urgent')}
            >
              <Ionicons
                name="warning-outline"
                size={20}
                color={importance === 'urgent' ? '#FFFFFF' : '#FF3B30'}
              />
              <View style={styles.importanceContent}>
                <Text
                  style={[
                    styles.importanceLabel,
                    importance === 'urgent' && styles.importanceLabelActive,
                  ]}
                >
                  عاجلة
                </Text>
                <Text
                  style={[
                    styles.importanceDescription,
                    importance === 'urgent' && styles.importanceDescriptionActive,
                  ]}
                >
                  تنبيهات عاجلة
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipient Count Preview - NO SPINNER */}
        <View style={styles.recipientPreview}>
          <Ionicons name="people-outline" size={20} color={tokens.colors.najdi.text} />
          <Text style={styles.recipientPreviewText}>
            سيتم الإرسال إلى{' '}
            <Text style={styles.recipientCount}>
              {recipientCount === 0 ? '—' : recipientCount}
            </Text>
            {' '}مستخدم
          </Text>
        </View>

        {/* ==================== HISTORY SECTION ==================== */}

        <TouchableOpacity
          style={styles.historyHeader}
          onPress={toggleHistoryExpanded}
        >
          <Text style={styles.historyHeaderTitle}>
            السجل السابق {history.length > 0 && `(${history.length})`}
          </Text>
          <Ionicons
            name={historyExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={tokens.colors.najdi.textMuted}
          />
        </TouchableOpacity>

        {historyExpanded && (
          <View style={styles.historyContent}>
            {loadingHistory ? (
              <View style={styles.historyLoading}>
                <Text style={styles.historyLoadingText}>جاري التحميل...</Text>
              </View>
            ) : history.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Ionicons
                  name="newspaper-outline"
                  size={48}
                  color={tokens.colors.najdi.container}
                />
                <Text style={styles.historyEmptyTitle}>لا توجد إشعارات سابقة</Text>
                <Text style={styles.historyEmptySubtitle}>
                  الإشعارات التي ترسلها ستظهر هنا
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const isExpanded = expandedCardId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => toggleCardExpanded(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Header Row */}
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

                    {/* Body Preview (collapsed) */}
                    {!isExpanded && (
                      <Text style={styles.historyCardPreview} numberOfLines={2}>
                        {item.body}
                      </Text>
                    )}

                    {/* Statistics Row */}
                    <View style={styles.historyStats}>
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatValue}>{item.total_recipients}</Text>
                        <Text style={styles.historyStatLabel}>مستلم</Text>
                      </View>
                      <View style={styles.historyStatDivider} />
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatValue}>{item.read_count}</Text>
                        <Text style={styles.historyStatLabel}>تم القراءة</Text>
                      </View>
                      <View style={styles.historyStatDivider} />
                      <View style={styles.historyStat}>
                        <Text
                          style={[
                            styles.historyStatValue,
                            { color: getReadColor(item.read_percentage) },
                          ]}
                        >
                          {item.read_percentage.toFixed(0)}%
                        </Text>
                        <Text style={styles.historyStatLabel}>نسبة القراءة</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
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

                    {/* Timestamp + Priority Badge */}
                    <View style={styles.historyFooter}>
                      <Text style={styles.historyTimestamp}>
                        {formatRelativeTime(item.sent_at)}
                      </Text>
                      <View
                        style={[
                          styles.priorityBadge,
                          { backgroundColor: getPriorityColor(item.priority) },
                        ]}
                      >
                        <Text style={styles.priorityBadgeText}>
                          {getImportanceLabel(item.priority)}
                        </Text>
                      </View>
                    </View>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <View style={styles.historyExpandedSection}>
                        <View style={styles.historyDivider} />

                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>نص الرسالة الكامل:</Text>
                          <Text style={styles.detailValue}>{item.body}</Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>المستهدفون:</Text>
                          <Text style={styles.detailValue}>
                            {getTargetingLabel(item.target_criteria)}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>المرسل:</Text>
                          <Text style={styles.detailValue}>{item.sender_name}</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ==================== ACTION FOOTER ==================== */}
      <View style={styles.actionFooter}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
        >
          <Text style={styles.cancelButtonText}>إلغاء</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
          <Text style={styles.sendButtonText}>إرسال</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl * 2,
  },

  // ========== COMPOSE SECTION ==========
  section: {
    marginBottom: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight as any,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xs,
  },
  input: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.sm,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
    textAlign: 'left',
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: tokens.spacing.sm,
  },
  helperText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.xxs,
    textAlign: 'left',
  },
  errorText: {
    color: tokens.colors.danger,
  },

  // ========== TARGETING CHIPS ==========
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  chipText: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // ========== SUB-CHIPS ==========
  subChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  subChip: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.najdi.container,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    minHeight: 36,
    justifyContent: 'center',
  },
  subChipActive: {
    backgroundColor: tokens.colors.najdi.secondary,
    borderColor: tokens.colors.najdi.secondary,
  },
  subChipText: {
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.text,
  },
  subChipTextActive: {
    color: '#FFFFFF',
  },

  // ========== IMPORTANCE SELECTOR ==========
  importanceRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  importanceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    gap: 8,
  },
  importanceChipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderColor: tokens.colors.najdi.primary,
  },
  importanceContent: {
    flex: 1,
  },
  importanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  importanceLabelActive: {
    color: '#FFFFFF',
  },
  importanceDescription: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginTop: 2,
  },
  importanceDescriptionActive: {
    color: 'rgba(255,255,255,0.8)',
  },

  // ========== RECIPIENT PREVIEW ==========
  recipientPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: `${tokens.colors.najdi.container}33`,
    borderRadius: tokens.radii.md,
    gap: 8,
    marginTop: tokens.spacing.md,
  },
  recipientPreviewText: {
    fontSize: 15,
    color: tokens.colors.najdi.text,
  },
  recipientCount: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },

  // ========== HISTORY SECTION ==========
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.xs,
  },
  historyHeaderTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight as any,
    color: tokens.colors.najdi.text,
  },
  historyContent: {
    marginTop: tokens.spacing.xs,
  },
  historyLoading: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  historyLoadingText: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  historyEmpty: {
    alignItems: 'center',
    padding: tokens.spacing.xl * 2,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
  },
  historyEmptyTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight as any,
    color: tokens.colors.najdi.text,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xxs,
  },
  historyEmptySubtitle: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },

  // ========== HISTORY CARD ==========
  historyCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  historyCardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  historyCardPreview: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },

  // ========== HISTORY STATS ==========
  historyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    height: 30,
    backgroundColor: tokens.colors.divider,
  },

  // ========== PROGRESS BAR ==========
  historyProgressContainer: {
    height: 4,
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  historyProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ========== HISTORY FOOTER ==========
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
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ========== EXPANDED DETAILS ==========
  historyExpandedSection: {
    marginTop: 12,
  },
  historyDivider: {
    height: 1,
    backgroundColor: tokens.colors.divider,
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },

  // ========== ACTION FOOTER ==========
  actionFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: tokens.spacing.md,
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
    gap: 8,
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
