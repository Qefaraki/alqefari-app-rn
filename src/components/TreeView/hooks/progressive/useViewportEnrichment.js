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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useTreeStore } from '../../../../stores/useTreeStore';
import profilesService from '../../../../services/profiles';
import { getVisibleNodeIds } from './utils';

export function useViewportEnrichment({ nodes = [], stage = null, dimensions = null }) {
  const enrichedNodesRef = useRef(new Set());
  const enrichTimeoutRef = useRef(null);

  // Phase 1: Batch state management
  const pendingUpdatesRef = useRef(new Map());
  const batchTimeoutRef = useRef(null);
  const maxWaitTimeoutRef = useRef(null);  // ✅ CRITICAL FIX: Force flush after 300ms even if scrolling
  const isMountedRef = useRef(true);
  const currentRequestIdRef = useRef(0);

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

  // Phase 1: Debounced batch flush function
  const flushBatch = useCallback(() => {
    if (!isMountedRef.current) return;

    const updates = Array.from(pendingUpdatesRef.current.values());
    if (updates.length === 0) return;

    const startTime = performance.now();

    try {
      // Single batch write to Zustand
      const treeStore = useTreeStore.getState();

      // Create new treeData with all updates applied at once
      const updatesMap = new Map(updates.map(u => [u.id, u]));
      const newTreeData = treeStore.treeData.map(node =>
        updatesMap.has(node.id)
          ? { ...node, ...updatesMap.get(node.id) }
          : node
      );

      // Update nodesMap
      const newNodesMap = new Map(treeStore.nodesMap);
      updates.forEach(update => {
        const existing = newNodesMap.get(update.id);
        if (existing) {
          newNodesMap.set(update.id, { ...existing, ...update });
        }
      });

      // Single state update (triggers 1 layout recalc instead of 18)
      treeStore.setTreeData(newTreeData);

      const duration = performance.now() - startTime;
      console.log(
        `✅ [Phase 3] Batched ${updates.length} enrichments in ${duration.toFixed(0)}ms`
      );

      // ✅ CRITICAL FIX: Clear AFTER successful update (was clearing before, causing data loss on error)
      pendingUpdatesRef.current.clear();
    } catch (error) {
      console.error('❌ [Phase 3] Batch flush failed:', error);
      // ✅ CRITICAL FIX: DO NOT clear on error - let retry happen on next enrichment
      // If we clear here, pending updates are lost forever
      console.warn('⚠️ [Phase 3] Pending updates retained for retry on next enrichment');
    }
  }, []);

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
      // Track concurrent requests to avoid applying stale data
      const requestId = ++currentRequestIdRef.current;

      try {
        console.log(
          `📦 [Phase 3] Enriching ${visibleNodeIds.length} visible nodes...`
        );
        const startTime = performance.now();

        const { data, error } = await profilesService.enrichVisibleNodes(
          visibleNodeIds
        );

        // Discard stale request if newer one was issued
        if (requestId !== currentRequestIdRef.current) {
          console.log('⚠️ [Phase 3] Stale enrichment request, discarding');
          return;
        }

        if (error) {
          console.error('❌ [Phase 3] Enrichment failed:', error);
          return;
        }

        if (!data || data.length === 0) {
          console.log('✅ [Phase 3] No new profiles to enrich');
          return;
        }

        // Phase 1: Batch accumulation instead of direct updateNode
        data.forEach(enrichedProfile => {
          // Accumulate in pending batch
          pendingUpdatesRef.current.set(enrichedProfile.id, enrichedProfile);
          enrichedNodesRef.current.add(enrichedProfile.id);
        });

        // ✅ CRITICAL FIX: Debounced batch flush with maxWait
        // Without maxWait, rapid scrolling can cause flush to never fire
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }

        // First time seeing enrichment in this scroll cycle - set maxWait timer
        if (!maxWaitTimeoutRef.current) {
          maxWaitTimeoutRef.current = setTimeout(() => {
            // Force flush after 300ms even if scrolling continues
            console.log('⏰ [Phase 3] maxWait timeout - forcing batch flush');
            flushBatch();
            maxWaitTimeoutRef.current = null;
          }, 300);
        }

        // Normal debounce - reset on each scroll event
        batchTimeoutRef.current = setTimeout(() => {
          if (maxWaitTimeoutRef.current) {
            clearTimeout(maxWaitTimeoutRef.current);
            maxWaitTimeoutRef.current = null;
          }
          flushBatch();
        }, 100);

        const duration = performance.now() - startTime;
        console.log(
          `📦 [Phase 3] Queued ${data.length} nodes for batch enrichment (${duration.toFixed(0)}ms)`
        );
      } catch (err) {
        console.error('❌ [Phase 3] Enrichment exception:', err);
      }
    }, 300);

    return () => {
      if (enrichTimeoutRef.current) {
        clearTimeout(enrichTimeoutRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, [visibleNodeIds, flushBatch]);

  // Phase 1: Unmount flush to prevent data loss
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Synchronous flush on unmount to prevent data loss
      if (pendingUpdatesRef.current.size > 0) {
        console.log(
          `⚠️ [Phase 3] Flushing ${pendingUpdatesRef.current.size} pending updates on unmount`
        );

        const updates = Array.from(pendingUpdatesRef.current.values());
        const treeStore = useTreeStore.getState();
        const updatesMap = new Map(updates.map(u => [u.id, u]));
        const newTreeData = treeStore.treeData.map(node =>
          updatesMap.has(node.id)
            ? { ...node, ...updatesMap.get(node.id) }
            : node
        );
        treeStore.setTreeData(newTreeData);

        pendingUpdatesRef.current.clear();
      }

      // Clear all timeouts on unmount
      if (enrichTimeoutRef.current) {
        clearTimeout(enrichTimeoutRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, []);

  // No render output - this hook handles side effects only
  return null;
}
