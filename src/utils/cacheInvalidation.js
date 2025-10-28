/**
 * Cache Invalidation Utilities - Manual debugging & maintenance
 *
 * Purpose: Low-level cache management for debugging and maintenance
 * - Manual cache clearing
 * - Cache state inspection
 * - Emergency tree reload
 *
 * Architecture:
 * - AsyncStorage: Persistent structure cache (0.45 MB per profile set)
 * - Zustand: In-memory working state (updated by real-time subscriptions)
 * - These are separate layers with different invalidation strategies
 *
 * When to use:
 * ✅ Debugging cache issues
 * ✅ Manual cache clear after migration
 * ✅ Emergency tree reload (offline recovery)
 * ✅ Admin cache management
 *
 * When NOT to use:
 * ❌ Don't call automatically from profile updates
 * ❌ Don't call on every edit (real-time subscriptions handle freshness)
 * ❌ Never call from components (use hooks instead)
 *
 * Normal flow for profile edits:
 * 1. User edits profile → admin_update_profile RPC
 * 2. Real-time subscription receives update → updates Zustand
 * 3. UI updates automatically from Zustand
 * 4. AsyncStorage cache persists across restarts (TTL handled by schema version)
 *
 * When this changes:
 * 1. Schema version bumps → Zustand handles cache invalidation
 * 2. User logs out → useAuth handles cleanup
 * 3. Manual refresh → forceTreeReload() can be called from settings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTreeStore } from '../stores/useTreeStore';

const CACHE_KEY = 'tree-structure-v4'; // Updated: Match useStructureLoader cache key

/**
 * Invalidate AsyncStorage structure cache
 *
 * Use case: Manual cache clear, debugging, or after schema changes
 *
 * Returns: { success: boolean, error?: Error }
 */
export async function invalidateStructureCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log('✅ [Cache] Structure cache invalidated');
    return { success: true };
  } catch (error) {
    console.error('❌ [Cache] Failed to invalidate cache:', error);
    return { success: false, error };
  }
}

/**
 * Check if structure cache exists
 *
 * Returns: { exists: boolean, sizeKB?: number }
 */
export async function hasCachedStructure() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) {
      return { exists: false };
    }

    const sizeKB = (cached.length / 1024).toFixed(2);
    return { exists: true, sizeKB };
  } catch (error) {
    console.error('❌ [Cache] Failed to check cache:', error);
    return { exists: false, error };
  }
}

/**
 * Get cache metadata
 *
 * Returns: { exists, sizeKB, profileCount?, version?, timestamp?, error? }
 */
export async function getCacheMetadata() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) {
      return { exists: false };
    }

    const data = JSON.parse(cached);
    const sizeKB = (cached.length / 1024).toFixed(2);

    // Handle both old format (array) and new format (object with metadata)
    const isOldFormat = Array.isArray(data);
    const profileCount = isOldFormat ? data.length : (data.profiles?.length || 0);
    const version = isOldFormat ? 'legacy' : data.version;
    const timestamp = isOldFormat ? null : data.timestamp;

    return { exists: true, sizeKB, profileCount, version, timestamp };
  } catch (error) {
    console.error('❌ [Cache] Failed to get metadata:', error);
    return { exists: false, error };
  }
}

/**
 * Force complete tree reload from network
 *
 * Clears both AsyncStorage cache and Zustand state
 * Next tree load will fetch from database
 *
 * Use case: Emergency recovery, cache corruption, testing
 *
 * Returns: void (logs console output)
 */
export async function forceTreeReload() {
  try {
    // Clear Zustand in-memory state
    const treeStore = useTreeStore.getState();
    treeStore.clearTreeData();

    // Clear AsyncStorage persistent cache
    await invalidateStructureCache();

    console.log('✅ [Cache] Tree reload triggered - next load will fetch from network');
  } catch (error) {
    console.error('❌ [Cache] Force reload failed:', error);
  }
}

/**
 * Clear all app caches (nuclear option)
 *
 * Clears:
 * - Structure cache
 * - Tree data store
 * - Network connectivity cache (if available)
 *
 * Use case: Final logout, debugging, cache corruption recovery
 *
 * Returns: { success: boolean, cleared: string[] }
 */
export async function clearAllCaches() {
  const cleared = [];

  try {
    // Clear AsyncStorage
    await invalidateStructureCache();
    cleared.push('AsyncStorage (tree-structure-v4)');

    // Clear Zustand store
    const treeStore = useTreeStore.getState();
    treeStore.clearTreeData();
    cleared.push('Zustand (useTreeStore)');

    console.log(`✅ [Cache] Cleared ${cleared.length} cache layers:`, cleared);
    return { success: true, cleared };
  } catch (error) {
    console.error('❌ [Cache] Failed to clear all caches:', error);
    return { success: false, error };
  }
}

/**
 * Debug info: Cache state summary
 *
 * Prints detailed cache information for debugging
 *
 * Returns: void (logs to console)
 */
export async function debugCacheStatus() {
  console.log('\n📊 [Cache Debug] Current cache status:\n');

  // AsyncStorage status
  const asyncStatus = await getCacheMetadata();
  if (asyncStatus.exists) {
    console.log(`  📦 AsyncStorage (${CACHE_KEY}):`);
    console.log(`     - Exists: Yes`);
    console.log(`     - Size: ${asyncStatus.sizeKB} KB`);
    console.log(`     - Profiles: ${asyncStatus.profileCount}`);
    console.log(`     - Version: ${asyncStatus.version || 'unknown'}`);
    if (asyncStatus.timestamp) {
      const age = Math.floor((Date.now() - asyncStatus.timestamp) / 1000 / 60);
      console.log(`     - Cached: ${age} minutes ago`);
    }
  } else {
    console.log(`  📦 AsyncStorage: No cache found`);
  }

  // Zustand status
  const treeStore = useTreeStore.getState();
  const treeDataCount = treeStore.treeData?.length || 0;
  const nodesMapSize = treeStore.nodesMap?.size || 0;
  console.log(`\n  🧠 Zustand (useTreeStore):`);
  console.log(`     - Tree data: ${treeDataCount} profiles`);
  console.log(`     - Nodes map: ${nodesMapSize} entries`);
  console.log(`     - Schema version: ${useTreeStore.getState().treeDataSchemaVersion || 'unknown'}`);

  console.log('\n✅ Cache debug complete\n');
}
