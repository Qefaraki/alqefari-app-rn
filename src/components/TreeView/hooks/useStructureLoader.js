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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTreeStore } from '../../../stores/useTreeStore';
import { useNetworkStore } from '../../../stores/networkStore';
import profilesService from '../../../services/profiles';

const TREE_STRUCTURE_SCHEMA_VERSION = '1.1.0'; // Bumped: Added version field to get_structure_only RPC

export function useStructureLoader() {
  const [structure, setStructure] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStructure = useCallback(async () => {
    try {
      // Phase 1a: Try AsyncStorage cache first
      // Cache v4: No nodeWidth property (removed in migration 20251026000001)
      try {
        const cachedJson = await AsyncStorage.getItem('tree-structure-v4');
        if (cachedJson) {
          const cachedStructure = JSON.parse(cachedJson);

          // Use cache if it has >= 50 profiles (indicates valid, populated structure)
          if (cachedStructure && cachedStructure.length >= 50) {
            setStructure(cachedStructure);
            useTreeStore.getState().setTreeData(cachedStructure);
            setIsLoading(false);
            setError(null);
            return;
          }
        }
      } catch (cacheError) {
        // Continue to network fetch
      }

      // Network check
      const networkStore = useNetworkStore.getState();
      if (!networkStore.isOnline()) {
        setError('network');
        setIsLoading(false);
        return;
      }

      // Load structure from backend
      const { data, error: fetchError } = await profilesService.getStructureOnly();

      if (fetchError || !data) {
        setError(fetchError || 'unknown');
        setIsLoading(false);
        return;
      }

      // Save to AsyncStorage cache (v4: fresh data without nodeWidth)
      try {
        await AsyncStorage.setItem('tree-structure-v4', JSON.stringify(data));
      } catch (cacheError) {
        // Cache failure is non-critical
      }

      // Update store
      setStructure(data);
      useTreeStore.getState().setTreeData(data);
      useTreeStore.getState().setCachedSchemaVersion(TREE_STRUCTURE_SCHEMA_VERSION);

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Structure load exception:', err);
      setError('unknown');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  return { structure, isLoading, error };
}
