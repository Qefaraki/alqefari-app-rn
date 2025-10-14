/**
 * Admin Notification History
 *
 * Super admin UI for viewing broadcast notification history with statistics
 * Najdi Sadu design system with expandable cards
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import tokens from '../ui/tokens';
import {
  getBroadcastHistory,
  getTargetingLabel,
  getReadPercentageColor,
  getPriorityIcon,
  getPriorityColor,
} from '../../services/broadcastNotifications';
import type { BroadcastHistoryItem } from '../../types/notifications';

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminNotificationHistory() {
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await getBroadcastHistory(50, 0);
      if (error) {
        console.error('Error loading history:', error);
      } else {
        setHistory(data || []);
      }
    } catch (err) {
      console.error('Exception loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const toggleExpanded = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderItem = ({ item }: { item: BroadcastHistoryItem }) => {
    const isExpanded = expandedId === item.id;
    const readPercentage = item.read_percentage;
    const readColor = getReadPercentageColor(readPercentage);
    const priorityIcon = getPriorityIcon(item.priority);
    const priorityColor = getPriorityColor(item.priority);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => toggleExpanded(item.id)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <Ionicons name={priorityIcon as any} size={20} color={priorityColor} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        {/* Statistics */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>مستلم</Text>
            <Text style={styles.statValue}>{item.total_recipients}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>تم القراءة</Text>
            <Text style={styles.statValue}>{item.read_count}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>نسبة القراءة</Text>
            <Text style={[styles.statValue, { color: readColor }]}>
              {readPercentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${readPercentage}%`,
                backgroundColor: readColor,
              },
            ]}
          />
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {formatDistanceToNow(new Date(item.sent_at), {
            addSuffix: true,
            locale: ar,
          })}
        </Text>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />

            {/* Body Text */}
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedLabel}>نص الرسالة:</Text>
              <Text style={styles.expandedValue}>{item.body}</Text>
            </View>

            {/* Targeting */}
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedLabel}>المستهدفون:</Text>
              <Text style={styles.expandedValue}>
                {getTargetingLabel(item.target_criteria)}
              </Text>
            </View>

            {/* Sender */}
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedLabel}>المرسل:</Text>
              <Text style={styles.expandedValue}>{item.sender_name}</Text>
            </View>

            {/* Priority */}
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedLabel}>الأولوية:</Text>
              <Text style={[styles.expandedValue, { color: priorityColor }]}>
                {item.priority === 'urgent'
                  ? 'عالية'
                  : item.priority === 'high'
                  ? 'عادية'
                  : 'منخفضة'}
              </Text>
            </View>
          </View>
        )}

        {/* Expand Indicator */}
        <View style={styles.expandIndicator}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={tokens.colors.najdi.textMuted}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../../assets/AlqefariEmblem-TabIcon@3x.png')}
        style={styles.emptyEmblem}
        resizeMode="contain"
      />
      <Text style={styles.emptyText}>لا توجد إشعارات سابقة</Text>
      <Text style={styles.emptySubtext}>
        الإشعارات التي ترسلها ستظهر هنا
      </Text>
    </View>
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonStats}>
            <View style={styles.skeletonStat} />
            <View style={styles.skeletonStat} />
            <View style={styles.skeletonStat} />
          </View>
          <View style={styles.skeletonProgress} />
        </View>
      ))}
    </View>
  );

  if (loading) {
    return renderSkeleton();
  }

  return (
    <FlatList
      data={history}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.colors.najdi.primary}
        />
      }
      ListEmptyComponent={renderEmpty}
    />
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  listContent: {
    padding: tokens.spacing.md,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: tokens.typography.caption1.fontSize,
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xxs,
  },
  statValue: {
    fontSize: tokens.typography.title3.fontSize,
    fontWeight: tokens.typography.title3.fontWeight,
    color: tokens.colors.najdi.text,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: tokens.colors.divider,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: tokens.spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  timestamp: {
    fontSize: tokens.typography.caption1.fontSize,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'left',
  },
  expandedSection: {
    marginTop: tokens.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.divider,
    marginBottom: tokens.spacing.sm,
  },
  expandedBlock: {
    marginBottom: tokens.spacing.sm,
  },
  expandedLabel: {
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xxs,
  },
  expandedValue: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
    lineHeight: tokens.typography.body.lineHeight,
  },
  expandIndicator: {
    position: 'absolute',
    bottom: tokens.spacing.xs,
    right: tokens.spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl * 2,
  },
  emptyEmblem: {
    width: 120,
    height: 120,
    marginBottom: tokens.spacing.lg,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: tokens.typography.title2.fontSize,
    fontWeight: tokens.typography.title2.fontWeight,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xs,
  },
  emptySubtext: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  skeletonContainer: {
    padding: tokens.spacing.md,
  },
  skeletonCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  skeletonHeader: {
    height: 20,
    width: '70%',
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.sm,
  },
  skeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: tokens.spacing.sm,
  },
  skeletonStat: {
    height: 40,
    width: 60,
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: tokens.radii.sm,
  },
  skeletonProgress: {
    height: 6,
    backgroundColor: tokens.colors.najdi.container,
    borderRadius: 3,
  },
});
