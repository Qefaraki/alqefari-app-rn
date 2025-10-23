/**
 * Node type definitions for TreeView
 * Phase 1 Day 3 - Type system
 */

/**
 * Raw profile data from Supabase
 * Represents a single family member in the database
 */
export interface Profile {
  /** Unique profile identifier (UUID) */
  id: string;

  /** Heritage ID (HID) - unique genealogical identifier for blood relatives */
  hid: string | null;

  /** Full Arabic name */
  name: string;

  /** Arabic name without diacritics (for search) */
  name_no_diacritics: string | null;

  /** Profile photo URL (Supabase storage) */
  photo_url: string | null;

  /** Birth date (ISO 8601) */
  birth_date: string | null;

  /** Death date (ISO 8601) - null if alive */
  death_date: string | null;

  /** Biological sex (male/female) */
  sex: 'male' | 'female';

  /** Father's profile ID (UUID) */
  father_id: string | null;

  /** Mother's profile ID (UUID) */
  mother_id: string | null;

  /** Display order among siblings (1-indexed) */
  sibling_order: number | null;

  /** Generation number (1 = patriarch, 2 = children, etc.) */
  generation: number;

  /** Soft delete timestamp */
  deleted_at: string | null;

  /** Optimistic locking version */
  version: number;

  /** Record creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Associated auth user ID (nullable for Munasib/spouses) */
  user_id: string | null;

  /** Admin role (super_admin, admin, moderator, user) */
  role: 'super_admin' | 'admin' | 'moderator' | 'user';

  /** Professional title (e.g., دكتور, مهندس) */
  professional_title: string | null;

  /** Title abbreviation for compact display */
  title_abbreviation: string | null;
}

/**
 * Node with layout coordinates (output of layout algorithm)
 * Represents a positioned node in the tree canvas
 */
export interface LayoutNode {
  /** Profile data */
  profile: Profile;

  /** X coordinate in tree canvas space */
  x: number;

  /** Y coordinate in tree canvas space */
  y: number;

  /** Node width in pixels */
  width: number;

  /** Node height in pixels */
  height: number;

  /** Generation number (cached from profile) */
  generation: number;

  /** Whether node has children */
  hasChildren: boolean;

  /** Child node IDs */
  childIds: string[];

  /** Spouse node IDs */
  spouseIds: string[];

  /** Marriage IDs linking this profile to spouses */
  marriageIds: string[];
}

/**
 * Fully rendered node with animation values
 * Represents a node ready for display with Skia
 */
export interface RenderedNode extends LayoutNode {
  /** Animated X coordinate (Reanimated shared value) */
  animatedX: number;

  /** Animated Y coordinate (Reanimated shared value) */
  animatedY: number;

  /** Animated opacity (0-1) */
  opacity: number;

  /** Animated scale (for zoom gestures) */
  scale: number;

  /** Level of Detail tier (T1/T2/T3 based on zoom) */
  lodTier: 'T1' | 'T2' | 'T3';

  /** Whether node is currently visible in viewport */
  isVisible: boolean;

  /** Image bucket size for photo URL optimization */
  imageBucket: 40 | 60 | 80 | 120 | 256;
}

/**
 * Marriage connection between two profiles
 * Used for rendering spouse relationship lines
 */
export interface Marriage {
  /** Marriage record ID (UUID) */
  id: string;

  /** Partner 1 profile ID */
  partner1_id: string;

  /** Partner 2 profile ID */
  partner2_id: string;

  /** Marriage status (current or past) */
  status: 'current' | 'past';

  /** Marriage date (ISO 8601) */
  marriage_date: string | null;

  /** Divorce date (ISO 8601) - null if still married */
  divorce_date: string | null;

  /** Soft delete timestamp */
  deleted_at: string | null;
}

/**
 * Parent-child connection line
 * Used for rendering genealogical relationship lines
 */
export interface Connection {
  /** Parent node ID */
  parentId: string;

  /** Child node ID */
  childId: string;

  /** Connection line color (hex) */
  color: string;

  /** Connection line width (pixels) */
  width: number;

  /** Whether connection is visible in viewport */
  isVisible: boolean;
}
