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
      try {
        const cachedJson = await AsyncStorage.getItem('tree-structure-v3');
        if (cachedJson) {
          const cachedStructure = JSON.parse(cachedJson);

          // Use cache if it has >= 50 profiles (indicates valid, populated structure)
          if (cachedStructure && cachedStructure.length >= 50) {
            console.log(`🚀 [Phase 1] Using cached structure (${cachedStructure.length} profiles)`);
            setStructure(cachedStructure);
            useTreeStore.getState().setTreeData(cachedStructure);
            setIsLoading(false);
            setError(null);
            return;
          }
        }
      } catch (cacheError) {
        console.warn('[Phase 1] Cache load failed, will fetch from network:', cacheError);
        // Continue to network fetch
      }

      // Phase 1b: Network check
      const networkStore = useNetworkStore.getState();
      if (!networkStore.isOnline()) {
        console.error('❌ [Phase 1] Network offline');
        setError('network');
        setIsLoading(false);
        return;
      }

      // Phase 1c: Load structure from backend
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

      // Phase 1d: Save to AsyncStorage cache
      try {
        await AsyncStorage.setItem('tree-structure-v3', JSON.stringify(data));
        console.log(`💾 [Phase 1] Structure cached to AsyncStorage`);
      } catch (cacheError) {
        console.warn('[Phase 1] Failed to cache structure (optional):', cacheError);
        // Cache failure is non-critical
      }

      // Phase 1e: Update store
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
