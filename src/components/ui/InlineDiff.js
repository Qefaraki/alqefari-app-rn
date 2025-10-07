/**
 * InlineDiff Component
 * Visual before/after comparison for activity log changes
 * Shows old → new values with proper RTL support and color coding
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';
import { formatFieldValue } from '../../services/activityLogTranslations';

const InlineDiff = ({ field, oldValue, newValue, showLabels = false }) => {
  // Format values for display
  const oldStr = formatFieldValue(field, oldValue);
  const newStr = formatFieldValue(field, newValue);

  // Determine change type
  const changeType = !oldValue ? 'added' : !newValue ? 'removed' : 'modified';

  // Icon based on change type
  const icon = changeType === 'added' ? 'add-circle' :
               changeType === 'removed' ? 'remove-circle' :
               'create-outline';

  // Color based on change type
  const iconColor = changeType === 'added' ? tokens.colors.diff.added :
                    changeType === 'removed' ? tokens.colors.diff.removed :
                    tokens.colors.diff.modified;

  if (showLabels) {
    // Expanded view: side-by-side cards with labels
    // Order: NEW → ARROW → OLD (appears as OLD → NEW in RTL reading)
    return (
      <View style={styles.expandedDiff}>
        {/* NEW VALUE CARD (appears on LEFT, reads first from RIGHT in RTL) */}
        <View style={[styles.diffCard, styles.newValueCard]}>
          <Text style={styles.diffLabel}>القيمة الجديدة</Text>
          <Text style={styles.newValueText} numberOfLines={3}>
            {newStr}
          </Text>
        </View>

        {/* ARROW (pointing RIGHT for RTL flow: from OLD to NEW) */}
        <Ionicons
          name="arrow-forward"
          size={20}
          color={tokens.colors.textMuted}
          style={styles.arrowIcon}
        />

        {/* OLD VALUE CARD (appears on RIGHT, reads last in RTL) */}
        <View style={[styles.diffCard, styles.oldValueCard]}>
          <Text style={styles.diffLabel}>القيمة القديمة</Text>
          <Text style={styles.oldValueText} numberOfLines={3}>
            {oldStr}
          </Text>
        </View>
      </View>
    );
  }

  // Collapsed view: inline diff (reads right-to-left in RTL: OLD → NEW)
  // Order: ICON → OLD → ARROW → NEW (appears as NEW ← OLD [ICON] in RTL reading)
  return (
    <View style={styles.inlineDiff}>
      {/* Change type icon (appears on RIGHT in RTL) */}
      <Ionicons
        name={icon}
        size={16}
        color={iconColor}
        style={styles.diffIcon}
      />

      {/* OLD VALUE (strikethrough, muted - appears second from right) */}
      <Text style={styles.oldValueInline} numberOfLines={1}>
        {oldStr}
      </Text>

      {/* ARROW (pointing right: from OLD to NEW) */}
      <Ionicons
        name="arrow-forward"
        size={14}
        color={tokens.colors.textMuted}
      />

      {/* NEW VALUE (bold, green - appears on LEFT) */}
      <Text style={styles.newValueInline} numberOfLines={1}>
        {newStr}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // ===== INLINE DIFF (Collapsed View) =====
  inlineDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  diffIcon: {
    marginLeft: 2,
  },
  newValueInline: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.diff.added,
    flexShrink: 1,
  },
  oldValueInline: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.textMuted,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },

  // ===== EXPANDED DIFF (Side-by-side Cards) =====
  expandedDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  diffCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  oldValueCard: {
    backgroundColor: tokens.colors.diff.removedBg,
    borderColor: tokens.colors.diff.removed + '30',
  },
  newValueCard: {
    backgroundColor: tokens.colors.diff.addedBg,
    borderColor: tokens.colors.diff.added + '30',
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.textMuted,
    marginBottom: 6,
  },
  oldValueText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.text,
    textDecorationLine: 'line-through',
  },
  newValueText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.text,
  },
  arrowIcon: {
    marginTop: 12, // Align with card content
  },
});

export default InlineDiff;
