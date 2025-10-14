/**
 * useSpouseEditor Hook
 *
 * Manages marriage/spouse inline editing state and actions.
 * Handles edit activation, save callbacks, and state reset.
 *
 * Features:
 * - Haptic feedback on edit activation
 * - Optimistic update support
 * - Integration with parent refresh callbacks
 *
 * @module useSpouseEditor
 */

import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Custom hook for managing spouse editor state
 *
 * @param {object} params
 * @param {function} params.onMarriageUpdated - Callback when marriage is updated
 * @param {function} params.refreshProfile - Profile refresh function
 * @param {function} params.onDataChanged - Global data change callback
 * @param {string} params.personId - Current person's ID for refresh
 * @returns {object} Editor state and actions
 */
export const useSpouseEditor = ({
  onMarriageUpdated,
  refreshProfile,
  onDataChanged,
  personId,
}) => {
  const [editingMarriage, setEditingMarriage] = useState(null);

  /**
   * Activate marriage editor for given marriage
   * Provides haptic feedback for better UX
   */
  const handleEditMarriage = useCallback((marriage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingMarriage(marriage);
  }, []);

  /**
   * Handle successful marriage save
   * Updates state, refreshes profile, and triggers callbacks
   */
  const handleMarriageEditorSaved = useCallback(
    (updatedMarriage) => {
      if (updatedMarriage) {
        // Optimistic update: Update marriage in parent state
        if (onMarriageUpdated) {
          onMarriageUpdated(updatedMarriage);
        }

        // Trigger profile refresh
        if (refreshProfile) {
          refreshProfile(personId);
        }

        // Trigger global data change callback
        if (onDataChanged) {
          onDataChanged();
        }
      }

      // Always reset editor state
      setEditingMarriage(null);
    },
    [onMarriageUpdated, refreshProfile, onDataChanged, personId]
  );

  /**
   * Cancel editing and reset state
   */
  const handleCancelEdit = useCallback(() => {
    setEditingMarriage(null);
  }, []);

  /**
   * Check if a specific marriage is being edited
   */
  const isEditingMarriage = useCallback(
    (marriageId) => {
      return editingMarriage?.marriage_id === marriageId;
    },
    [editingMarriage]
  );

  return {
    editingMarriage,
    handleEditMarriage,
    handleMarriageEditorSaved,
    handleCancelEdit,
    isEditingMarriage,
  };
};

export default useSpouseEditor;
