/**
 * PhotoApprovalManager.js
 * Admin component for reviewing and approving/rejecting photo change requests
 * Features: Photo comparison, template selection, real-time updates
 * Design: Najdi Sadu design system, Arabic-first RTL
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
} from '../../config/photoApprovalConfig';

/**
 * PhotoApprovalManager Component
 * Displays pending photo change requests for admin review
 */
export default function PhotoApprovalManager({ visible, onClose }) {
  // State
  const [requests, setRequests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Template selection modal
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [customReason, setCustomReason] = useState('');

  // Rejection confirmation modal
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Image error tracking (per request ID)
  const [imageErrors, setImageErrors] = useState({});

  // Load data on mount
  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  // Load pending requests and templates
  const loadData = async () => {
    try {
      setLoading(true);

      // Load pending requests (with timeout from config)
      const requestsPromise = fetchWithTimeout(
        supabase.rpc('list_photo_change_requests', {
          p_status: 'pending',
          p_limit: 50,
          p_offset: 0,
        }),
        NETWORK_CONFIG.requestTimeout
      );

      // Load rejection templates
      const templatesPromise = fetchWithTimeout(
        supabase.rpc(RPC_FUNCTIONS.listTemplates),
        NETWORK_CONFIG.requestTimeout
      );

      const [requestsResult, templatesResult] = await Promise.all([
        requestsPromise,
        templatesPromise,
      ]);

      if (requestsResult.error) throw requestsResult.error;
      if (templatesResult.error) throw templatesResult.error;

      setRequests(requestsResult.data || []);
      setTemplates(templatesResult.data || []);
    } catch (error) {
      if (error.message === 'NETWORK_TIMEOUT') {
        Alert.alert(ERROR_CONFIG.networkTimeout.title, ERROR_CONFIG.networkTimeout.message);
      } else {
        Alert.alert(ERROR_CONFIG.loadError.title, ERROR_CONFIG.loadError.message);
      }
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  // Approve photo change
  const handleApprove = async (requestId) => {
    Alert.alert(
      'تأكيد الموافقة',
      'هل أنت متأكد من الموافقة على هذه الصورة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافقة',
          style: 'default',
          onPress: async () => {
            try {
              setProcessingId(requestId);

              const { data, error } = await supabase.rpc('approve_photo_change', {
                p_request_id: requestId,
              });

              if (error) throw error;

              if (!data?.success) {
                throw new Error(data?.message || 'فشلت الموافقة');
              }

              Alert.alert('نجح', 'تم قبول الصورة بنجاح');

              // Remove from list
              setRequests((prev) => prev.filter((r) => r.id !== requestId));
            } catch (error) {
              Alert.alert('خطأ', error.message || 'فشل قبول الصورة');
              console.error('Approve error:', error);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Show rejection template selector
  const handleRejectPress = (request) => {
    setSelectedRequest(request);
    setCustomReason('');
    setTemplateModalVisible(true);
  };

  // Template selected → Show confirmation
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setTemplateModalVisible(false);
    setConfirmModalVisible(true);
  };

  // Custom reason selected → Show confirmation
  const handleCustomReasonSubmit = () => {
    if (!customReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب الرفض');
      return;
    }

    setSelectedTemplate({ message: customReason.trim() });
    setTemplateModalVisible(false);
    setConfirmModalVisible(true);
  };

  // Confirm rejection
  const handleConfirmReject = async () => {
    try {
      setProcessingId(selectedRequest.id);
      setConfirmModalVisible(false);

      const { data, error } = await supabase.rpc('reject_photo_change', {
        p_request_id: selectedRequest.id,
        p_rejection_reason: selectedTemplate.message,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || 'فشل الرفض');
      }

      Alert.alert('نجح', 'تم رفض الصورة وإرسال إشعار للمستخدم');

      // Remove from list
      setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));

      // Reset state
      setSelectedRequest(null);
      setSelectedTemplate(null);
    } catch (error) {
      Alert.alert('خطأ', error.message || 'فشل رفض الصورة');
      console.error('Reject error:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Render photo comparison
  const renderPhotoComparison = (request) => {
    const oldPhotoUri = request.old_photo_url || null;
    const newPhotoUri = request.new_photo_url;
    const oldPhotoKey = `${request.id}_old`;
    const newPhotoKey = `${request.id}_new`;

    // Check if images failed to load
    const oldPhotoFailed = imageErrors[oldPhotoKey];
    const newPhotoFailed = imageErrors[newPhotoKey];

    // Handle image load errors
    const handleOldPhotoError = () => {
      setImageErrors(prev => ({ ...prev, [oldPhotoKey]: true }));
    };

    const handleNewPhotoError = () => {
      setImageErrors(prev => ({ ...prev, [newPhotoKey]: true }));
    };

    return (
      <View style={styles.photoComparisonContainer}>
        {/* Old Photo */}
        <View style={styles.photoBox}>
          <Text style={styles.photoLabel}>الصورة الحالية</Text>
          <View style={styles.photoFrame}>
            {oldPhotoUri && !oldPhotoFailed ? (
              <Image
                source={{ uri: oldPhotoUri }}
                style={styles.photo}
                resizeMode="cover"
                onError={handleOldPhotoError}
              />
            ) : (
              <View style={[styles.photo, styles.placeholderPhoto]}>
                <Ionicons name="person-circle-outline" size={60} color={tokens.colors.neutral[400]} />
                <Text style={styles.placeholderText}>
                  {oldPhotoFailed ? ERROR_CONFIG.placeholders.new : ERROR_CONFIG.placeholders.old}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="arrow-back" size={24} color={tokens.colors.neutral[500]} />
        </View>

        {/* New Photo */}
        <View style={styles.photoBox}>
          <Text style={styles.photoLabel}>الصورة المقترحة</Text>
          <View style={styles.photoFrame}>
            {!newPhotoFailed ? (
              <Image
                source={{ uri: newPhotoUri }}
                style={styles.photo}
                resizeMode="cover"
                onError={handleNewPhotoError}
              />
            ) : (
              <View style={[styles.photo, styles.placeholderPhoto]}>
                <Ionicons name="alert-circle-outline" size={60} color={tokens.colors.primary.main} />
                <Text style={styles.placeholderText}>{ERROR_CONFIG.placeholders.new}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Render request card
  const renderRequestCard = (request) => {
    const isProcessing = processingId === request.id;

    return (
      <View key={request.id} style={styles.card}>
        {/* Profile Info */}
        <View style={styles.cardHeader}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{request.profile_name}</Text>
            <Text style={styles.profileHid}>
              {request.profile_hid || `الجيل ${request.profile_generation}`}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {new Date(request.created_at).toLocaleDateString('ar-SA')}
          </Text>
        </View>

        {/* Photo Comparison */}
        {renderPhotoComparison(request)}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleRejectPress(request)}
            disabled={isProcessing}
            accessibilityLabel="رفض الصورة"
            accessibilityHint="فتح قائمة أسباب الرفض"
            accessibilityRole="button"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={tokens.colors.najdi.text} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={tokens.colors.najdi.text} />
                <Text style={styles.rejectButtonText}>رفض</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApprove(request.id)}
            disabled={isProcessing}
            accessibilityLabel="موافقة على الصورة"
            accessibilityHint="قبول طلب تغيير الصورة"
            accessibilityRole="button"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={tokens.colors.najdi.background} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={tokens.colors.najdi.background} />
                <Text style={styles.approveButtonText}>موافقة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="checkmark-done-circle" size={80} color="#D4D4D4" />
      <Text style={styles.emptyStateTitle}>{EMPTY_STATE_CONFIG.title}</Text>
      <Text style={styles.emptyStateSubtitle}>
        {EMPTY_STATE_CONFIG.subtitle}
      </Text>
    </View>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="إغلاق"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>مراجعة الصور</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      {/* Main Modal */}
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="إغلاق"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>مراجعة الصور</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          </View>

          {/* Requests List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={REFRESH_CONFIG.tintColor}
                colors={REFRESH_CONFIG.colors}
              />
            }
          >
            {requests.length === 0 ? renderEmptyState() : requests.map(renderRequestCard)}
          </ScrollView>
        </View>
      </Modal>

      {/* Template Selection Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.templateModal}>
            <Text style={styles.templateModalTitle}>اختر سبب الرفض</Text>

            <ScrollView style={styles.templateList}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateItem}
                  onPress={() => handleTemplateSelect(template)}
                  accessibilityLabel={template.title}
                  accessibilityHint={`اختر قالب الرفض: ${template.title}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.templateTitle}>{template.title}</Text>
                  <Text style={styles.templateMessage}>{template.message}</Text>
                </TouchableOpacity>
              ))}

              {/* Custom Reason */}
              <View style={styles.customReasonContainer}>
                <Text style={styles.customReasonLabel}>أو اكتب سبباً مخصصاً:</Text>
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
                <TouchableOpacity
                  style={styles.customReasonButton}
                  onPress={handleCustomReasonSubmit}
                  accessibilityLabel="استخدام السبب المخصص"
                  accessibilityHint="تأكيد استخدام سبب الرفض المخصص"
                  accessibilityRole="button"
                >
                  <Text style={styles.customReasonButtonText}>استخدام السبب المخصص</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.templateModalCancel}
              onPress={() => setTemplateModalVisible(false)}
              accessibilityLabel="إلغاء"
              accessibilityHint="إلغاء اختيار قالب الرفض"
              accessibilityRole="button"
            >
              <Text style={styles.templateModalCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rejection Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmModalTitle}>تأكيد رفض الصورة</Text>
            <Text style={styles.confirmModalMessage}>
              سيتم إرسال الرسالة التالية للمستخدم:
            </Text>
            <View style={styles.confirmMessageBox}>
              <Text style={styles.confirmMessageText}>{selectedTemplate?.message}</Text>
            </View>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setConfirmModalVisible(false)}
                accessibilityLabel="إلغاء"
                accessibilityHint="إلغاء تأكيد رفض الصورة"
                accessibilityRole="button"
              >
                <Text style={styles.confirmCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmRejectButton}
                onPress={handleConfirmReject}
                accessibilityLabel="تأكيد رفض الصورة"
                accessibilityHint="رفض الصورة وإرسال إشعار للمستخدم"
                accessibilityRole="button"
              >
                <Text style={styles.confirmRejectText}>رفض الصورة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: tokens.colors.najdi.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.divider,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  badge: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: tokens.colors.najdi.background,
    fontSize: 13,
    fontWeight: '600',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 96,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },

  // Request Card
  card: {
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  profileHid: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  timestamp: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },

  // Photo Comparison
  photoComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoBox: {
    flex: 1,
    gap: 12,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
  photoFrame: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  photo: {
    width: PHOTO_CONFIG.size,
    height: PHOTO_CONFIG.size,
  },
  placeholderPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: '#A3A3A3',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 8,
    paddingVertical: 16,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.background,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 8,
    paddingVertical: 16,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Template Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  templateModal: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    padding: 24,
    gap: 16,
  },
  templateModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  templateList: {
    maxHeight: 400,
  },
  templateItem: {
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  templateMessage: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 20,
  },
  customReasonContainer: {
    marginTop: 16,
    gap: 12,
  },
  customReasonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  customReasonInput: {
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: tokens.colors.najdi.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCounter: {
    fontSize: 13,
    color: tokens.colors.neutral[500],
    textAlign: 'left',
    marginTop: 4,
  },
  customReasonButton: {
    backgroundColor: tokens.colors.najdi.secondary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  customReasonButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  templateModalCancel: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  templateModalCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
  },

  // Confirmation Modal
  confirmModal: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: 12,
    width: '100%',
    padding: 24,
    gap: 16,
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
  confirmMessageBox: {
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 8,
    padding: 16,
  },
  confirmMessageText: {
    fontSize: 15,
    color: tokens.colors.najdi.text,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E5E5E5',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  confirmRejectButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: tokens.colors.najdi.primary,
  },
  confirmRejectText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.background,
  },
});
