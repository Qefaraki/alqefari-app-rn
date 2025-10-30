/**
 * PhotoApprovalManager.js
 * Renovated photo moderation flow aligned with the Suggestions checker UI.
 * Provides segmented browsing, status insights, and refreshed Najdi Sadu styling.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import tokens from '../ui/tokens';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  PHOTO_CONFIG,
  NETWORK_CONFIG,
  REJECTION_REASON_CONFIG,
  ERROR_CONFIG,
  RPC_FUNCTIONS,
  REFRESH_CONFIG,
  EMPTY_STATE_CONFIG,
  TABLE_NAMES,
  REQUEST_STATUS,
} from '../../config/photoApprovalConfig';
import LargeTitleHeader from '../ios/LargeTitleHeader';
import SegmentedControl from '../ui/SegmentedControl';
import SkeletonLoader from '../ui/SkeletonLoader';
import { useNetworkGuard } from '../../hooks/useNetworkGuard';

const COLORS = {
  background: tokens.colors.najdi.background,
  container: tokens.colors.najdi.container,
  text: tokens.colors.najdi.text,
  textMuted: tokens.colors.najdi.textMuted,
  border: `${tokens.colors.najdi.container}40`,
  primary: tokens.colors.najdi.primary,
  secondary: tokens.colors.najdi.secondary,
  success: tokens.colors.success,
  danger: tokens.colors.danger,
};

const spacing = tokens.spacing;
const typography = tokens.typography;

const STATUS_META = {
  [REQUEST_STATUS.pending]: {
    label: 'قيد المراجعة',
    icon: 'time-outline',
    color: tokens.colors.najdi.secondary,
    background: `${tokens.colors.najdi.secondary}20`,
  },
  [REQUEST_STATUS.approved]: {
    label: 'مقبولة',
    icon: 'checkmark-circle',
    color: tokens.colors.success,
    background: `${tokens.colors.success}20`,
  },
  [REQUEST_STATUS.rejected]: {
    label: 'مرفوضة',
    icon: 'close-circle',
    color: tokens.colors.danger,
    background: `${tokens.colors.danger}20`,
  },
};

const DEFAULT_STATUS_META = {
  label: 'غير معروف',
  icon: 'information-circle',
  color: tokens.colors.textMuted,
  background: `${tokens.colors.najdi.container}30`,
};

const TABS = [
  { id: REQUEST_STATUS.pending, label: 'قيد المراجعة' },
  { id: REQUEST_STATUS.approved, label: 'مقبولة' },
  { id: REQUEST_STATUS.rejected, label: 'مرفوضة' },
];

const skeletonItems = Array.from({ length: 3 });
const SORT_OPTIONS = [
  { id: 'newest', label: 'الأحدث' },
  { id: 'oldest', label: 'الأقدم' },
];

const getStatusMeta = (status) => STATUS_META[status] || DEFAULT_STATUS_META;

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ar-SA');
  } catch (error) {
    return '—';
  }
};

const formatTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '—';
  }
};

const formatExpiresLabel = (value) => {
  if (!value) return null;
  const expires = new Date(value);
  if (Number.isNaN(expires.getTime())) return null;
  return `ينتهي ${expires.toLocaleDateString('ar-SA')}`;
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function PhotoApprovalManager({ visible, onClose }) {
  const [requests, setRequests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState(REQUEST_STATUS.pending);
  const [stats, setStats] = useState({
    [REQUEST_STATUS.pending]: 0,
    [REQUEST_STATUS.approved]: 0,
    [REQUEST_STATUS.rejected]: 0,
  });
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customReason, setCustomReason] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const { checkBeforeAction } = useNetworkGuard();
  const listRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setActiveTab(REQUEST_STATUS.pending);
      return;
    }

    setImageErrors({});
    setInitialLoading(true);
    loadTemplates();
    loadStats();
    loadRequests({ status: activeTab, useOverlay: false });
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (initialLoading) return;
    loadRequests({ status: activeTab, useOverlay: true });
  }, [activeTab, visible, initialLoading]);

  const loadRequests = async ({ status = activeTab, useOverlay = false } = {}) => {
    if (!initialLoading && useOverlay) {
      setIsFetching(true);
    }

    try {
      const response = await fetchWithTimeout(
        supabase.rpc(RPC_FUNCTIONS.listRequests, {
          p_status: status,
          p_limit: 50,
          p_offset: 0,
        }),
        NETWORK_CONFIG.requestTimeout,
        'Load photo change requests'
      );

      if (response.error) {
        throw response.error;
      }

      setRequests(response.data || []);
    } catch (error) {
      console.error('Error loading photo requests:', error);
      if (error.message === 'NETWORK_OFFLINE' || error.message?.includes('NETWORK_TIMEOUT')) {
        Alert.alert(ERROR_CONFIG.networkTimeout.title, ERROR_CONFIG.networkTimeout.message);
      } else {
        Alert.alert(ERROR_CONFIG.loadError.title, ERROR_CONFIG.loadError.message);
      }
    } finally {
      setInitialLoading(false);
      if (useOverlay) {
        setIsFetching(false);
      }
      setRefreshing(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetchWithTimeout(
        supabase.rpc(RPC_FUNCTIONS.listTemplates),
        NETWORK_CONFIG.requestTimeout,
        'Load rejection templates'
      );

      if (response.error) throw response.error;
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error loading photo rejection templates:', error);
    }
  };

  const loadStats = async () => {
    try {
      const statuses = [
        REQUEST_STATUS.pending,
        REQUEST_STATUS.approved,
        REQUEST_STATUS.rejected,
      ];

      const responses = await Promise.all(
        statuses.map((status) =>
          fetchWithTimeout(
            supabase
              .from(TABLE_NAMES.requests)
              .select('*', { count: 'exact', head: true })
              .eq('status', status),
            NETWORK_CONFIG.requestTimeout,
            `Count photo requests (${status})`
          )
        )
      );

      const counts = {};
      responses.forEach((response, index) => {
        const statusKey = statuses[index];
        if (response.error) throw response.error;
        counts[statusKey] = response.count ?? 0;
      });

      setStats((prev) => ({ ...prev, ...counts }));
    } catch (error) {
      console.error('Error loading photo request stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadRequests({ status: activeTab, useOverlay: true }),
      loadStats(),
    ]);
  };

  useEffect(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, [activeTab, sortOption]);

  const filteredRequests = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    let next = requests;

    if (trimmedQuery.length > 0) {
      const queryLower = trimmedQuery.toLowerCase();
      next = next.filter((item) => {
        const name = item.profile_name?.toLowerCase() ?? '';
        const hid = item.profile_hid?.toLowerCase() ?? '';
        return name.includes(queryLower) || hid.includes(queryLower);
      });
    }

    const sorted = [...next].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      if (Number.isNaN(aDate) || Number.isNaN(bDate)) return 0;
      return sortOption === 'newest' ? bDate - aDate : aDate - bDate;
    });

  return sorted;
}, [requests, searchQuery, sortOption]);

const hasSearchQuery = searchQuery.trim().length > 0;

const renderHighlightedText = (value) => {
  const safeValue = value ?? '—';
  const trimmed = searchQuery.trim();
  if (!trimmed) {
    return safeValue;
  }
  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
  const segments = String(safeValue).split(regex).filter((segment) => segment.length > 0);
  return segments.map((segment, index) => {
    const isMatch = segment.toLowerCase() === trimmed.toLowerCase();
    return (
      <Text
        key={`highlight-${segment}-${index}`}
        style={isMatch ? styles.highlightMatch : undefined}
      >
        {segment}
      </Text>
    );
  });
};

  const handleModalClose = () => {
    setTemplateModalVisible(false);
    setConfirmModalVisible(false);
    setSelectedRequest(null);
    setSelectedTemplate(null);
    setCustomReason('');
    setProcessingId(null);
    setSearchQuery('');
    setSortOption('newest');
    onClose?.();
  };

  const confirmApprove = (request) => {
    Alert.alert(
      'تأكيد الموافقة',
      'هل تريد قبول هذه الصورة وتحديث الملف؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافقة',
          style: 'default',
          onPress: () => handleApprove(request),
        },
      ]
    );
  };

  const handleApprove = async (request) => {
    if (!await checkBeforeAction('قبول الصورة')) return;

    try {
      setProcessingId(request.id);

      const { data, error } = await supabase.rpc(RPC_FUNCTIONS.approve, {
        p_request_id: request.id,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || 'فشل قبول الصورة');
      }

      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم', 'تم قبول الصورة بنجاح');
      loadStats();
    } catch (error) {
      console.error('Error approving photo change:', error);
      Alert.alert('خطأ', error.message || 'فشل قبول الصورة');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPress = (request) => {
    setSelectedRequest(request);
    setSelectedTemplate(null);
    setCustomReason('');
    setTemplateModalVisible(true);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setTemplateModalVisible(false);
    setConfirmModalVisible(true);
  };

  const handleCustomReasonSubmit = () => {
    if (!customReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب الرفض');
      return;
    }
    setSelectedTemplate({ message: customReason.trim() });
    setTemplateModalVisible(false);
    setConfirmModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !selectedTemplate?.message) {
      setConfirmModalVisible(false);
      return;
    }

    if (!await checkBeforeAction('رفض الصورة')) return;

    try {
      setProcessingId(selectedRequest.id);

      const { data, error } = await supabase.rpc(RPC_FUNCTIONS.reject, {
        p_request_id: selectedRequest.id,
        p_rejection_reason: selectedTemplate.message,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || 'فشل رفض الصورة');
      }

      setRequests((prev) => prev.filter((item) => item.id !== selectedRequest.id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم', 'تم رفض الصورة وإشعار المستخدم');
      loadStats();
    } catch (error) {
      console.error('Error rejecting photo change:', error);
      Alert.alert('خطأ', error.message || 'فشل رفض الصورة');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingId(null);
      setSelectedRequest(null);
      setSelectedTemplate(null);
      setConfirmModalVisible(false);
      setCustomReason('');
    }
  };

  const renderPhotoComparison = (request) => {
    const oldUri = request.old_photo_url;
    const newUri = request.new_photo_url;
    const oldKey = `${request.id}_old`;
    const newKey = `${request.id}_new`;
    const oldErrored = imageErrors[oldKey];
    const newErrored = imageErrors[newKey];

    return (
      <View style={styles.photoRow}>
        <View style={styles.photoColumn}>
          <Text style={styles.photoLabel}>الصورة الحالية</Text>
          <View style={styles.photoFrame}>
            {oldUri && !oldErrored ? (
              <Image
                source={{ uri: oldUri }}
                style={styles.photo}
                resizeMode="cover"
                onError={() => setImageErrors((prev) => ({ ...prev, [oldKey]: true }))}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person-circle-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.photoPlaceholderText}>
                  {oldErrored ? ERROR_CONFIG.placeholders.new : ERROR_CONFIG.placeholders.old}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.photoArrow}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
        </View>

        <View style={styles.photoColumn}>
          <Text style={styles.photoLabel}>الصورة المقترحة</Text>
          <View style={styles.photoFrame}>
            {newUri && !newErrored ? (
              <Image
                source={{ uri: newUri }}
                style={styles.photo}
                resizeMode="cover"
                onError={() => setImageErrors((prev) => ({ ...prev, [newKey]: true }))}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.primary} />
                <Text style={styles.photoPlaceholderText}>{ERROR_CONFIG.placeholders.new}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderRequest = ({ item: request }) => {
    const statusMeta = getStatusMeta(request.status);
    const isPending = request.status === REQUEST_STATUS.pending;
    const isProcessing = processingId === request.id;
    const expiresLabel = formatExpiresLabel(request.expires_at);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {request.profile_name || '—'}
            </Text>
            <Text style={styles.profileMeta}>
              {request.profile_hid
                ? `ملف #${request.profile_hid}`
                : `الجيل ${request.profile_generation ?? '—'}`}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.background }]}>
            <Ionicons name={statusMeta.icon} size={16} color={statusMeta.color} />
            <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.metaChipText}>{formatDate(request.created_at)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.metaChipText}>{formatTime(request.created_at)}</Text>
          </View>
          {expiresLabel ? (
            <View style={[styles.metaChip, styles.metaChipWarning]}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.secondary} />
              <Text style={[styles.metaChipText, { color: COLORS.secondary }]}>{expiresLabel}</Text>
            </View>
          ) : null}
        </View>

        {renderPhotoComparison(request)}

        {request.rejection_reason && request.status === REQUEST_STATUS.rejected ? (
          <View style={styles.noteRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.danger} />
            <Text style={styles.noteText}>سبب الرفض: {request.rejection_reason}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>توقيت التقديم</Text>
          <Text style={styles.footerText}>
            {formatDate(request.created_at)} - {formatTime(request.created_at)}
          </Text>
        </View>

        {isPending ? (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
                isProcessing && styles.disabledButton,
              ]}
              onPress={() => handleRejectPress(request)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <>
                  <Ionicons name="close" size={18} color={COLORS.danger} />
                  <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>رفض</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isProcessing && styles.disabledButton,
              ]}
              onPress={() => confirmApprove(request)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={COLORS.background} />
                  <Text style={styles.primaryButtonText}>موافقة</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderInitialSkeleton = () => (
    <View style={styles.loadingContainer}>
      {skeletonItems.map((_, index) => (
        <View key={`photo-skeleton-${index}`} style={styles.skeletonCard}>
          <SkeletonLoader height={20} width="45%" />
          <SkeletonLoader height={12} width="60%" style={{ marginTop: spacing.xs }} />
          <SkeletonLoader height={120} borderRadius={tokens.radii.md} style={{ marginTop: spacing.sm }} />
        </View>
      ))}
    </View>
  );

  const renderList = () => (
    <FlatList
      ref={listRef}
      data={filteredRequests}
      keyExtractor={(item) => item.id}
      renderItem={renderRequest}
      contentContainerStyle={[
        styles.listContent,
        filteredRequests.length === 0 && styles.listContentEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={REFRESH_CONFIG.tintColor}
          colors={REFRESH_CONFIG.colors}
        />
      }
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        isFetching ? (
          <View style={styles.inlineSkeleton}>
            <SkeletonLoader height={14} width="60%" />
            <SkeletonLoader height={12} width="40%" style={{ marginTop: spacing.xs / 2 }} />
          </View>
        ) : (
          <View style={styles.listHeaderSpacer} />
        )
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Image
            source={require('../../../assets/logo/AlqefariEmblem.png')}
            style={styles.emptyEmblem}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>
            {hasSearchQuery ? 'ما فيه نتائج للبحث' : EMPTY_STATE_CONFIG.title}
          </Text>
          <Text style={styles.emptySubtitle}>
            {hasSearchQuery
              ? 'جرب تعديل كلمة البحث أو مسحها للرجوع إلى كل الطلبات.'
              : EMPTY_STATE_CONFIG.subtitle}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyAction,
              pressed && styles.emptyActionPressed,
            ]}
            onPress={() => {
              setRefreshing(true);
              loadRequests({ status: activeTab, useOverlay: true });
              loadStats();
            }}
          >
            <Text style={styles.emptyActionText}>تحديث القائمة</Text>
          </Pressable>
        </View>
      }
    />
  );

  const renderTemplateModal = () => (
    <Modal
      visible={templateModalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setTemplateModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>اختر سبب الرفض</Text>
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            style={styles.templateList}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.templateItem,
                  pressed && styles.templateItemPressed,
                ]}
                onPress={() => handleTemplateSelect(item)}
              >
                <Text style={styles.templateTitle}>{item.title}</Text>
                <Text style={styles.templateMessage}>{item.message}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              <View style={styles.customReasonContainer}>
                <Text style={styles.customReasonLabel}>أو اكتب سبباً مخصصاً</Text>
                <TextInput
                  style={styles.customReasonInput}
                  placeholder={REJECTION_REASON_CONFIG.placeholder}
                  placeholderTextColor={REJECTION_REASON_CONFIG.placeholderTextColor}
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline={REJECTION_REASON_CONFIG.multiline}
                  numberOfLines={REJECTION_REASON_CONFIG.numberOfLines}
                  textAlign="right"
                  maxLength={REJECTION_REASON_CONFIG.maxLength}
                />
                <Text style={styles.characterCounter}>
                  {customReason.length} / {REJECTION_REASON_CONFIG.maxLength}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.customReasonButton,
                    pressed && styles.customReasonButtonPressed,
                  ]}
                  onPress={handleCustomReasonSubmit}
                >
                  <Text style={styles.customReasonButtonText}>استخدام السبب المخصص</Text>
                </Pressable>
              </View>
            }
          />
          <Pressable
            style={({ pressed }) => [
              styles.sheetCancel,
              pressed && styles.sheetCancelPressed,
            ]}
            onPress={() => setTemplateModalVisible(false)}
          >
            <Text style={styles.sheetCancelText}>إلغاء</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderConfirmModal = () => (
    <Modal
      visible={confirmModalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setConfirmModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.confirmCard}>
          <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
          <Text style={styles.confirmTitle}>تأكيد رفض الصورة</Text>
          <Text style={styles.confirmMessage}>سيتم إرسال الرسالة التالية للمستخدم:</Text>
          <View style={styles.confirmMessageBox}>
            <Text style={styles.confirmMessageText}>{selectedTemplate?.message}</Text>
          </View>
          <View style={styles.confirmButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButtonModal,
                pressed && styles.secondaryButtonPressedModal,
              ]}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={[styles.secondaryButtonText, { color: COLORS.text }]}>تراجع</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButtonModal,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleConfirmReject}
            >
              <Text style={styles.primaryButtonText}>تأكيد الرفض</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
      >
        <View style={styles.container}>
          <LargeTitleHeader
            title="مراجعة الصور"
            emblemSource={require('../../../assets/logo/AlqefariEmblem.png')}
            rightSlot={
              <TouchableOpacity
                onPress={handleModalClose}
                style={styles.closeButton}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons name="chevron-back" size={28} color={COLORS.text} />
              </TouchableOpacity>
            }
          />

          <View style={styles.segmentedControlContainer}>
            <SegmentedControl
              options={TABS}
              value={activeTab}
              onChange={(value) => setActiveTab(value)}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>قيد المراجعة</Text>
              <Text style={styles.statValue}>
                {(stats[REQUEST_STATUS.pending] ?? 0).toLocaleString('ar-SA')}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>مقبولة</Text>
              <Text style={styles.statValue}>
                {(stats[REQUEST_STATUS.approved] ?? 0).toLocaleString('ar-SA')}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statLabel}>مرفوضة</Text>
              <Text style={styles.statValue}>
                {(stats[REQUEST_STATUS.rejected] ?? 0).toLocaleString('ar-SA')}
              </Text>
            </View>
          </View>

          <View style={styles.utilityRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="ابحث باسم الشخص أو رقم الملف"
                placeholderTextColor={`${COLORS.textMuted}AA`}
                style={styles.searchInput}
                selectionColor={COLORS.primary}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  style={styles.clearSearch}
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={`${COLORS.textMuted}CC`} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sortChips}>
              {SORT_OPTIONS.map((option) => {
                const isActive = sortOption === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.sortChip,
                      isActive && styles.sortChipActive,
                      pressed && styles.sortChipPressed,
                    ]}
                    onPress={() => setSortOption(option.id)}
                  >
                    <Text
                      style={[
                        styles.sortChipLabel,
                        isActive && styles.sortChipLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.listWrapper}>
            {initialLoading ? renderInitialSkeleton() : renderList()}
          </View>
        </View>
      </Modal>

      {renderTemplateModal()}
      {renderConfirmModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  closeButton: {
    padding: spacing.xs,
  },
  segmentedControlContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statChip: {
    flex: 1,
    backgroundColor: `${COLORS.container}24`,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  statLabel: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: `${COLORS.text}99`,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.container}18`,
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginStart: spacing.xs / 2,
  },
  searchInput: {
    flex: 1,
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
  },
  clearSearch: {
    marginStart: spacing.xs / 2,
  },
  sortChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortChip: {
    borderRadius: tokens.radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: COLORS.background,
  },
  sortChipPressed: {
    opacity: 0.8,
  },
  sortChipActive: {
    backgroundColor: `${COLORS.primary}15`,
    borderColor: `${COLORS.primary}66`,
  },
  sortChipLabel: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sortChipLabelActive: {
    color: COLORS.primary,
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listHeaderSpacer: {
    height: spacing.sm,
  },
  inlineSkeleton: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  profileName: {
    ...typography.headline,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
  },
  profileMeta: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    marginTop: spacing.xs / 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    borderRadius: tokens.radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.5,
  },
  statusPillText: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: `${COLORS.container}18`,
    borderRadius: tokens.radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.2,
  },
  metaChipWarning: {
    backgroundColor: `${COLORS.secondary}18`,
  },
  metaChipText: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoColumn: {
    flex: 1,
  },
  photoLabel: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    marginBottom: spacing.xs,
  },
  photoFrame: {
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  photo: {
    width: '100%',
    height: PHOTO_CONFIG.size,
    minHeight: PHOTO_CONFIG.minSize,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoPlaceholderText: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  photoArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: `${COLORS.danger}15`,
    borderRadius: tokens.radii.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  noteText: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: COLORS.danger,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: spacing.sm,
  },
  footerText: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: COLORS.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.background,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.danger}66`,
    backgroundColor: `${COLORS.danger}18`,
    paddingVertical: spacing.sm,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  skeletonCard: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyEmblem: {
    width: 96,
    height: 96,
    tintColor: COLORS.container,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: tokens.radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.primary,
  },
  emptyActionPressed: {
    backgroundColor: `${COLORS.primary}10`,
  },
  emptyActionText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: `${COLORS.text}20`,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  templateList: {
    maxHeight: 320,
  },
  templateItem: {
    backgroundColor: `${COLORS.container}26`,
    borderRadius: tokens.radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateItemPressed: {
    backgroundColor: `${COLORS.container}40`,
  },
  templateTitle: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  templateMessage: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    lineHeight: typography.footnote.lineHeight + 4,
  },
  customReasonContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customReasonLabel: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
  },
  customReasonInput: {
    backgroundColor: `${COLORS.container}20`,
    borderRadius: tokens.radii.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
    color: COLORS.text,
    ...typography.body,
    fontFamily: 'SF Arabic',
  },
  characterCounter: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    textAlign: 'left',
  },
  customReasonButton: {
    backgroundColor: COLORS.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customReasonButtonPressed: {
    opacity: 0.85,
  },
  customReasonButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: COLORS.background,
    fontWeight: '600',
  },
  sheetCancel: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sheetCancelPressed: {
    opacity: 0.72,
  },
  sheetCancelText: {
    ...typography.body,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
  },
  confirmCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  confirmTitle: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
    fontWeight: '600',
  },
  confirmMessage: {
    ...typography.body,
    fontFamily: 'SF Arabic',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  confirmMessageBox: {
    alignSelf: 'stretch',
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    padding: spacing.md,
  },
  confirmMessageText: {
    ...typography.body,
    fontFamily: 'SF Arabic',
    color: COLORS.text,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  secondaryButtonModal: {
    flex: 1,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  secondaryButtonPressedModal: {
    backgroundColor: `${COLORS.container}18`,
  },
  primaryButtonModal: {
    flex: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
});
