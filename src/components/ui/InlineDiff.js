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
    return (
      <View style={styles.expandedDiff}>
        {/* OLD VALUE CARD (RIGHT in RTL) */}
        <View style={[styles.diffCard, styles.oldValueCard]}>
          <Text style={styles.diffLabel}>القيمة القديمة</Text>
          <Text style={styles.oldValueText} numberOfLines={3}>
            {oldStr}
          </Text>
        </View>

        {/* ARROW (pointing RIGHT in RTL for natural reading flow) */}
        <Ionicons
          name="arrow-forward"
          size={20}
          color={tokens.colors.textMuted}
          style={styles.arrowIcon}
        />

        {/* NEW VALUE CARD (LEFT in RTL) */}
        <View style={[styles.diffCard, styles.newValueCard]}>
          <Text style={styles.diffLabel}>القيمة الجديدة</Text>
          <Text style={styles.newValueText} numberOfLines={3}>
            {newStr}
          </Text>
        </View>
      </View>
    );
  }

  // Collapsed view: inline diff (reads right-to-left in RTL: OLD → NEW)
  return (
    <View style={styles.inlineDiff}>
      {/* Change type icon */}
      <Ionicons
        name={icon}
        size={16}
        color={iconColor}
        style={styles.diffIcon}
      />

      {/* NEW VALUE (bold, green) */}
      <Text style={styles.newValueInline} numberOfLines={1}>
        {newStr}
      </Text>

      {/* ARROW (pointing right in RTL for natural reading flow) */}
      <Ionicons
        name="arrow-forward"
        size={14}
        color={tokens.colors.textMuted}
      />

      {/* OLD VALUE (strikethrough, muted) */}
      <Text style={styles.oldValueInline} numberOfLines={1}>
        {oldStr}
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
