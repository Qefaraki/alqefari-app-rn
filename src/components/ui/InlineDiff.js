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
import { useSettings } from '../../contexts/SettingsContext';
import { formatDateByPreference } from '../../utils/dateDisplay';
import { gregorianToHijri } from '../../utils/hijriConverter';
import { toArabicNumerals } from '../../utils/dateUtils';

const InlineDiff = ({ field, oldValue, newValue, showLabels = false }) => {
  const { settings } = useSettings();

  // Format timestamp fields with user's date preferences + time
  const formatTimestamp = (value) => {
    if (!value) return '—';
    try {
      const date = new Date(value);

      // Format date with user preferences
      const gregorian = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      };
      const hijri = gregorianToHijri(gregorian.year, gregorian.month, gregorian.day);
      const formattedDate = formatDateByPreference({ gregorian, hijri }, settings);

      // Add time (12-hour format with Arabic AM/PM)
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const isPM = hours >= 12;

      // Convert to 12-hour format
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;

      // Format time string
      const minutesStr = minutes.toString().padStart(2, '0');
      let timeStr = `${hours}:${minutesStr} ${isPM ? 'م' : 'ص'}`;

      // Convert to Arabic numerals if enabled
      if (settings?.arabicNumerals) {
        timeStr = toArabicNumerals(timeStr);
      }

      return `${formattedDate} - ${timeStr}`;
    } catch {
      return value;
    }
  };

  // Format values for display
  let oldStr, newStr;
  if (field === 'created_at' || field === 'updated_at') {
    oldStr = formatTimestamp(oldValue);
    newStr = formatTimestamp(newValue);
  } else {
    oldStr = formatFieldValue(field, oldValue);
    newStr = formatFieldValue(field, newValue);
  }

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
    // Native RTL: Code order [OLD, ARROW, NEW] displays as NEW←OLD and reads as OLD→NEW ✓
    return (
      <View style={styles.expandedDiff}>
        {/* OLD VALUE CARD (appears on RIGHT in RTL, reads first) */}
        <View style={[styles.diffCard, styles.oldValueCard]}>
          <Text style={styles.diffLabel}>القيمة القديمة</Text>
          <Text style={styles.oldValueText} numberOfLines={3}>
            {oldStr}
          </Text>
        </View>

        {/* ARROW (pointing LEFT: from OLD to NEW in visual layout) */}
        <Ionicons
          name="arrow-forward"
          size={20}
          color={tokens.colors.textMuted}
          style={styles.arrowIcon}
        />

        {/* NEW VALUE CARD (appears on LEFT in RTL, reads last) */}
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

  // ADDED: Show only new value with add icon
  if (changeType === 'added') {
    return (
      <View style={styles.inlineDiff}>
        <Ionicons
          name="add-circle"
          size={16}
          color={tokens.colors.diff.added}
          style={styles.diffIcon}
        />
        <Text style={styles.newValueInline} numberOfLines={1}>
          {newStr}
        </Text>
      </View>
    );
  }

  // REMOVED: Show only old value with remove icon
  if (changeType === 'removed') {
    return (
      <View style={styles.inlineDiff}>
        <Ionicons
          name="remove-circle"
          size={16}
          color={tokens.colors.diff.removed}
          style={styles.diffIcon}
        />
        <Text style={styles.oldValueInline} numberOfLines={1}>
          {oldStr}
        </Text>
      </View>
    );
  }

  // MODIFIED: Full comparison
  // Native RTL: Code order [ICON, OLD, ARROW, NEW] reads as ICON→OLD→ARROW→NEW ✓
  return (
    <View style={styles.inlineDiff}>
      {/* Change type icon (appears on RIGHTMOST in RTL) */}
      <Ionicons
        name={icon}
        size={16}
        color={iconColor}
        style={styles.diffIcon}
      />

      {/* OLD VALUE (strikethrough, muted - appears right-center) */}
      <Text style={styles.oldValueInline} numberOfLines={1}>
        {oldStr}
      </Text>

      {/* ARROW (pointing left: from OLD to NEW in visual layout) */}
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
