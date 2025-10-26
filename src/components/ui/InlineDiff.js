/**
 * InlineDiff Component
 * Visual before/after comparison for activity log changes
 * Shows old → new values with proper RTL support and color coding
 * Now supports photo/image field display
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';
import { formatFieldValue } from '../../services/activityLogTranslations';
import { useSettings } from '../../contexts/SettingsContext';
import { formatDateByPreference } from '../../utils/dateDisplay';
import { gregorianToHijri } from '../../utils/hijriConverter';
import { toArabicNumerals } from '../../utils/dateUtils';

// Helper: Detect if field is a photo field
const isPhotoField = (field) => {
  if (!field) return false;
  return field === 'photo_url' ||
         field === 'photo' ||
         field?.toLowerCase().includes('photo') ||
         field?.toLowerCase().includes('image');
};

// Helper: Detect if value is a photo URL
const isPhotoURL = (value) => {
  if (!value || typeof value !== 'string') return false;
  return (value.startsWith('http://') || value.startsWith('https://')) &&
         (value.includes('supabase') ||
          value.includes('storage') ||
          value.match(/\.(jpg|jpeg|png|webp|gif)$/i));
};

/**
 * Helper: Detect relationship operations and return human-readable message
 * Returns null if not a relationship operation (use default formatting)
 */
const getRelationshipMessage = (field, oldValue, newValue) => {
  // Marriage deletion (soft delete)
  if (field === 'deleted_at' && !oldValue && newValue) {
    return { old: 'نشط', new: 'تم حذف الزوجة' };
  }

  // Marriage restoration
  if (field === 'deleted_at' && oldValue && !newValue) {
    return { old: 'محذوف', new: 'تم استرجاع الزوجة' };
  }

  // Mother addition
  if (field === 'mother_id' && !oldValue && newValue) {
    return { old: '—', new: 'تمت إضافة الأم' };
  }

  // Mother deletion
  if (field === 'mother_id' && oldValue && !newValue) {
    return { old: 'كانت موجودة', new: 'تم حذف الأم' };
  }

  // Mother update/change
  if (field === 'mother_id' && oldValue && newValue) {
    return { old: 'أم سابقة', new: 'تم تغيير الأم' };
  }

  // Father addition
  if (field === 'father_id' && !oldValue && newValue) {
    return { old: '—', new: 'تمت إضافة الأب' };
  }

  // Father deletion
  if (field === 'father_id' && oldValue && !newValue) {
    return { old: 'كان موجود', new: 'تم حذف الأب' };
  }

  // Father update/change
  if (field === 'father_id' && oldValue && newValue) {
    return { old: 'أب سابق', new: 'تم تغيير الأب' };
  }

  // Spouse addition
  if (field === 'spouse_id' && !oldValue && newValue) {
    return { old: '—', new: 'تمت إضافة الزوج/الزوجة' };
  }

  // Spouse deletion
  if (field === 'spouse_id' && oldValue && !newValue) {
    return { old: 'كان موجود', new: 'تم حذف الزوج/الزوجة' };
  }

  return null; // Not a relationship operation, use default formatting
};

/**
 * PhotoDiff Sub-Component
 * Renders photo changes with thumbnails or full-size images
 */
