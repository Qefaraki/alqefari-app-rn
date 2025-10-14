import { create } from 'zustand';

/**
 * Undo Store
 *
 * Manages undo state and recent undo history for the app.
 * Used to show toast notifications and track recent undo operations.
 */

export const useUndoStore = create((set, get) => ({
  // Recent undo operations (for showing in UI)
  recentUndos: [],

  // Toast notification state
  toastVisible: false,
  toastMessage: '',
  toastType: 'success', // 'success' | 'error' | 'info'

  /**
   * Add an undo operation to recent history
   * @param {Object} undoOperation - The undo operation details
   */
  addRecentUndo: (undoOperation) =>
    set((state) => {
      const newUndos = [
        {
          ...undoOperation,
          timestamp: new Date().toISOString(),
          id: `${undoOperation.auditLogId}_${Date.now()}`,
        },
        ...state.recentUndos,
      ].slice(0, 10); // Keep only last 10 undos

      return { recentUndos: newUndos };
    }),

  /**
   * Clear recent undo history
   */
  clearRecentUndos: () => set({ recentUndos: [] }),

  /**
   * Remove a specific undo from recent history
   * @param {string} undoId - The ID of the undo to remove
   */
  removeRecentUndo: (undoId) =>
    set((state) => ({
      recentUndos: state.recentUndos.filter((undo) => undo.id !== undoId),
    })),

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - The type of toast ('success', 'error', 'info')
   */
  showToast: (message, type = 'success') =>
    set({
      toastVisible: true,
      toastMessage: message,
      toastType: type,
    }),

  /**
   * Hide the toast notification
   */
  hideToast: () =>
    set({
      toastVisible: false,
      toastMessage: '',
    }),

  /**
   * Get the most recent undo for a specific profile
   * @param {string} profileId - The profile ID to search for
   * @returns {Object|null} - The most recent undo for that profile, or null
   */
  getMostRecentUndoForProfile: (profileId) => {
    const { recentUndos } = get();
    return recentUndos.find((undo) => undo.profileId === profileId) || null;
  },

  /**
   * Check if an action was recently undone
   * @param {string} auditLogId - The audit log ID to check
   * @returns {boolean} - True if this action was recently undone
   */
  wasRecentlyUndone: (auditLogId) => {
    const { recentUndos } = get();
    return recentUndos.some((undo) => undo.auditLogId === auditLogId);
  },
}));
