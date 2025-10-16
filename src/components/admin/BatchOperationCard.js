import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  I18nManager,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import tokens from '../ui/tokens';

const COLORS = tokens.colors.najdi;

/**
 * BatchOperationCard Component
 *
 * Displays a collapsible card for batch operations (e.g., QuickAdd with multiple children).
 * Shows summary when collapsed, expands to show individual operations.
 *
 * Features:
 * - Collapsible with smooth animation
 * - Shows operation count summary
 * - Handles partial undo states
 * - Virtualized list for large batches (>10 operations)
 * - Displays count mismatches
 * - RTL-aware design
 *
 * @param {string} groupId - operation_group_id from database
 * @param {string} groupType - Type of batch operation (e.g., 'batch_update')
 * @param {string} description - Group description (e.g., 'إضافة سريعة جماعية')
 * @param {number} operationCount - Expected count from operation_groups table
 * @param {Array} operations - Array of individual operations in this group
 * @param {string} createdAt - ISO timestamp of group creation
 * @param {string} undoState - Undo state: 'pending', 'partial', or 'completed'
 * @param {Function} onRefresh - Callback to refresh the activity list
 * @param {Function} onPressOperation - Callback when individual operation is pressed
 */
const BatchOperationCard = ({
  groupId,
  groupType,
  description,
  operationCount,
  operations = [],
  createdAt,
  undoState,
  onRefresh,
  onPressOperation,
  actorPhotos = {},
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const rotation = useSharedValue(0);
  const actorProfileId = operations[0]?.actor_profile_id;
  const actorPhotoUrl = actorProfileId ? actorPhotos[actorProfileId] || null : null;

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    rotation.value = withTiming(newExpanded ? 180 : 0, { duration: 300 });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isExpanded]);

  // Calculate undo statistics
  const undoStats = useMemo(() => {
    const undoneCount = operations.filter(op => op.undone_at !== null).length;
    const totalCount = operations.length;

    let state = 'none';
    if (undoneCount === totalCount && undoneCount > 0) state = 'all';
    else if (undoneCount > 0) state = 'partial';

    return { undoneCount, totalCount, state };
  }, [operations]);

  // Calculate operation type counts
  const operationTypeCounts = useMemo(() => {
    const counts = {};
    operations.forEach(op => {
      const type = op.action_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [operations]);

  // Generate summary text
  const summaryText = useMemo(() => {
    const createCount = operationTypeCounts.profile_create || 0;
    const updateCount = operationTypeCounts.profile_update || 0;
    const deleteCount = operationTypeCounts.profile_soft_delete || 0;

    const parts = [];
    if (createCount > 0) parts.push(`${createCount} إضافة`);
    if (updateCount > 0) parts.push(`${updateCount} تحديث`);
    if (deleteCount > 0) parts.push(`${deleteCount} حذف`);

    return parts.length > 0 ? parts.join(' • ') : `${operations.length} عمليات`;
  }, [operationTypeCounts, operations.length]);

  const actualCount = operations.length;
  const hasCountMismatch = actualCount !== operationCount;

  // Get actor name from first operation
  const actorName = operations[0]?.actor_name_current || operations[0]?.actor_name_historical || 'مستخدم';

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;

    const diffWeeks = Math.floor(diffDays / 7);
    return `منذ ${diffWeeks} أسبوع`;
  };

  const relativeTime = formatRelativeTime(createdAt);

  // Virtualization threshold - use FlatList for large batches
  const USE_FLATLIST_THRESHOLD = 10;
  const shouldVirtualize = operations.length > USE_FLATLIST_THRESHOLD;

  return (
    <View style={styles.container}>
      {/* Collapsed Header */}
      <TouchableOpacity
        style={[styles.header, isExpanded && styles.headerExpanded]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Animated.View style={animatedChevronStyle}>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.textMuted}
            />
          </Animated.View>

          {actorPhotoUrl && (
            <View style={styles.headerAvatar}>
              <Image source={{ uri: actorPhotoUrl }} style={styles.headerAvatarImage} resizeMode="cover" />
            </View>
          )}

          <View style={styles.headerTextContainer}>
            <Text style={styles.descriptionText} numberOfLines={1}>
              {description || 'عملية جماعية'}
            </Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.actorText} numberOfLines={1}>
                {actorName}
              </Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.timeText}>{relativeTime}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Count Badge */}
          <View style={[
            styles.countBadge,
            hasCountMismatch && styles.countBadgeWarning
          ]}>
            <Text style={[
              styles.countText,
              hasCountMismatch && styles.countTextWarning
            ]}>
              {actualCount}
            </Text>
          </View>

          {/* Undo State Indicators */}
          {undoStats.state === 'all' && (
            <View style={styles.undoAllBadge}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.textMuted} />
            </View>
          )}

          {undoStats.state === 'partial' && (
            <View style={styles.partialBadge}>
              <Text style={styles.partialText}>
                {undoStats.undoneCount}/{undoStats.totalCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Count Mismatch Warning */}
      {hasCountMismatch && !isExpanded && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={14} color={COLORS.ochre} />
          <Text style={styles.warningText}>
            {actualCount} من {operationCount} عمليات متوفرة
          </Text>
        </View>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Summary Row */}
          <View style={styles.summaryRow}>
            <Ionicons name="analytics-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>

          {/* Count Mismatch Warning (Expanded) */}
          {hasCountMismatch && (
            <View style={styles.warningBannerExpanded}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.ochre} />
              <Text style={styles.warningTextExpanded}>
                تحذير: {actualCount} من {operationCount} عمليات متوفرة. قد تكون بعض العمليات فشلت.
              </Text>
            </View>
          )}

          {/* Operations List */}
          {shouldVirtualize ? (
            // Virtualized list for large batches
            <FlatList
              data={operations}
              keyExtractor={(item, index) => `operation-${item.id}-${index}`}
              renderItem={({ item, index }) => (
                <OperationListItem
                  operation={item}
                  onPress={() => onPressOperation?.(item)}
                  index={index}
                />
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={5}
              windowSize={3}
              style={styles.operationsList}
              scrollEnabled={false}
              removeClippedSubviews={true}
            />
          ) : (
            // Simple map for small batches
            <View style={styles.operationsList}>
              {operations.map((operation, index) => (
                <OperationListItem
                  key={`operation-${operation.id}-${index}`}
                  operation={operation}
                  onPress={() => onPressOperation?.(operation)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * OperationListItem Component
 *
 * Renders a single operation within a batch group.
 * Simplified version of ActivityListCard for nested display.
 */
const OperationListItem = ({ operation, onPress }) => {
  const targetName = operation.target_name_current || operation.target_name_historical || 'ملف';
  const isUndone = operation.undone_at !== null;

  // Get action label
  const getActionLabel = (actionType) => {
    const labels = {
      profile_create: 'إضافة',
      profile_update: 'تحديث',
      profile_soft_delete: 'حذف',
      add_marriage: 'إضافة زواج',
      update_marriage: 'تحديث زواج',
      delete_marriage: 'حذف زواج',
    };
    return labels[actionType] || 'عملية';
  };

  const actionLabel = getActionLabel(operation.action_type);

  return (
    <TouchableOpacity
      style={[styles.operationItem, isUndone && styles.operationItemUndone]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.operationContent}>
        {/* Action Type Badge */}
        <View style={[
          styles.actionBadge,
          isUndone && styles.actionBadgeUndone
        ]}>
          <Text style={[
            styles.actionBadgeText,
            isUndone && styles.actionBadgeTextUndone
          ]}>
            {actionLabel}
          </Text>
        </View>

        {/* Target Name */}
        <Text
          style={[styles.operationTargetText, isUndone && styles.operationTargetTextUndone]}
          numberOfLines={1}
        >
          {targetName}
        </Text>
      </View>

      {/* Status Indicators */}
      <View style={styles.operationTrailing}>
        {isUndone && (
          <View style={styles.undoneIndicator}>
            <Text style={styles.undoneIndicatorText}>تم التراجع</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.container + '30',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  headerExpanded: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.container + '33',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextContainer: {
    flex: 1,
    gap: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.container + '50',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  descriptionText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actorText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    maxWidth: 120,
  },
  dotSeparator: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  timeText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: COLORS.primary + '12',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeWarning: {
    backgroundColor: COLORS.ochre + '12',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  countTextWarning: {
    color: COLORS.ochre,
  },
  undoAllBadge: {
    padding: 2,
  },
  partialBadge: {
    backgroundColor: COLORS.ochre + '12',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partialText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.ochre,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.ochre + '08',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.ochre + '22',
  },
  warningText: {
    fontSize: 12,
    color: COLORS.ochre,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.container + '12',
    borderRadius: 12,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  warningBannerExpanded: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.ochre + '08',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.ochre + '22',
  },
  warningTextExpanded: {
    flex: 1,
    fontSize: 12,
    color: COLORS.ochre,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  operationsList: {
    gap: 8,
  },
  operationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.container + '12',
    borderRadius: 12,
    gap: 12,
  },
  operationItemUndone: {
    opacity: 0.5,
  },
  operationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.primary + '12',
    borderRadius: 8,
  },
  actionBadgeUndone: {
    backgroundColor: COLORS.textMuted + '12',
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  actionBadgeTextUndone: {
    color: COLORS.textMuted,
  },
  operationTargetText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  operationTargetTextUndone: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  operationTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  undoneIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.textMuted + '12',
    borderRadius: 8,
  },
  undoneIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
  },
  sheetHandleIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted + '55',
  },
});

// Memoize component to prevent unnecessary re-renders and shared value recreation
export default React.memo(BatchOperationCard, (prevProps, nextProps) => {
  // Primary identity check
  if (prevProps.groupId !== nextProps.groupId) return false;

  // Metadata checks
  if (prevProps.operationCount !== nextProps.operationCount) return false;
  if (prevProps.undoState !== nextProps.undoState) return false;
  if (prevProps.actorPhotos !== nextProps.actorPhotos) return false;

  // Operations array validation (critical for undo state updates)
  if (prevProps.operations.length !== nextProps.operations.length) return false;

  // Check if any operation undo state changed (common after undo action)
  const prevUndone = prevProps.operations.filter(op => op.undone_at).length;
  const nextUndone = nextProps.operations.filter(op => op.undone_at).length;
  if (prevUndone !== nextUndone) return false;

  // Description/metadata changes
  if (prevProps.description !== nextProps.description) return false;

  // Callback references are allowed to change (they're stable in parent)
  return true;
});
