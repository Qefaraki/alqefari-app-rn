/**
 * ImageBuckets - Image size bucket selection with hysteresis
 *
 * Phase 2 Day 1 - Extracted from TreeView.js (lines 718-748)
 *
 * Manages progressive image quality selection based on node size.
 * Uses hysteresis to prevent bucket thrashing during zoom.
 *
 * Buckets: [40, 60, 80, 120, 256]
 * - 40px: Highly zoomed out (aggregation mode)
 * - 60px: Default for photos (3x retina = 180px @ 1:1)
 * - 80px: Slightly zoomed in
 * - 120px: Moderately zoomed in
 * - 256px: Highly zoomed in (max quality)
 *
 * Performance:
 * - Upgrades debounced 150ms to avoid thrashing
 * - Downgrades immediate to save memory
 * - Hysteresis ±15% prevents rapid bucket switching
 */

import {
  IMAGE_BUCKETS,
  DEFAULT_IMAGE_BUCKET,
  BUCKET_HYSTERESIS,
} from '../utils/constants/nodes';

// Bucket upgrade debounce time (ms)
const BUCKET_DEBOUNCE_MS = 150;

export interface BucketState {
  current: number; // Current bucket size
  timerId?: NodeJS.Timeout; // Debounce timer for upgrades
}

/**
 * Select image bucket size based on pixel size
 *
 * Simple selection without hysteresis - finds smallest bucket >= pixelSize
 *
 * @param pixelSize - Required pixel size for image
 * @returns Bucket size (40, 60, 80, 120, or 256)
 *
 * @example
 * selectBucket(50) // Returns 60
 * selectBucket(100) // Returns 120
 */
export function selectBucket(pixelSize: number): number {
  return IMAGE_BUCKETS.find((b) => b >= pixelSize) || DEFAULT_IMAGE_BUCKET;
}

/**
 * Select image bucket with hysteresis to prevent thrashing
 *
 * Applies ±15% hysteresis zone to prevent rapid bucket switching during zoom.
 * Upgrades are debounced 150ms, downgrades are immediate.
 *
 * @param nodeId - Node identifier for bucket state tracking
 * @param pixelSize - Required pixel size for image
 * @param bucketStates - Map of node IDs to bucket states
 * @param bucketTimers - Map of node IDs to debounce timers
 * @returns Selected bucket size
 *
 * @example
 * const states = new Map();
 * const timers = new Map();
 *
 * // Initial: 80px bucket
 * selectBucketWithHysteresis('n1', 90, states, timers); // Returns 120
 *
 * // Zoom in slightly: stays at 120 due to hysteresis
 * selectBucketWithHysteresis('n1', 130, states, timers); // Returns 120
 *
 * // Zoom in significantly: upgrade to 256 (debounced)
 * selectBucketWithHysteresis('n1', 200, states, timers); // Returns 120 (debouncing)
 * // After 150ms: bucket upgrades to 256
 *
 * // Zoom out: immediate downgrade
 * selectBucketWithHysteresis('n1', 50, states, timers); // Returns 60
 */
export function selectBucketWithHysteresis(
  nodeId: string,
  pixelSize: number,
  bucketStates: Map<string, number>,
  bucketTimers: Map<string, NodeJS.Timeout>
): number {
  const current = bucketStates.get(nodeId) || DEFAULT_IMAGE_BUCKET;
  const target = IMAGE_BUCKETS.find((b) => b >= pixelSize) || 512;

  // Apply hysteresis: stay at current bucket if within ±15% threshold
  if (target > current && pixelSize < current * (1 + BUCKET_HYSTERESIS)) {
    return current; // Upgrading, but within hysteresis zone → stay
  }
  if (target < current && pixelSize > current * (1 - BUCKET_HYSTERESIS)) {
    return current; // Downgrading, but within hysteresis zone → stay
  }

  // Debounce upgrades (wait 150ms before switching to larger bucket)
  if (target > current) {
    // Clear existing timer
    const existingTimer = bucketTimers.get(nodeId);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new debounced upgrade
    const timer = setTimeout(() => {
      bucketStates.set(nodeId, target);
      bucketTimers.delete(nodeId);
    }, BUCKET_DEBOUNCE_MS);

    bucketTimers.set(nodeId, timer);
    return current; // Return current bucket while debouncing
  }

  // Immediate downgrade (save memory ASAP)
  bucketStates.set(nodeId, target);
  return target;
}

/**
 * Clear bucket timer for a node (cleanup)
 *
 * @param nodeId - Node identifier
 * @param bucketTimers - Map of node IDs to debounce timers
 */
export function clearBucketTimer(
  nodeId: string,
  bucketTimers: Map<string, NodeJS.Timeout>
): void {
  const timer = bucketTimers.get(nodeId);
  if (timer) {
    clearTimeout(timer);
    bucketTimers.delete(nodeId);
  }
}

/**
 * Clear all bucket timers (cleanup on unmount)
 *
 * @param bucketTimers - Map of node IDs to debounce timers
 */
export function clearAllBucketTimers(
  bucketTimers: Map<string, NodeJS.Timeout>
): void {
  bucketTimers.forEach((timer) => clearTimeout(timer));
  bucketTimers.clear();
}

// Export constants for testing
export const BUCKET_CONSTANTS = {
  DEBOUNCE_MS: BUCKET_DEBOUNCE_MS,
  HYSTERESIS: BUCKET_HYSTERESIS,
  DEFAULT_BUCKET: DEFAULT_IMAGE_BUCKET,
  BUCKETS: IMAGE_BUCKETS,
};
