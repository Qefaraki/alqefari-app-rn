/**
 * Message Templates Module
 *
 * Barrel export for easy importing throughout the app.
 *
 * Usage:
 *   import templateService, { MESSAGE_TEMPLATES, COMMON_VARIABLES } from '@/services/messageTemplates';
 */

// Main service (default export)
export { default } from './templateService';

// Types
export * from './types';

// Registries
export * from './templateRegistry';
export * from './variables';

// Re-export service as named export for convenience
export { default as templateService } from './templateService';
