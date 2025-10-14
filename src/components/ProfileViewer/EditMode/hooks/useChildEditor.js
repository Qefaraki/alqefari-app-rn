/**
 * useChildEditor Hook
 *
 * Manages child profile inline editing state and actions.
 * Handles edit activation, save callbacks, and state reset.
 *
 * Features:
 * - Haptic feedback on edit activation
 * - Optimistic update support
 * - Integration with parent refresh callbacks
 *
 * @module useChildEditor
 */

import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Custom hook for managing child editor state
 *
 * @param {object} params
 * @param {function} params.onChildUpdated - Callback when child is updated
 * @param {function} params.refreshProfile - Profile refresh function
 * @param {function} params.onDataChanged - Global data change callback
 * @param {string} params.personId - Current person's ID for refresh
 * @returns {object} Editor state and actions
 */
export const useChildEditor = ({
  onChildUpdated,
  refreshProfile,
  onDataChanged,
  personId,
}) => {
  const [editingChild, setEditingChild] = useState(null);

  /**
   * Activate child editor for given child
   * Provides haptic feedback for better UX
   */
  const handleEditChild = useCallback((child) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingChild(child);
  }, []);

  /**
   * Handle successful child save
   * Updates state, refreshes profile, and triggers callbacks
   */
  const handleChildEditorSaved = useCallback(
    (updatedChild) => {
      if (updatedChild) {
        // Optimistic update: Update child in parent state
        if (onChildUpdated) {
          onChildUpdated(updatedChild);
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
      setEditingChild(null);
    },
    [onChildUpdated, refreshProfile, onDataChanged, personId]
  );

  /**
   * Cancel editing and reset state
   */
  const handleCancelEdit = useCallback(() => {
    setEditingChild(null);
  }, []);

  /**
   * Check if a specific child is being edited
   */
  const isEditingChild = useCallback(
    (childId) => {
      return editingChild?.id === childId;
    },
    [editingChild]
  );

  return {
    editingChild,
    handleEditChild,
    handleChildEditorSaved,
    handleCancelEdit,
    isEditingChild,
  };
};

export default useChildEditor;
