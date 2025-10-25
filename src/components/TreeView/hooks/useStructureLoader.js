/**
 * useStructureLoader - Phase 1: Load tree structure for progressive loading
 *
 * Purpose: Load minimal profile data (0.45 MB) for full tree layout calculation
 *
 * Returns: { structure, isLoading, error }
 * - structure: Array of profiles with minimal fields
 * - isLoading: true while loading
 * - error: null or error message
 *
 * Two-phase loading strategy:
 * Phase 1 (this hook): Load structure (0.45 MB)
 * Phase 2 (useProgressiveTreeView): Calculate layout ONCE with d3
 * Phase 3 (useViewportEnrichment): Enrich visible nodes with rich data
 */

import { useState, useEffect, useCallback } from 'react';
import { useTreeStore } from '../../../stores/useTreeStore';
import { useNetworkStore } from '../../../stores/networkStore';
import profilesService from '../../../services/profiles';

const TREE_STRUCTURE_SCHEMA_VERSION = '1.0.0';

export function useStructureLoader() {
  const [structure, setStructure] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStructure = useCallback(async () => {
    try {
      // Check cache first
      const storeState = useTreeStore.getState();
      const cachedStructure = storeState.treeData;
      const cachedVersion = storeState.cachedSchemaVersion;

      if (
        cachedStructure &&
        cachedStructure.length > 0 &&
        cachedVersion === TREE_STRUCTURE_SCHEMA_VERSION
      ) {
        const startTime = performance.now();
        console.log(`🚀 [Phase 1] Using cached structure (${cachedStructure.length} profiles)`);
        setStructure(cachedStructure);
        setIsLoading(false);
        const duration = performance.now() - startTime;
        console.log(`✅ [Phase 1] Cache load complete in ${duration.toFixed(0)}ms (instant, no network))`);
        return;
      }

      // Network check
      const networkStore = useNetworkStore.getState();
      if (!networkStore.isOnline()) {
        console.error('❌ [Phase 1] Network offline');
        setError('network');
        setIsLoading(false);
        return;
      }

      // Load structure from backend
      console.log('📦 [Phase 1] Loading tree structure...');
      const startTime = performance.now();

      const { data, error: fetchError } = await profilesService.getStructureOnly();

      if (fetchError || !data) {
        console.error('❌ [Phase 1] Failed to load structure:', fetchError);
        setError(fetchError || 'unknown');
        setIsLoading(false);
        return;
      }

      const duration = performance.now() - startTime;
      const sizeMB = (data.length * 158 / 1024 / 1024).toFixed(2);

      console.log(
        `✅ [Phase 1] Structure loaded: ${data.length} profiles (${sizeMB} MB) in ${duration.toFixed(0)}ms`
      );

      // Cache structure
      setStructure(data);
      useTreeStore.getState().setTreeData(data);
      useTreeStore.getState().setCachedSchemaVersion(TREE_STRUCTURE_SCHEMA_VERSION);

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('❌ [Phase 1] Structure load exception:', err);
      setError('unknown');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  return { structure, isLoading, error };
}