const PhotoDiff = ({ oldValue, newValue, showLabels = false, changeType }) => {
  const [oldImageError, setOldImageError] = useState(false);
  const [newImageError, setNewImageError] = useState(false);
  const [oldImageLoaded, setOldImageLoaded] = useState(false);
  const [newImageLoaded, setNewImageLoaded] = useState(false);

  // For expanded view with labels
  if (showLabels) {
    return (
      <View style={styles.photoDiffExpanded}>
        {/* OLD PHOTO CARD */}
        <View style={[styles.photoCard, styles.oldPhotoCard]}>
          <Text style={styles.diffLabel}>القيمة القديمة</Text>
          {changeType === 'removed' ? (
            <View style={styles.photoPlaceholder}>
              <Ionicons
                name="image-outline"
                size={40}
                color={tokens.colors.textMuted}
              />
              <Text style={styles.photoRemoved}>تم حذف الصورة</Text>
            </View>
          ) : isPhotoURL(oldValue) ? (
            <View style={styles.photoContainer}>
              {!oldImageLoaded && (
                <ActivityIndicator
                  size="large"
                  color={tokens.colors.textMuted}
                  style={styles.photoLoader}
                />
              )}
              <Image
                source={{ uri: oldValue }}
                style={styles.photoLarge}
                onLoad={() => setOldImageLoaded(true)}
                onError={() => setOldImageError(true)}
              />
              {oldImageError && (
                <View style={styles.photoPlaceholder}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={40}
                    color={tokens.colors.diff.removed}
                  />
                  <Text style={styles.photoError}>فشل تحميل الصورة</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons
                name="image-outline"
                size={40}
                color={tokens.colors.textMuted}
              />
              <Text style={styles.photoRemoved}>لا توجد صورة</Text>
            </View>
          )}
        </View>

        {/* ARROW */}
        <Ionicons
          name="arrow-back"
          size={20}
          color={tokens.colors.textMuted}
          style={styles.arrowIcon}
        />

        {/* NEW PHOTO CARD */}
        <View style={[styles.photoCard, styles.newPhotoCard]}>
          <Text style={styles.diffLabel}>القيمة الجديدة</Text>
          {changeType === 'added' ? (
            isPhotoURL(newValue) ? (
              <View style={styles.photoContainer}>
                {!newImageLoaded && (
                  <ActivityIndicator
                    size="large"
                    color={tokens.colors.textMuted}
                    style={styles.photoLoader}
                  />
                )}
                <Image
                  source={{ uri: newValue }}
                  style={styles.photoLarge}
                  onLoad={() => setNewImageLoaded(true)}
                  onError={() => setNewImageError(true)}
                />
                {newImageError && (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={40}
                      color={tokens.colors.diff.added}
                    />
                    <Text style={styles.photoError}>فشل تحميل الصورة</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={tokens.colors.textMuted}
                />
                <Text style={styles.photoRemoved}>لا توجد صورة</Text>
              </View>
            )
          ) : (
            <View style={styles.photoContainer}>
              {!newImageLoaded && (
                <ActivityIndicator
                  size="large"
                  color={tokens.colors.textMuted}
                  style={styles.photoLoader}
                />
              )}
              <Image
                source={{ uri: newValue }}
                style={styles.photoLarge}
                onLoad={() => setNewImageLoaded(true)}
                onError={() => setNewImageError(true)}
              />
              {newImageError && (
                <View style={styles.photoPlaceholder}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={40}
                    color={tokens.colors.diff.added}
                  />
                  <Text style={styles.photoError}>فشل تحميل الصورة</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  // Inline view with thumbnails (collapsed)
  return (
    <View style={styles.photoDiffInline}>
      {/* Change icon */}
      <Ionicons
        name={changeType === 'added' ? 'add-circle' : changeType === 'removed' ? 'remove-circle' : 'create-outline'}
        size={16}
        color={
          changeType === 'added'
            ? tokens.colors.diff.added
            : changeType === 'removed'
            ? tokens.colors.diff.removed
            : tokens.colors.diff.modified
        }
        style={styles.diffIcon}
      />

      {/* OLD PHOTO THUMBNAIL */}
      {changeType !== 'added' && (
        <>
          {isPhotoURL(oldValue) ? (
            <View style={styles.photoThumbnailContainer}>
              {!oldImageLoaded && <ActivityIndicator size="small" color={tokens.colors.textMuted} />}
              <Image
                source={{ uri: oldValue }}
                style={styles.photoThumbnail}
                onLoad={() => setOldImageLoaded(true)}
                onError={() => setOldImageError(true)}
              />
              {oldImageError && (
                <View style={styles.photoThumbnailError}>
                  <Ionicons name="alert-circle-outline" size={14} color={tokens.colors.diff.removed} />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.photoThumbnail, styles.photoThumbnailEmpty]}>
              <Ionicons name="image-outline" size={12} color={tokens.colors.textMuted} />
            </View>
          )}
        </>
      )}

      {/* ARROW */}
      {changeType === 'modified' && (
        <Ionicons
          name="arrow-back"
          size={14}
          color={tokens.colors.textMuted}
        />
      )}

      {/* NEW PHOTO THUMBNAIL */}
      {changeType !== 'removed' && (
        <>
          {isPhotoURL(newValue) ? (
            <View style={styles.photoThumbnailContainer}>
              {!newImageLoaded && <ActivityIndicator size="small" color={tokens.colors.textMuted} />}
              <Image
                source={{ uri: newValue }}
                style={styles.photoThumbnail}
                onLoad={() => setNewImageLoaded(true)}
                onError={() => setNewImageError(true)}
              />
              {newImageError && (
                <View style={styles.photoThumbnailError}>
                  <Ionicons name="alert-circle-outline" size={14} color={tokens.colors.diff.added} />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.photoThumbnail, styles.photoThumbnailEmpty]}>
              <Ionicons name="image-outline" size={12} color={tokens.colors.textMuted} />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const InlineDiff = ({ field, oldValue, newValue, showLabels = false }) => {
  const { settings } = useSettings();

  // Determine change type (used for all rendering)
  const changeType = !oldValue ? 'added' : !newValue ? 'removed' : 'modified';

  // EARLY RETURN: If this is a photo field, use PhotoDiff component
  if (isPhotoField(field)) {
    return <PhotoDiff oldValue={oldValue} newValue={newValue} showLabels={showLabels} changeType={changeType} />;
  }

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

  // Check for relationship operations first (marriage, parent changes)
  const relationshipMsg = getRelationshipMessage(field, oldValue, newValue);

  // Format values for display
  let oldStr, newStr;
  if (relationshipMsg) {
    // Use human-readable relationship message
    oldStr = relationshipMsg.old;
    newStr = relationshipMsg.new;
  } else if (field === 'created_at' || field === 'updated_at') {
    oldStr = formatTimestamp(oldValue);
    newStr = formatTimestamp(newValue);
  } else {
    oldStr = formatFieldValue(field, oldValue);
    newStr = formatFieldValue(field, newValue);
  }

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

        {/* ARROW (pointing LEFT: from OLD to NEW) */}
        <Ionicons
          name="arrow-back"
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

      {/* ARROW (pointing left: from OLD to NEW) */}
      <Ionicons
        name="arrow-back"
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
    borderColor: `${tokens.colors.diff.removed  }30`,
  },
  newValueCard: {
    backgroundColor: tokens.colors.diff.addedBg,
    borderColor: `${tokens.colors.diff.added  }30`,
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

  // ===== PHOTO DIFF STYLES =====

  // Inline photo diff (collapsed view with thumbnails)
  photoDiffInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  photoThumbnailContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  photoThumbnailEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.diff.addedBg,
    borderColor: tokens.colors.diff.added,
  },
  photoThumbnailError: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
  },

  // Expanded photo diff (side-by-side cards with labels)
  photoDiffExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  photoCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 200,
  },
  oldPhotoCard: {
    backgroundColor: tokens.colors.diff.removedBg,
    borderColor: `${tokens.colors.diff.removed}30`,
  },
  newPhotoCard: {
    backgroundColor: tokens.colors.diff.addedBg,
    borderColor: `${tokens.colors.diff.added}30`,
  },
  photoContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minHeight: 150,
  },
  photoLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    resizeMode: 'contain',
  },
  photoLoader: {
    position: 'absolute',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 120,
  },
  photoRemoved: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.textMuted,
    marginTop: 8,
  },
  photoError: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    color: tokens.colors.text,
    marginTop: 8,
  },
});

export default InlineDiff;
