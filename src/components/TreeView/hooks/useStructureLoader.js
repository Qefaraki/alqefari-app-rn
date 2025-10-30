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

const TREE_STRUCTURE_SCHEMA_VERSION = '2.1.0'; // Bumped: Added status field to get_structure_only RPC for deceased photo grayscale

export function useStructureLoader() {
  const [structure, setStructure] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStructure = useCallback(async () => {
    try {
      // Phase 1a: Try AsyncStorage cache first
      // Cache format: { version, timestamp, profiles }
      try {
        const cachedJson = await AsyncStorage.getItem('tree-structure-v4');
        if (cachedJson) {
          const cacheData = JSON.parse(cachedJson);

          // Backward compatibility: Handle old format (array) and new format (object)
          const isOldFormat = Array.isArray(cacheData);
          const cachedVersion = isOldFormat ? null : cacheData.version;
          const cachedStructure = isOldFormat ? cacheData : cacheData.profiles;

          // Version check: Invalidate cache if version mismatch
          if (cachedVersion && cachedVersion !== TREE_STRUCTURE_SCHEMA_VERSION) {
            console.log(`[Cache] Version mismatch (${cachedVersion} → ${TREE_STRUCTURE_SCHEMA_VERSION}), invalidating cache`);
            await AsyncStorage.removeItem('tree-structure-v4');
            // Continue to network fetch
          } else if (!cachedVersion) {
            // Old format detected (before versioning), clear it
            console.log('[Cache] Old cache format detected (no version), invalidating cache');
            await AsyncStorage.removeItem('tree-structure-v4');
            // Continue to network fetch
          } else {
            // Version matches, use cache if valid
            if (cachedStructure && cachedStructure.length >= 50) {
              const cacheAge = Math.floor((Date.now() - cacheData.timestamp) / 1000 / 60);
              console.log(`[Cache Hit] v${cachedVersion}, ${cachedStructure.length} profiles, ${cacheAge}min old`);
              setStructure(cachedStructure);
              useTreeStore.getState().setTreeData(cachedStructure);
              setIsLoading(false);
              setError(null);
              return;
            }
          }
        }
      } catch (cacheError) {
        console.warn('[Cache] Error reading cache, will fetch from network:', cacheError);
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
      const fetchStartTime = Date.now();
      const { data, error: fetchError } = await profilesService.getStructureOnly();

      if (fetchError || !data) {
        setError(fetchError || 'unknown');
        setIsLoading(false);
        return;
      }

      // Save to AsyncStorage cache with version metadata
      try {
        const cacheData = {
          version: TREE_STRUCTURE_SCHEMA_VERSION,
          timestamp: Date.now(),
          profiles: data
        };
        await AsyncStorage.setItem('tree-structure-v4', JSON.stringify(cacheData));
        const fetchDuration = Date.now() - fetchStartTime;
        console.log(`[Cache Miss] Fetched ${data.length} profiles in ${fetchDuration}ms, saved as v${TREE_STRUCTURE_SCHEMA_VERSION}`);
      } catch (cacheError) {
        console.warn('[Cache] Failed to save cache, non-critical:', cacheError);
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
