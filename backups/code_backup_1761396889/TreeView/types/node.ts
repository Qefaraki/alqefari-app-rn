/**
 * Node type definitions for TreeView
 * Phase 1 Day 3 - Type system (Fixed to match Supabase schema)
 */

import type { SharedValue } from 'react-native-reanimated';
import type {
  Profile as SupabaseProfile,
  Marriage as SupabaseMarriage,
  DateData,
  SocialMediaLinks,
  TimelineEvent,
  TreeMeta,
} from '../../../types/supabase';

/**
 * Raw profile data from Supabase
 * Re-exported from canonical source for type safety
 */
export type Profile = SupabaseProfile;

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
  animatedX: SharedValue<number>;

  /** Animated Y coordinate (Reanimated shared value) */
  animatedY: SharedValue<number>;

  /** Animated opacity (0-1, Reanimated shared value) */
  opacity: SharedValue<number>;

  /** Animated scale (for zoom gestures, Reanimated shared value) */
  scale: SharedValue<number>;

  /** Level of Detail tier (T1/T2/T3 based on zoom) */
  lodTier: 'T1' | 'T2' | 'T3';

  /** Whether node is currently visible in viewport */
  isVisible: boolean;

  /** Image bucket size for photo URL optimization */
  imageBucket: 40 | 60 | 80 | 120 | 256;
}

/**
 * Marriage connection between two profiles
 * Re-exported from canonical source for type safety
 */
export type Marriage = SupabaseMarriage;

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
