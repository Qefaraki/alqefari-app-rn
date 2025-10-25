/**
 * Node constants - Re-export compatibility layer (DEPRECATED)
 *
 * All constants now centralized in rendering/nodeConstants.ts as the
 * single source of truth. This file maintains the Phase 1 export chain
 * for backwards compatibility during TreeView.js migration.
 *
 * TODO (Phase 2): Remove this file once TreeView.js updated to import
 * directly from rendering/nodeConstants.ts
 *
 * History: Accidentally deleted Oct 25, 2025 (breaking change).
 * Restored as compatibility layer during Phase 1 cleanup consolidation.
 */

// Re-export everything from the authoritative source
export * from '../../rendering/nodeConstants';
