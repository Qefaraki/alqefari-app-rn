/**
 * My Suggestions Screen
 *
 * Allows users to view all their submitted edit suggestions and track their status.
 * Part of the Permission System v4.2 - provides full transparency into suggestion workflow.
 *
 * Features:
 * - Three tabs: Pending / Approved / Rejected
 * - Shows profile name, field changes, status badges, timestamps
 * - Auto-approval timer for family circle suggestions
 * - Rejection reasons for rejected suggestions
 * - Pull-to-refresh support
 * - Empty states for each tab
 * - Native RTL support
 * - Najdi Sadu design system
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

export default function MySuggestions() {
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
    router.back();
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

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {suggestion.profile?.name || 'غير معروف'}
          </Text>
          {suggestion.profile?.hid && (
            <Text style={styles.profileHID}>#{suggestion.profile.hid}</Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(suggestion.status) + '15' }
          ]}
        >
          <Ionicons
            name={getStatusIcon(suggestion.status)}
            size={16}
            color={getStatusColor(suggestion.status)}
            style={styles.statusIcon}
          />
          <Text style={[styles.statusText, { color: getStatusColor(suggestion.status) }]}>
            {getStatusLabel(suggestion.status)}
          </Text>
        </View>
      </View>

      {/* Field Change */}
      <View style={styles.changeSection}>
        <Text style={styles.fieldLabel}>
          {suggestionService.formatFieldName(suggestion.field_name)}
        </Text>
        <View style={styles.changeValues}>
          <View style={styles.valueContainer}>
            <Text style={styles.valueLabel}>من:</Text>
            <Text style={styles.valueText} numberOfLines={2}>
              {suggestion.old_value || 'فارغ'}
            </Text>
          </View>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={COLORS.textMuted}
            style={styles.arrow}
          />
          <View style={styles.valueContainer}>
            <Text style={styles.valueLabel}>إلى:</Text>
            <Text style={[styles.valueText, styles.newValueText]} numberOfLines={2}>
              {suggestion.new_value || ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Reason (if provided) */}
      {suggestion.reason && (
        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>السبب:</Text>
          <Text style={styles.reasonText}>{suggestion.reason}</Text>
        </View>
      )}

      {/* Auto-approval timer for family circle pending suggestions */}
      {suggestion.status === 'pending' && suggestion.permission_level === 'family' && (
        <View style={styles.autoApprovalBanner}>
          <Ionicons name="timer-outline" size={16} color={COLORS.secondary} />
          <Text style={styles.autoApprovalText}>
            موافقة تلقائية خلال: {suggestionService.getAutoApprovalTimeRemaining(suggestion.created_at)}
          </Text>
        </View>
      )}

      {/* Rejection reason (if rejected) */}
      {suggestion.status === 'rejected' && suggestion.rejection_reason && (
        <View style={styles.rejectionSection}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.danger} />
          <Text style={styles.rejectionText}>
            سبب الرفض: {suggestion.rejection_reason}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.timestampText}>
          {formatTimestamp(suggestion.created_at)}
        </Text>
        {suggestion.status === 'approved' && suggestion.reviewed_at && (
          <Text style={styles.reviewedText}>
            موافق عليه • {formatTimestamp(suggestion.reviewed_at)}
          </Text>
        )}
      </View>
    </View>
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
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
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

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.sm,
  },
  profileInfo: {
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  profileHID: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusIcon: {
    marginTop: Platform.select({ ios: -1, android: 0 }),
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Change Section
  changeSection: {
    marginBottom: tokens.spacing.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: tokens.spacing.xs,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  valueContainer: {
    flex: 1,
    padding: tokens.spacing.sm,
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  valueLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  newValueText: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  arrow: {
    marginHorizontal: 4,
  },

  // Reason Section
  reasonSection: {
    backgroundColor: COLORS.background,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },

  // Auto-approval Banner
  autoApprovalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary + '15',
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.xs,
  },
  autoApprovalText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '500',
    flex: 1,
  },

  // Rejection Section
  rejectionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.danger + '10',
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.xs,
  },
  rejectionText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
    lineHeight: 18,
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  timestampText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  reviewedText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
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
