/**
 * SpouseRow Component
 *
 * Displays a spouse card with inline editing capabilities.
 * Features:
 * - View/edit spouse name and marriage status
 * - Delete marriage
 * - Navigate to spouse profile
 * - Optimistic locking (version conflict detection)
 * - Permission-based editing
 *
 * @module SpouseRow
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import familyNameService from '../../../services/familyNameService';
import { getInitials, AvatarThumbnail } from './FamilyHelpers';
import { PERMISSION_MESSAGES, ERROR_MESSAGES } from './permissionMessages';
import { getCompleteNameChain } from '../../../utils/nameChainUtils';
import { formatNameWithTitle } from '../../../services/professionalTitleService';
import { useTreeStore } from '../../../stores/useTreeStore';

/**
 * TabFamilyContext
 * Provides permission state (canEditFamily) from parent TabFamily component
 */
export const TabFamilyContext = React.createContext({
  canEditFamily: false,
});

/**
 * SpouseRow Component
 *
 * @param {object} props
 * @param {object} props.spouseData - Spouse marriage data including spouse_profile
 * @param {function} props.onEdit - Called when edit button is pressed
 * @param {function} props.onDelete - Called when delete is requested
 * @param {function} props.onVisit - Called when visit profile is pressed
 * @param {boolean} props.inactive - Whether this is a past marriage
 * @param {boolean} props.isEditing - Whether currently in edit mode
 * @param {function} props.onSave - Called after successful save
 * @param {function} props.onCancelEdit - Called when cancel edit is pressed
 */
