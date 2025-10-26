/**
 * Photo Gallery Types
 *
 * Type definitions for the photo gallery system with 6-photo limit enforcement.
 * Updated: October 26, 2025
 */

/**
 * Maximum number of gallery photos allowed per profile (excluding primary photo).
 * Enforced by database trigger and frontend validation.
 */
export const MAX_GALLERY_PHOTOS = 6 as const;

/**
 * Profile photo entity from profile_photos table.
 * Represents a single photo in a user's gallery or primary profile photo.
 */
export interface ProfilePhoto {
  /** Unique photo identifier (UUID) */
  id: string;

  /** Profile this photo belongs to (UUID) */
  profile_id: string;

  /** Public URL to the photo in Supabase Storage */
  photo_url: string;

  /** Storage path in Supabase bucket (optional, for cleanup operations) */
  storage_path?: string;

  /** Whether this is the primary/main profile photo (excludes from 6-photo limit) */
  is_primary: boolean;

  /** Display order in gallery (0-based index) */
  display_order: number;

  /** User who uploaded this photo (UUID, optional) */
  uploaded_by?: string;

  /** Timestamp when photo was uploaded */
  created_at: string;

  /** Timestamp of last update */
  updated_at: string;
}

/**
 * Photo count statistics for a profile.
 * Returned by get_gallery_photo_count() RPC function.
 */
export interface GalleryPhotoCount {
  /** Total number of photos (primary + gallery) */
  total: number;

  /** Number of gallery photos (capped at MAX_GALLERY_PHOTOS for display) */
  gallery: number;

  /** Number of primary photos (should always be 0 or 1) */
  primary: number;

  /** Number of additional photos user can upload (0 when at limit) */
  remaining_slots: number;
}

/**
 * Photo upload error types for error handling.
 * Used in try/catch blocks to provide specific user feedback.
 */
export type PhotoUploadError =
  | 'GALLERY_LIMIT_REACHED'  // Attempted to upload when at 6-photo limit
  | 'PERMISSION_DENIED'      // User lacks permission to edit this profile
  | 'NETWORK_ERROR'          // Network connection failed during upload
  | 'UNKNOWN_ERROR';         // Unexpected error occurred

/**
 * Photo upload result for batch operations.
 * Used when uploading multiple photos to track success/failure.
 */
export interface PhotoUploadResult {
  /** Whether the upload succeeded */
  success: boolean;

  /** Temporary ID used during optimistic update */
  tempId: string;

  /** Error object if upload failed (optional) */
  error?: Error;

  /** Uploaded photo data if successful (optional) */
  photo?: ProfilePhoto;
}