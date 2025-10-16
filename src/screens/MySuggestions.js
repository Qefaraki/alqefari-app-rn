/**
 * My Suggestions Screen
 *
 * Allows users to view all their submitted edit suggestions and track their status.
 * Part of the Permission System v4.3 (Simplified) - provides full transparency into suggestion workflow.
 *
 * Features:
 * - Three tabs: Pending / Approved / Rejected
 * - Shows profile name, field changes, status badges, timestamps
 * - Rejection reasons for rejected suggestions
 * - Pull-to-refresh support
 * - Empty states for each tab
 * - Native RTL support
 * - Najdi Sadu design system
 *
 * Note: All suggestions now require manual admin approval (48hr auto-approval removed in v4.3)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import suggestionService from '../services/suggestionService';
import tokens from '../components/ui/tokens';
import LargeTitleHeader from '../components/ios/LargeTitleHeader';

// Najdi Sadu colors
const COLORS = {
  background: tokens.colors.najdi.background,
  surface: tokens.colors.surface,
  text: tokens.colors.najdi.text,
  textMuted: tokens.colors.najdi.textMuted,
  primary: tokens.colors.najdi.primary,
  secondary: tokens.colors.najdi.secondary,
  divider: tokens.colors.divider,
  success: tokens.colors.success,
  danger: tokens.colors.danger,
};

export default function MySuggestions({ onClose }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, rejected
  const [userProfile, setUserProfile] = useState(null);

  // Load user profile and suggestions on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  // Reload suggestions when tab changes
  useEffect(() => {
    if (userProfile) {
      loadSuggestions();
    }
  }, [activeTab, userProfile]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);
      const allSuggestions = await suggestionService.getUserSubmittedSuggestions(userProfile.id);
      setSuggestions(allSuggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSuggestions();
    setRefreshing(false);
  }, [userProfile]);

  const handleTabPress = (tab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      // If opened as modal, use onClose callback
      onClose();
    } else if (router.canGoBack()) {
      // Fallback to router if not in modal
      router.back();
    }
  };

  // Filter suggestions by active tab
  const filteredSuggestions = suggestions.filter(s => s.status === activeTab);

  // Get counts for each tab
  const counts = {
    pending: suggestions.filter(s => s.status === 'pending').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    rejected: suggestions.filter(s => s.status === 'rejected').length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LargeTitleHeader
        title="اقتراحاتي"
        emblemSource={require('../../assets/logo/AlqefariEmblem.png')}
        rightSlot={
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        }
        style={{ paddingTop: 0, paddingBottom: tokens.spacing.sm }}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => handleTabPress('pending')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
              معلقة
            </Text>
            {counts.pending > 0 && (
              <View style={[styles.badge, activeTab === 'pending' && styles.activeBadge]}>
                <Text style={[styles.badgeText, activeTab === 'pending' && styles.activeBadgeText]}>
                  {counts.pending}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'approved' && styles.activeTab]}
            onPress={() => handleTabPress('approved')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'approved' && styles.activeTabText]}>
              موافق عليها
            </Text>
            {counts.approved > 0 && (
              <View style={[styles.badge, activeTab === 'approved' && styles.activeBadge]}>
                <Text style={[styles.badgeText, activeTab === 'approved' && styles.activeBadgeText]}>
                  {counts.approved}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'rejected' && styles.activeTab]}
            onPress={() => handleTabPress('rejected')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'rejected' && styles.activeTabText]}>
              مرفوضة
            </Text>
            {counts.rejected > 0 && (
              <View style={[styles.badge, activeTab === 'rejected' && styles.activeBadge]}>
                <Text style={[styles.badgeText, activeTab === 'rejected' && styles.activeBadgeText]}>
                  {counts.rejected}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuggestions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SuggestionCard suggestion={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + tokens.spacing.xl }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={<EmptyState status={activeTab} />}
          getItemLayout={(data, index) => ({
            length: 120,
            offset: 120 * index + 12 * index,
            index,
          })}
          windowSize={5}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          removeClippedSubviews={true}
        />
      )}
    </SafeAreaView>
  );
}

// Suggestion Card Component
function SuggestionCard({ suggestion }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return COLORS.success;
      case 'rejected':
        return COLORS.danger;
      case 'pending':
        return COLORS.secondary;
      default:
        return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'موافق عليه';
      case 'rejected':
        return 'مرفوض';
      case 'pending':
        return 'قيد المراجعة';
      default:
        return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'time-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'اليوم';
    } else if (diffDays === 1) {
      return 'أمس';
    } else if (diffDays < 7) {
      return `منذ ${diffDays} أيام`;
    } else {
      return date.toLocaleDateString('ar-SA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  };

  const statusColor = getStatusColor(suggestion.status);
  // v4.3: Auto-approval removed - timer no longer needed
  const showTimer = false;

  return (
    <Pressable style={styles.card}>
      {/* Header: Profile + Badge inline */}
      <View style={styles.headerRow}>
        <Text style={styles.profileName} numberOfLines={1}>
          {suggestion.profile?.name || 'غير معروف'}
          {suggestion.profile?.hid && ` #${suggestion.profile.hid}`}
        </Text>
        <View
          style={[
            styles.statusBadge,
            suggestion.status === 'approved' && styles.statusBadgeApproved,
            suggestion.status === 'rejected' && styles.statusBadgeRejected,
            suggestion.status === 'pending' && styles.statusBadgePending,
          ]}
        >
          <Ionicons
            name={getStatusIcon(suggestion.status)}
            size={14}
            color={statusColor}
          />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStatusLabel(suggestion.status)}
          </Text>
        </View>
      </View>

      {/* Diff: Inline old → new */}
      <View style={styles.diffContainer}>
        <View style={styles.diffRow}>
          <Text style={styles.fieldLabel}>
            {suggestionService.formatFieldName(suggestion.field_name)}:
          </Text>
          <Text style={styles.valueOld} numberOfLines={1}>
            {suggestion.old_value || 'فارغ'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={COLORS.textMuted}
            style={styles.arrowIcon}
          />
          <Text style={styles.valueNew} numberOfLines={1}>
            {suggestion.new_value || ''}
          </Text>
        </View>
      </View>

      {/* Reason text */}
      {suggestion.reason && (
        <Text style={styles.reasonText} numberOfLines={2}>
          السبب: {suggestion.reason}
        </Text>
      )}

      {/* Collapsible timer (only if pending + family) */}
      {showTimer && (
        <View style={styles.timerRow}>
          <Ionicons name="timer-outline" size={14} color={COLORS.secondary} />
          <Text style={styles.timerText}>
            موافقة تلقائية خلال: {suggestionService.getAutoApprovalTimeRemaining(suggestion.created_at)}
          </Text>
        </View>
      )}

      {/* Rejection reason (if rejected) */}
      {suggestion.status === 'rejected' && suggestion.rejection_reason && (
        <View style={styles.timerRow}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.danger} />
          <Text style={[styles.timerText, { color: COLORS.danger }]}>
            {suggestion.rejection_reason}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footerRow}>
        <Text style={styles.timestampText}>
          {formatTimestamp(suggestion.created_at)}
        </Text>
        {suggestion.status === 'approved' && suggestion.reviewed_at && (
          <Text style={styles.reviewedText}>
            {formatTimestamp(suggestion.reviewed_at)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Empty State Component
function EmptyState({ status }) {
  const getEmptyMessage = () => {
    switch (status) {
      case 'pending':
        return {
          icon: 'document-text-outline',
          title: 'لا توجد اقتراحات معلقة',
          subtitle: 'لم ترسل أي اقتراحات بعد'
        };
      case 'approved':
        return {
          icon: 'checkmark-circle-outline',
          title: 'لم تتم الموافقة على أي اقتراحات بعد',
          subtitle: 'ستظهر الاقتراحات الموافق عليها هنا'
        };
      case 'rejected':
        return {
          icon: 'close-circle-outline',
          title: 'لم يتم رفض أي اقتراحات',
          subtitle: 'ستظهر الاقتراحات المرفوضة هنا'
        };
      default:
        return {
          icon: 'document-text-outline',
          title: 'لا توجد اقتراحات',
          subtitle: ''
        };
    }
  };

  const empty = getEmptyMessage();

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name={empty.icon} size={64} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{empty.title}</Text>
      {empty.subtitle ? (
        <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Back button
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },

  // Tabs
  tabsContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: tokens.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  badge: {
    backgroundColor: COLORS.textMuted + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: COLORS.primary + '20',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  activeBadgeText: {
    color: COLORS.primary,
  },

  // List
  listContent: {
    padding: tokens.spacing.md,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    fontSize: 16,
    color: COLORS.textMuted,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 24,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: COLORS.text,
    flex: 1,
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgePending: {
    backgroundColor: COLORS.secondary + '15',
  },
  statusBadgeApproved: {
    backgroundColor: COLORS.success + '15',
  },
  statusBadgeRejected: {
    backgroundColor: COLORS.danger + '15',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Diff Container
  diffContainer: {
    gap: 6,
    marginBottom: 8,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    color: COLORS.text,
    minWidth: 60,
  },
  valueOld: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
    flex: 1,
  },
  arrowIcon: {
    marginHorizontal: 8,
    opacity: 0.6,
  },
  valueNew: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    color: COLORS.text,
    flex: 1,
  },

  // Reason Text
  reasonText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 8,
  },

  // Timer Row
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: COLORS.secondary,
    flex: 1,
  },

  // Footer Row
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    minHeight: 16,
  },
  timestampText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  reviewedText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: COLORS.success,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: tokens.spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
