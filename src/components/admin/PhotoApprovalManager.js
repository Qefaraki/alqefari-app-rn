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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { tokens } from '../ui/tokens';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 80) / 2; // Side-by-side photos with padding

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

      // Load pending requests (with 3-second timeout)
      const requestsPromise = fetchWithTimeout(
        supabase.rpc('list_photo_change_requests', {
          p_status: 'pending',
          p_limit: 50,
          p_offset: 0,
        }),
        3000
      );

      // Load rejection templates
      const templatesPromise = fetchWithTimeout(
        supabase.rpc('list_photo_rejection_templates'),
        3000
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
        Alert.alert('انتهت المهلة', 'فشل تحميل البيانات. تحقق من الاتصال بالإنترنت.');
      } else {
        Alert.alert('خطأ', 'فشل تحميل طلبات تغيير الصور');
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

    return (
      <View style={styles.photoComparisonContainer}>
        {/* Old Photo */}
        <View style={styles.photoBox}>
          <Text style={styles.photoLabel}>الصورة الحالية</Text>
          <View style={styles.photoFrame}>
            {oldPhotoUri ? (
              <Image
                source={{ uri: oldPhotoUri }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.photo, styles.placeholderPhoto]}>
                <Ionicons name="person-circle-outline" size={60} color={tokens.colors.neutral[400]} />
                <Text style={styles.placeholderText}>لا توجد صورة</Text>
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
            <Image
              source={{ uri: newPhotoUri }}
              style={styles.photo}
              resizeMode="cover"
            />
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
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={tokens.colors.text.primary} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={tokens.colors.text.primary} />
                <Text style={styles.rejectButtonText}>رفض</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApprove(request.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={tokens.colors.background.primary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={tokens.colors.background.primary} />
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
      <Ionicons name="checkmark-done-circle" size={80} color={tokens.colors.neutral[300]} />
      <Text style={styles.emptyStateTitle}>لا توجد طلبات قيد المراجعة</Text>
      <Text style={styles.emptyStateSubtitle}>
        ستظهر هنا طلبات تغيير الصور الجديدة
      </Text>
    </View>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={tokens.colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>مراجعة الصور</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.primary.main} />
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
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={tokens.colors.text.primary} />
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
                tintColor={tokens.colors.primary.main}
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
                  placeholder="مثال: الصورة غير واضحة، يرجى رفع صورة بجودة أعلى"
                  placeholderTextColor={tokens.colors.neutral[400]}
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                />
                <TouchableOpacity
                  style={styles.customReasonButton}
                  onPress={handleCustomReasonSubmit}
                >
                  <Text style={styles.customReasonButtonText}>استخدام السبب المخصص</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.templateModalCancel}
              onPress={() => setTemplateModalVisible(false)}
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
              >
                <Text style={styles.confirmCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmRejectButton}
                onPress={handleConfirmReject}
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
    backgroundColor: tokens.colors.background.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 60,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
  },
  closeButton: {
    padding: tokens.spacing.xs,
  },
  headerTitle: {
    fontSize: tokens.typography.sizes.h3,
    fontWeight: tokens.typography.weights.bold,
    color: tokens.colors.text.primary,
  },
  badge: {
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xs,
  },
  badgeText: {
    color: tokens.colors.background.primary,
    fontSize: tokens.typography.sizes.sm,
    fontWeight: tokens.typography.weights.semibold,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
  },
  loadingText: {
    fontSize: tokens.typography.sizes.md,
    color: tokens.colors.text.secondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl * 2,
    gap: tokens.spacing.md,
  },
  emptyStateTitle: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.sizes.md,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },

  // Request Card
  card: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  profileName: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
  },
  profileHid: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.text.secondary,
  },
  timestamp: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.text.secondary,
  },

  // Photo Comparison
  photoComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  photoBox: {
    flex: 1,
    gap: tokens.spacing.sm,
  },
  photoLabel: {
    fontSize: tokens.typography.sizes.sm,
    fontWeight: tokens.typography.weights.medium,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  photoFrame: {
    borderRadius: tokens.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.neutral[100],
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  placeholderPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  placeholderText: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.neutral[400],
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.md,
  },
  approveButtonText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.background.primary,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.background.primary,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.md,
  },
  rejectButtonText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
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
    padding: tokens.spacing.lg,
  },
  templateModal: {
    backgroundColor: tokens.colors.background.primary,
    borderRadius: tokens.borderRadius.lg,
    width: '100%',
    maxHeight: '80%',
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  templateModalTitle: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: tokens.typography.weights.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  templateList: {
    maxHeight: 400,
  },
  templateItem: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  templateTitle: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
  },
  templateMessage: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.text.secondary,
    lineHeight: 20,
  },
  customReasonContainer: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  customReasonLabel: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.medium,
    color: tokens.colors.text.primary,
  },
  customReasonInput: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.sizes.md,
    color: tokens.colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  customReasonButton: {
    backgroundColor: tokens.colors.secondary.main,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  customReasonButtonText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
  },
  templateModalCancel: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  templateModalCancelText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.medium,
    color: tokens.colors.text.secondary,
  },

  // Confirmation Modal
  confirmModal: {
    backgroundColor: tokens.colors.background.primary,
    borderRadius: tokens.borderRadius.lg,
    width: '100%',
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  confirmModalTitle: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: tokens.typography.weights.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: tokens.typography.sizes.md,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  confirmMessageBox: {
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
  },
  confirmMessageText: {
    fontSize: tokens.typography.sizes.md,
    color: tokens.colors.text.primary,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.neutral[200],
  },
  confirmCancelText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.text.primary,
  },
  confirmRejectButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary.main,
  },
  confirmRejectText: {
    fontSize: tokens.typography.sizes.md,
    fontWeight: tokens.typography.weights.semibold,
    color: tokens.colors.background.primary,
  },
});
