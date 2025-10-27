/**
 * useEnhancedHighlighting - Public API Hook for Enhanced Highlighting System (Phase 3E)
 *
 * Developer-friendly hook that provides access to the new highlighting system.
 * Wraps Zustand store actions with React hooks pattern.
 *
 * Features:
 * - Add/remove/update highlights
 * - Access current highlights state
 * - Get rendering statistics
 * - Clear all highlights
 * - 5 path types: node-to-node, connection-only, ancestry, tree-wide, subtree
 *
 * @example Basic Usage
 * ```javascript
 * import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';
 *
 * function MyComponent() {
 *   const { addHighlight, removeHighlight, count } = useEnhancedHighlighting();
 *
 *   const showAncestry = (nodeId) => {
 *     const id = addHighlight({
 *       type: 'ancestry_path',
 *       nodeId,
 *       style: { color: '#A13333', opacity: 0.6 }
 *     });
 *     return id;
 *   };
 *
 *   return <Button onPress={() => showAncestry(123)} />;
 * }
 * ```
 *
 * @example Cleanup on Unmount
 * ```javascript
 * useEffect(() => {
 *   const id = addHighlight({ ... });
 *   return () => removeHighlight(id);
 * }, [nodeId]);
 * ```
 *
 * @version 2.0.0
 * @status Production-ready
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTreeStore } from '../stores/useTreeStore';

/**
 * useEnhancedHighlighting Hook
 *
 * @returns {Object} Highlighting API
 * @returns {Function} addHighlight - Add a new highlight definition
 * @returns {Function} removeHighlight - Remove highlight by ID
 * @returns {Function} updateHighlight - Update highlight style/config
 * @returns {Function} clearHighlights - Remove all highlights
 * @returns {Object} highlights - Current highlights state (Map<id, definition>)
 * @returns {number} count - Number of active highlights
 * @returns {Function} getStats - Get rendering statistics
 */
export function useEnhancedHighlighting() {
  // Access Zustand store actions
  const addHighlight = useTreeStore(s => s.addHighlight);
  const removeHighlight = useTreeStore(s => s.removeHighlight);
  const updateHighlight = useTreeStore(s => s.updateHighlight);
  const clearHighlights = useTreeStore(s => s.clearHighlights);
  const getHighlightStats = useTreeStore(s => s.getHighlightStats);

  // Access current highlights state
  const highlights = useTreeStore(s => s.highlights);

  // Calculate count (memoized selector would be better but this is acceptable)
  const count = Object.keys(highlights || {}).length;

  /**
   * Get rendering statistics
   * Useful for debugging and performance monitoring
   *
   * @param {Object} viewport - Optional viewport bounds for accurate stats
   * @returns {Object} Statistics about current highlights
   */
  const getStats = useCallback((viewport) => {
    return getHighlightStats(viewport);
  }, [getHighlightStats]);

  return {
    // Actions
    addHighlight,
    removeHighlight,
    updateHighlight,
    clearHighlights,

    // State
    highlights,
    count,

    // Utils
    getStats,
  };
}

/**
 * useHighlightDefinition - Hook for managing a single highlight
 *
 * Convenience hook that handles highlight lifecycle for a component.
 * Automatically cleans up on unmount.
 *
 * @param {Object} definition - Highlight definition
 * @param {boolean} enabled - Whether highlight is active (default: true)
 * @returns {string|null} Highlight ID (null if disabled)
 *
 * @example
 * ```javascript
 * function CousinHighlight({ userId, cousinId, enabled }) {
 *   const highlightId = useHighlightDefinition({
 *     type: 'node_to_node',
 *     from: userId,
 *     to: cousinId,
 *     style: { color: '#D58C4A', opacity: 0.7 }
 *   }, enabled);
 *
 *   return null; // Side effect only
 * }
 * ```
 */
export function useHighlightDefinition(definition, enabled = true) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (!enabled || !definition) {
      // Remove existing highlight if disabled
      if (highlightId) {
        removeHighlight(highlightId);
        setHighlightId(null);
      }
      return;
    }

    // Add highlight
    const id = addHighlight(definition);
    setHighlightId(id);

    // Cleanup on unmount or when definition changes
    return () => {
      if (id) {
        removeHighlight(id);
      }
    };
  }, [
    enabled,
    // Deep comparison would be better, but for now use JSON stringify
    JSON.stringify(definition),
    addHighlight,
    removeHighlight,
  ]);

  return highlightId;
}

/**
 * useTemporaryHighlight - Hook for temporary highlights (e.g., on hover)
 *
 * Automatically removes highlight after a timeout.
 * Useful for transient UI feedback.
 *
 * @param {number} duration - Duration in milliseconds (default: 3000)
 * @returns {Function} trigger - Function to trigger temporary highlight
 *
 * @example
 * ```javascript
 * function NodeCard({ node }) {
 *   const triggerHighlight = useTemporaryHighlight(2000);
 *
 *   const onPress = () => {
 *     triggerHighlight({
 *       type: 'ancestry_path',
 *       nodeId: node.id,
 *       style: { color: '#A13333', opacity: 0.8 }
 *     });
 *   };
 *
 *   return <TouchableOpacity onPress={onPress}>...</TouchableOpacity>;
 * }
 * ```
 */
export function useTemporaryHighlight(duration = 3000) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();
  const timeoutRef = useRef(null);

  const trigger = useCallback((definition) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add highlight
    const id = addHighlight(definition);

    // Schedule removal
    timeoutRef.current = setTimeout(() => {
      removeHighlight(id);
      timeoutRef.current = null;
    }, duration);

    return id;
  }, [addHighlight, removeHighlight, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return trigger;
}

/**
 * Highlight Type Constants (for convenience)
 */
export const HIGHLIGHT_TYPES = {
  NODE_TO_NODE: 'node_to_node',
  CONNECTION_ONLY: 'connection_only',
  ANCESTRY_PATH: 'ancestry_path',
  TREE_WIDE: 'tree_wide',
  SUBTREE: 'subtree',
};

/**
 * Preset Styles (Najdi Sadu color palette)
 */
export const HIGHLIGHT_STYLES = {
  PRIMARY: {
    color: '#A13333', // Najdi Crimson
    opacity: 0.6,
    strokeWidth: 4,
  },
  SECONDARY: {
    color: '#D58C4A', // Desert Ochre
    opacity: 0.5,
    strokeWidth: 3,
  },
  SUBTLE: {
    color: '#D1BBA3', // Camel Hair Beige
    opacity: 0.4,
    strokeWidth: 2,
  },
  ACCENT: {
    color: '#8B6F47', // Muted brown
    opacity: 0.7,
    strokeWidth: 5,
  },
};

export default useEnhancedHighlighting;