const SpouseRow = React.memo(
  ({
    spouseData,
    onEdit,
    onDelete,
    onVisit,
    inactive = false,
    isEditing = false,
    onSave,
    onCancelEdit,
  }) => {
    const { canEditFamily } = React.useContext(TabFamilyContext);
    const spouse = spouseData.spouse_profile;
    const nodesMap = useTreeStore((state) => state.nodesMap);
    const [editingName, setEditingName] = useState('');
    const [editingStatus, setEditingStatus] = useState('current');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (isEditing) {
        setEditingName(spouse?.name || '');
        const rawStatus = spouseData.status || 'current';
        setEditingStatus(
          rawStatus === 'past' || rawStatus === 'divorced' || rawStatus === 'widowed'
            ? 'past'
            : 'current'
        );
        setSaving(false);
      }
    }, [isEditing, spouse?.name, spouseData.status]);

    // Detect cousin marriage: Both spouses are Al-Qefari family members (have HID)
    const isCousinMarriage = useMemo(() => {
      return spouse?.hid !== null && spouse?.hid !== undefined;
    }, [spouse?.hid]);

    if (!spouse) return null;

    // Display name logic:
    // - For cousin marriages: ALWAYS show complete chain with surname (even when expanded)
    // - For Munasib: Show editingName when editing (inline editor)
    const displayName = useMemo(() => {
      // For cousin marriages: ALWAYS show complete chain with surname (no truncation)
      if (isCousinMarriage) {
        const fullProfile = nodesMap.get(spouse.id) || spouse;
        const nameChain = getCompleteNameChain(fullProfile);
        return nameChain || formatNameWithTitle(fullProfile) || fullProfile.name || '—';
      }

      // For Munasib: Show editingName when editing (inline editor)
      if (isEditing) return editingName || '—';

      // Default: Simple name
      return spouse.name || '—';
    }, [isCousinMarriage, nodesMap, spouse, isEditing, editingName]);

    const subtitleParts = [];
    if (spouseData.children_count > 0) {
      subtitleParts.push(
        `${spouseData.children_count} ${spouseData.children_count === 1 ? 'طفل' : 'أطفال'}`
      );
    }
    if (inactive) {
      subtitleParts.push('زواج سابق');
    }
    const subtitle = subtitleParts.join(' • ');

    const handleToggle = () => {
      if (isEditing) {
        // Close expanded view for both cousin and Munasib
        Keyboard.dismiss();
        Haptics.selectionAsync();
        onCancelEdit?.();
      } else {
        // Expand view
        // Permission check only for Munasib (cousins can expand to see info)
        if (!isCousinMarriage && !canEditFamily) {
          Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.title, PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.message);
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit?.(spouseData);
      }
    };

    const handleDelete = () => {
      if (!canEditFamily) {
        Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_DELETE.title, PERMISSION_MESSAGES.UNAUTHORIZED_DELETE.message);
        return;
      }
      Haptics.selectionAsync();
      onDelete?.(spouseData);
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
        Alert.alert(ERROR_MESSAGES.EMPTY_SPOUSE_NAME.title, ERROR_MESSAGES.EMPTY_SPOUSE_NAME.message);
        return;
      }

      // Validate minimum 2 words (name + surname), encourage 5 names
      const words = trimmedName.split(/\s+/);
      if (words.length < 2) {
        Alert.alert(ERROR_MESSAGES.INVALID_NAME_FORMAT.title, ERROR_MESSAGES.INVALID_NAME_FORMAT.message);
        return;
      }

      const originalName = spouse.name?.trim() || '';
      const statusChanged = spouseData.status !== editingStatus;
      const nameChanged = trimmedName !== originalName;

      if (!statusChanged && !nameChanged) {
        onSave?.(spouseData);
        return;
      }

      // Validate required IDs before attempting save
      if (statusChanged && !spouseData.marriage_id) {
        if (__DEV__) {
          console.error('Missing marriage_id for spouse:', spouseData);
        }
        Alert.alert(ERROR_MESSAGES.MISSING_MARRIAGE_DATA.title, ERROR_MESSAGES.MISSING_MARRIAGE_DATA.message);
        return;
      }

      if (nameChanged && !spouse.id) {
        if (__DEV__) {
          console.error('Missing spouse.id for spouse:', spouse);
        }
        Alert.alert(ERROR_MESSAGES.MISSING_PROFILE_DATA.title, ERROR_MESSAGES.MISSING_PROFILE_DATA.message);
        return;
      }

      setSaving(true);

      // Declare parsed at function scope (not inside if block)
      let parsed = null;

      try {
        if (statusChanged) {
          const { error } = await supabase.rpc('admin_update_marriage', {
            p_marriage_id: spouseData.marriage_id,
            p_updates: { status: editingStatus },
          });
          if (error) throw error;
        }

        if (nameChanged && spouse.id) {
          // Parse name to extract family_origin
          const spouseGender = spouse.gender || 'female';
          parsed = familyNameService.parseFullName(trimmedName, spouseGender);

          // Update both name AND family_origin atomically
          const profileUpdates = {
            name: trimmedName,
            family_origin: parsed.familyOrigin, // null for Al-Qefari (cousin marriage)
          };

          const { error: nameError } = await supabase.rpc('admin_update_profile', {
            p_id: spouse.id,
            p_version: spouse.version || 1,
            p_updates: profileUpdates,
          });
          if (nameError) throw nameError;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const updatedMarriage = {
          ...spouseData,
          status: editingStatus,
          spouse_profile: {
            ...spouse,
            name: trimmedName,
            family_origin: parsed?.familyOrigin, // Update local state too
            version: spouse.version ? spouse.version + 1 : 2, // Increment version after successful update
          },
        };
        onSave?.(updatedMarriage);
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating marriage:', error);
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
      <View
        style={[
          styles.memberCard,
          inactive && styles.memberCardInactive,
          isEditing && styles.memberCardEditing,
        ]}
      >
        <View style={styles.memberHeader}>
          <AvatarThumbnail photoUrl={spouse.photo_url} fallbackLabel={getInitials(spouse.name)} />
          <View style={styles.memberDetails}>
            <View style={styles.memberTitleRow}>
              <Text style={styles.memberName} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
              <TouchableOpacity
                style={[styles.memberChevron, (!canEditFamily && !isCousinMarriage) && { opacity: 0.4 }]}
                onPress={handleToggle}
                disabled={!canEditFamily && !isCousinMarriage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'إغلاق' : 'عرض التفاصيل'}
              >
                <Ionicons
                  name={isEditing ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={tokens.colors.najdi.textMuted}
                />
              </TouchableOpacity>
            </View>
            {!isEditing && subtitle ? (
              <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {isEditing ? (
          isCousinMarriage ? (
            // COUSIN MARRIAGE: Info message + Visit button
            <View style={styles.cousinInfoView}>
              <View style={styles.infoMessageBox}>
                <Ionicons name="information-circle-outline" size={20} color={tokens.colors.najdi.textMuted} />
                <Text style={styles.infoMessageText}>
                  {spouse.gender === 'male'
                    ? 'هذا من أبناء الأسرة. قم بزيارة ملفه للتعديل.'
                    : 'هذه من بنات الأسرة. قم بزيارة ملفها للتعديل.'}
                </Text>
              </View>

              {onVisit && (
                <TouchableOpacity
                  style={styles.visitProfileButtonFull}
                  onPress={handleVisit}
                  accessibilityRole="button"
                  accessibilityLabel={`زيارة ملف ${spouse.name}`}
                >
                  <Ionicons name="open-outline" size={16} color={tokens.colors.najdi.primary} />
                  <Text style={styles.visitProfileButtonFullText}>زيارة الملف الشخصي</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // MUNASIB MARRIAGE: Full inline editor
            <View style={styles.inlineEditor}>
              <View style={styles.inlineField}>
                <Text style={styles.inlineFieldLabel}>اسم الزوجة</Text>
                <TextInput
                  style={styles.inlineTextInput}
                  value={editingName}
                  onChangeText={setEditingName}
                  placeholder="اكتب الاسم الكامل"
                  placeholderTextColor={tokens.colors.najdi.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!saving}
                />
              </View>

              <View style={styles.inlineField}>
                <Text style={styles.inlineFieldLabel}>حالة الزواج</Text>
                <View style={styles.inlineSegments}>
                  {[
                    { label: 'حالي', value: 'current' },
                    { label: 'سابق', value: 'past' },
                  ].map((option) => {
                    const active = editingStatus === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.inlineSegmentButton, active && styles.inlineSegmentButtonActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditingStatus(option.value);
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
                    <Text style={styles.inlineUtilityText}>حذف الزواج</Text>
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
          )
        ) : null}
      </View>
    );
  },
  (prev, next) => {
    const prevPhotoUrl = prev.spouseData.spouse_profile?.photo_url;
    const nextPhotoUrl = next.spouseData.spouse_profile?.photo_url;
    return (
      prev.spouseData.marriage_id === next.spouseData.marriage_id &&
      prev.spouseData.children_count === next.spouseData.children_count &&
      prev.spouseData.spouse_profile?.name === next.spouseData.spouse_profile?.name &&
      prevPhotoUrl === nextPhotoUrl &&
      prev.inactive === next.inactive &&
      prev.isEditing === next.isEditing &&
      prev.spouseData._deletingState === next.spouseData._deletingState // Required for delete animation
    );
  }
);
SpouseRow.displayName = 'SpouseRow';

// PropTypes for SpouseRow component
SpouseRow.propTypes = {
  spouseData: PropTypes.shape({
    spouse_profile: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      photo_url: PropTypes.string,
      gender: PropTypes.string,
      version: PropTypes.number,
    }),
    marriage_id: PropTypes.string,
    status: PropTypes.string,
    children_count: PropTypes.number,
    _deletingState: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onVisit: PropTypes.func,
  inactive: PropTypes.bool,
  isEditing: PropTypes.bool,
  onSave: PropTypes.func,
  onCancelEdit: PropTypes.func,
};

/**
 * Styles for SpouseRow component
 *
 * Follows Najdi Sadu design system with tokens-based spacing, colors, and typography
 */
const styles = StyleSheet.create({
  memberCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '33',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  memberCardInactive: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '55',
    opacity: 0.85,
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
  cousinInfoView: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
    gap: tokens.spacing.md,
  },
  infoMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  infoMessageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.najdi.text,
  },
  visitProfileButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.surface,
  },
  visitProfileButtonFullText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
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

export default SpouseRow;
