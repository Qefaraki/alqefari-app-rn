/**
 * ChildRow Component
 *
 * Displays a child card with inline editing capabilities.
 * Features:
 * - View/edit child name and gender
 * - Delete child profile
 * - Navigate to child profile
 * - Optimistic locking (version conflict detection)
 * - Permission-based editing
 *
 * @module ChildRow
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { supabase } from '../../../services/supabase';
import { getInitials, AvatarThumbnail } from './FamilyHelpers';
import { PERMISSION_MESSAGES, ERROR_MESSAGES } from './permissionMessages';
import { TabFamilyContext } from './SpouseRow'; // Import shared context

/**
 * ChildRow Component
 *
 * @param {object} props
 * @param {object} props.child - Child profile data
 * @param {function} props.onEdit - Called when edit button is pressed
 * @param {function} props.onDelete - Called when delete is requested
 * @param {function} props.onVisit - Called when visit profile is pressed
 * @param {boolean} props.isEditing - Whether currently in edit mode
 * @param {function} props.onSave - Called after successful save
 * @param {function} props.onCancelEdit - Called when cancel edit is pressed
 */
const ChildRow = React.memo(
  ({ child, onEdit, onDelete, onVisit, isEditing = false, onSave, onCancelEdit }) => {
    const { canEditFamily } = React.useContext(TabFamilyContext);
    if (!child) return null;

    const [editingName, setEditingName] = useState('');
    const [editingGender, setEditingGender] = useState('male');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (isEditing) {
        setEditingName(child.name || '');
        setEditingGender(child.gender || 'male');
        setSaving(false);
      }
    }, [isEditing, child.name, child.gender]);

    const initials = getInitials(child.name);
    // Prefer cropped variant (Option A fix)
    const photoUrl = child.photo_url_cropped || child.photo_url || child.profile?.photo_url_cropped || child.profile?.photo_url || null;
    const displayName = isEditing ? editingName || '—' : child.name;
    const subtitle = !isEditing && child.birth_year ? `مواليد ${child.birth_year}` : null;

    const handleToggle = () => {
      if (isEditing) {
        Keyboard.dismiss();
        Haptics.selectionAsync();
        onCancelEdit?.();
      } else {
        if (!canEditFamily) {
          Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.title, PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.message);
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit?.(child);
      }
    };

    const handleDelete = () => {
      if (!canEditFamily) {
        Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_DELETE.title, PERMISSION_MESSAGES.UNAUTHORIZED_DELETE.message);
        return;
      }
      Haptics.selectionAsync();
      onDelete?.(child);
    };

    const handleVisit = () => {
      if (onVisit) {
        Haptics.selectionAsync();
        onVisit();
      }
    };

    const handleSave = async () => {
      Keyboard.dismiss();

      if (!canEditFamily) {
        Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_SAVE.title, PERMISSION_MESSAGES.UNAUTHORIZED_SAVE.message);
        return;
      }

      const trimmedName = editingName.trim();
      if (!trimmedName) {
        Alert.alert(ERROR_MESSAGES.EMPTY_CHILD_NAME.title, ERROR_MESSAGES.EMPTY_CHILD_NAME.message);
        return;
      }

      const nameChanged = trimmedName !== child.name;
      const genderChanged = editingGender !== child.gender;

      if (!nameChanged && !genderChanged) {
        onSave?.(child);
        return;
      }

      // Validate required ID before attempting save
      if (!child.id) {
        if (__DEV__) {
          console.error('Missing child.id for child:', child);
        }
        Alert.alert(ERROR_MESSAGES.MISSING_PROFILE_DATA.title, ERROR_MESSAGES.MISSING_PROFILE_DATA.message);
        return;
      }

      setSaving(true);
      try {
        const { error } = await supabase.rpc('admin_update_profile', {
          p_id: child.id,
          p_version: child.version || 1,
          p_updates: {
            name: trimmedName,
            gender: editingGender,
          },
        });
        if (error) throw error;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const updatedChild = {
          ...child,
          name: trimmedName,
          gender: editingGender,
          version: child.version ? child.version + 1 : 2, // Increment version after successful update
        };
        onSave?.(updatedChild);
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating child:', error);
        }

        // Check for version conflict (optimistic locking failure)
        const errorMessage = error.message || '';
        if (errorMessage.includes('version') || errorMessage.includes('تم تحديث البيانات') || error.code === 'P0001') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(ERROR_MESSAGES.VERSION_CONFLICT.title, ERROR_MESSAGES.VERSION_CONFLICT.message);
          return;
        }

        Alert.alert(ERROR_MESSAGES.SAVE_FAILED.title, ERROR_MESSAGES.SAVE_FAILED.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <View style={[styles.memberCard, isEditing && styles.memberCardEditing]}>
        <View style={styles.memberHeader}>
          <AvatarThumbnail photoUrl={photoUrl} fallbackLabel={initials} />
          <View style={styles.memberDetails}>
            <View style={styles.memberTitleRow}>
              <Text style={styles.memberName} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
              <TouchableOpacity
                style={[styles.memberChevron, !canEditFamily && { opacity: 0.4 }]}
                onPress={handleToggle}
                disabled={!canEditFamily}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'إغلاق المحرر' : 'تعديل بيانات الابن/الابنة'}
              >
                <Ionicons
                  name={isEditing ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={tokens.colors.najdi.textMuted}
                />
              </TouchableOpacity>
            </View>
            {subtitle ? (
              <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {isEditing ? (
          <View style={styles.inlineEditor}>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>الاسم الكامل</Text>
              <TextInput
                style={styles.inlineTextInput}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="اكتب الاسم"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!saving}
              />
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>الجنس</Text>
              <View style={styles.inlineSegments}>
                {[
                  { label: 'ذكر', value: 'male' },
                  { label: 'أنثى', value: 'female' },
                ].map((option) => {
                  const active = editingGender === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.inlineSegmentButton, active && styles.inlineSegmentButtonActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditingGender(option.value);
                      }}
                      activeOpacity={0.85}
                      disabled={saving}
                    >
                      <Text style={[styles.inlineSegmentLabel, active && styles.inlineSegmentLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inlineFooter}>
              <View style={styles.inlineFooterLinks}>
                {onVisit ? (
                  <TouchableOpacity
                    style={styles.inlineUtilityButton}
                    onPress={handleVisit}
                    disabled={saving}
                  >
                    <Ionicons name="open-outline" size={16} color={tokens.colors.najdi.primary} />
                    <Text style={styles.inlineUtilityText}>زيارة الملف</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.inlineUtilityButton}
                  onPress={handleDelete}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={tokens.colors.najdi.primary} />
                  <Text style={styles.inlineUtilityText}>حذف من العائلة</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inlineActionButtons}>
                <TouchableOpacity
                  style={styles.inlineCancelButton}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Text style={styles.inlineCancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveButton, saving && styles.inlineSaveButtonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={tokens.colors.surface} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={tokens.colors.surface} />
                      <Text style={styles.inlineSaveText}>حفظ</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  },
  (prev, next) => {
    // Compare preferred photo (cropped || original) for memo optimization
    // Defensive coding: Use optional chaining to prevent crashes if child is null/undefined
    const prevPhotoUrl = prev.child?.photo_url_cropped || prev.child?.photo_url || prev.child?.profile?.photo_url_cropped || prev.child?.profile?.photo_url || null;
    const nextPhotoUrl = next.child?.photo_url_cropped || next.child?.photo_url || next.child?.profile?.photo_url_cropped || next.child?.profile?.photo_url || null;

    return (
      prev.child?.id === next.child?.id &&
      prev.child?.name === next.child?.name &&
      prev.child?.gender === next.child?.gender &&
      prev.child?.birth_year === next.child?.birth_year &&
      prevPhotoUrl === nextPhotoUrl &&
      prev.isEditing === next.isEditing
    );
  }
);
ChildRow.displayName = 'ChildRow';

// PropTypes for ChildRow component
ChildRow.propTypes = {
  child: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    gender: PropTypes.oneOf(['male', 'female']),
    birth_year: PropTypes.number,
    photo_url: PropTypes.string,
    version: PropTypes.number,
    profile: PropTypes.shape({
      photo_url: PropTypes.string,
    }),
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onVisit: PropTypes.func,
  isEditing: PropTypes.bool,
  onSave: PropTypes.func,
  onCancelEdit: PropTypes.func,
};

/**
 * Styles for ChildRow component
 *
 * Reuses the same styles as SpouseRow for consistency
 * Follows Najdi Sadu design system with tokens-based spacing, colors, and typography
 */
const styles = StyleSheet.create({
  memberCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container  }33`,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  memberCardEditing: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  memberDetails: {
    flex: 1,
    gap: tokens.spacing.xxs,
    justifyContent: 'center',
  },
  memberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  memberName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 22,
  },
  memberSubtitle: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  memberChevron: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEditor: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
    gap: tokens.spacing.md,
  },
  inlineField: {
    gap: tokens.spacing.xs,
  },
  inlineFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  inlineTextInput: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  inlineSegments: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
    padding: 4,
    gap: 4,
  },
  inlineSegmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  inlineSegmentButtonActive: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  inlineSegmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  inlineSegmentLabelActive: {
    color: tokens.colors.surface,
  },
  inlineFooter: {
    gap: tokens.spacing.md,
  },
  inlineFooterLinks: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    gap: tokens.spacing.sm,
  },
  inlineUtilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  inlineUtilityText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  inlineActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  inlineCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  inlineCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  inlineSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.sm,
  },
  inlineSaveButtonDisabled: {
    opacity: 0.6,
  },
  inlineSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
  },
});

export default ChildRow;
