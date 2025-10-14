/**
 * useMotherPicker Hook
 *
 * Manages mother selection and assignment logic with inline picker UI state.
 * Handles mother selection, removal, and permission checking.
 *
 * Features:
 * - Quick mother assignment with optimistic locking
 * - Mother removal with validation
 * - Picker visibility toggle
 * - Haptic feedback on actions
 * - Permission-based editing
 *
 * @module useMotherPicker
 */

import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../../services/supabase';
import { PERMISSION_MESSAGES, ERROR_MESSAGES } from '../permissionMessages';

/**
 * Custom hook for managing mother picker state and actions
 *
 * @param {object} params
 * @param {object} params.person - Current person profile
 * @param {boolean} params.canEditFamily - Whether user can edit family
 * @param {function} params.refreshProfile - Profile refresh function
 * @param {function} params.onDataChanged - Global data change callback
 * @param {function} params.onFamilyDataRefresh - Family data refresh function
 * @param {array} params.motherOptions - Available mother candidates
 * @returns {object} Mother picker state and actions
 */
export const useMotherPicker = ({
  person,
  canEditFamily,
  refreshProfile,
  onDataChanged,
  onFamilyDataRefresh,
  motherOptions = [],
}) => {
  const [motherPickerVisible, setMotherPickerVisible] = useState(false);
  const [updatingMotherId, setUpdatingMotherId] = useState(null);
  const [motherFeedback, setMotherFeedback] = useState(null);

  /**
   * Select and assign mother to current person
   * Uses optimistic locking to prevent concurrent modifications
   */
  const handleQuickMotherSelect = useCallback(
    async (motherId) => {
      if (!canEditFamily) {
        Alert.alert(
          PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_EDIT.title,
          PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_EDIT.message
        );
        return;
      }

      if (!person?.id || !motherId || motherId === person?.mother_id) return;

      setUpdatingMotherId(motherId);
      try {
        const { error } = await supabase.rpc('admin_update_profile', {
          p_id: person.id,
          p_version: person.version || 1, // Optimistic locking with fallback
          p_updates: { mother_id: motherId },
        });

        if (error) throw error;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Refresh family data
        if (onFamilyDataRefresh) {
          await onFamilyDataRefresh(true);
        }

        // Refresh profile
        if (refreshProfile) {
          await refreshProfile(person.id);
        }

        // Trigger global data change
        if (onDataChanged) {
          onDataChanged();
        }

        setMotherFeedback('تم تعيين الأم بنجاح');
        setMotherPickerVisible(false);
      } catch (error) {
        if (__DEV__) {
          console.error('Error assigning mother:', error);
        }
        Alert.alert(
          ERROR_MESSAGES.ASSIGN_MOTHER_FAILED.title,
          ERROR_MESSAGES.ASSIGN_MOTHER_FAILED.message
        );
      } finally {
        setUpdatingMotherId(null);
      }
    },
    [canEditFamily, person, refreshProfile, onDataChanged, onFamilyDataRefresh]
  );

  /**
   * Clear/remove mother assignment
   * Validates permission before removal
   */
  const handleClearMother = useCallback(async () => {
    if (!canEditFamily) {
      Alert.alert(
        PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_CLEAR.title,
        PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_CLEAR.message
      );
      return;
    }

    if (!person?.id || !person?.mother_id) return;

    setUpdatingMotherId('clear');
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: person.id,
        p_version: person.version || 1, // Optimistic locking with fallback
        p_updates: { mother_id: null },
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh family data
      if (onFamilyDataRefresh) {
        await onFamilyDataRefresh(true);
      }

      // Refresh profile
      if (refreshProfile) {
        await refreshProfile(person.id);
      }

      // Trigger global data change
      if (onDataChanged) {
        onDataChanged();
      }

      setMotherFeedback('تمت إزالة الأم');
      setMotherPickerVisible(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error clearing mother:', error);
      }
      Alert.alert(
        ERROR_MESSAGES.CLEAR_MOTHER_FAILED.title,
        ERROR_MESSAGES.CLEAR_MOTHER_FAILED.message
      );
    } finally {
      setUpdatingMotherId(null);
    }
  }, [canEditFamily, person, refreshProfile, onDataChanged, onFamilyDataRefresh]);

  /**
   * Toggle mother picker visibility
   * Validates permission and provides haptic feedback
   */
  const handleChangeMother = useCallback(() => {
    if (!canEditFamily) {
      Alert.alert(
        PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_EDIT.title,
        PERMISSION_MESSAGES.UNAUTHORIZED_MOTHER_EDIT.message
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMotherFeedback(null);
    setMotherPickerVisible((prev) => !prev);
  }, [canEditFamily]);

  /**
   * Close mother picker
   */
  const handleClosePicker = useCallback(() => {
    setMotherPickerVisible(false);
  }, []);

  /**
   * Memoize mother suggestions to prevent unnecessary iterations
   */
  const motherSuggestions = useMemo(() => {
    if (!motherOptions || motherOptions.length === 0) return [];
    return motherOptions;
  }, [motherOptions]);

  return {
    motherPickerVisible,
    updatingMotherId,
    motherFeedback,
    motherSuggestions,
    handleQuickMotherSelect,
    handleClearMother,
    handleChangeMother,
    handleClosePicker,
    setMotherFeedback, // For external feedback timeout management
  };
};

export default useMotherPicker;
