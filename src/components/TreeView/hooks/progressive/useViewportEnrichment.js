/**
 * useViewportEnrichment - Phase 3: Progressive data enrichment
 *
 * Purpose: Load rich data (photos, bio) for visible nodes only
 *
 * Strategy:
 * 1. Track visible node IDs based on viewport + stage transform
 * 2. Debounce viewport changes (wait for user to stop scrolling)
 * 3. Load rich data for visible nodes from backend
 * 4. Merge into existing nodes WITHOUT recalculating layout
 *
 * Key: Data enrichment is independent of layout, so no jumping occurs
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useTreeStore } from '../../../../stores/useTreeStore';
import profilesService from '../../../../services/profiles';
import { getVisibleNodeIds } from './utils';

export function useViewportEnrichment({ nodes = [], stage = null, dimensions = null }) {
  const enrichedNodesRef = useRef(new Set());
  const enrichTimeoutRef = useRef(null);

  // Get stage/dimensions from TreeView context if not provided
  const defaultStage = useSharedValue({ x: 0, y: 0, scale: 1 });
  const actualStage = stage || defaultStage;
  const actualDimensions = dimensions || { width: 375, height: 667 };

  // Calculate visible node IDs based on viewport
  const visibleNodeIds = useMemo(() => {
    return getVisibleNodeIds(
      nodes,
      actualStage.value || { x: 0, y: 0, scale: 1 },
      actualDimensions,
      enrichedNodesRef.current,
      200 // padding: preload nodes 200px outside viewport
    );
  }, [nodes, actualStage, actualDimensions]);

  // Enrich visible nodes
  useEffect(() => {
    // Clear previous timeout
    if (enrichTimeoutRef.current) {
      clearTimeout(enrichTimeoutRef.current);
    }

    if (visibleNodeIds.length === 0) {
      return;
    }

    // Debounce: Wait for user to stop scrolling before loading (300ms)
    enrichTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(
          `📦 [Phase 3] Enriching ${visibleNodeIds.length} visible nodes...`
        );
        const startTime = performance.now();

        const { data, error } = await profilesService.enrichVisibleNodes(
          visibleNodeIds
        );

        if (error) {
          console.error('❌ [Phase 3] Enrichment failed:', error);
          return;
        }

        if (!data || data.length === 0) {
          console.log('✅ [Phase 3] No new profiles to enrich');
          return;
        }

        // Merge enriched data into store WITHOUT recalculating layout
        data.forEach(enrichedProfile => {
          useTreeStore.getState().updateNode(enrichedProfile.id, enrichedProfile);
          enrichedNodesRef.current.add(enrichedProfile.id);
        });

        const duration = performance.now() - startTime;
        console.log(
          `✅ [Phase 3] Enriched ${data.length} nodes in ${duration.toFixed(0)}ms`
        );
      } catch (err) {
        console.error('❌ [Phase 3] Enrichment exception:', err);
      }
    }, 300);

    return () => {
      if (enrichTimeoutRef.current) {
        clearTimeout(enrichTimeoutRef.current);
      }
    };
  }, [visibleNodeIds]);

  // No render output - this hook handles side effects only
  return null;
}
