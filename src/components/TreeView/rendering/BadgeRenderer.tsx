/**
 * BadgeRenderer - Status and role badge rendering
 *
 * Phase 2 Day 4 - Extracted from TreeView.js (lines 3139-3208)
 *
 * Renders small indicator badges on tree nodes:
 * - Generation badges (currently implemented)
 * - Status badges (alive/deceased) - future Phase 4
 * - Admin role badges - future Phase 4
 * - VIP badges - future Phase 4
 *
 * Current Implementation:
 * - Generation number badge (7px font, 25% opacity)
 * - Positioned top-right for photo nodes, top-center for text nodes
 *
 * Future-Proofing (Phase 4):
 * - isAlive/isDeceased status indicators
 * - isAdmin role badge
 * - isVIP highlighting badge
 * - All props defined but only generation currently used
 *
 * Design Constraints:
 * - Najdi Sadu color palette
 * - Sadu Night (#242121) with 25% opacity for generation
 * - Small font size (7px) to minimize visual weight
 * - Positioned to not obscure name/photo
 */

import React from 'react';
import { Paragraph } from '@shopify/react-native-skia';
import { createArabicParagraph } from './ArabicTextRenderer';

export interface BadgeRendererProps {
  // Current (Phase 2)
  generation?: number;

  // Future (Phase 4)
  status?: 'alive' | 'deceased';
  isAdmin?: boolean;
  isVIP?: boolean;

  // Positioning
  x: number;
  y: number;
  width: number;
  hasPhoto: boolean; // Determines badge positioning strategy
}

/**
 * Render generation badge
 *
 * Shows generation number in top corner/center of node.
 * Uses cached paragraph for performance.
 *
 * @param generation - Generation number (1, 2, 3, etc.)
 * @param x - Node X position
 * @param y - Node Y position
 * @param width - Node width
 * @param hasPhoto - Whether node has photo (affects positioning)
 * @returns Paragraph component or null
 */
export function renderGenerationBadge(
  generation: number,
  x: number,
  y: number,
  width: number,
  hasPhoto: boolean
): JSX.Element | null {
  const genParagraph = createArabicParagraph(
    String(generation),
    'regular',
    7, // Small font size (about 25% smaller than standard)
    '#24212140', // Sadu Night with 25% opacity
    hasPhoto ? 15 : width
  );

  if (!genParagraph) return null;

  // Position strategy:
  // - Photo nodes: Top-right corner (x + width - 15, y + 4)
  // - Text nodes: Top-center (x, y + 4)
  const badgeX = hasPhoto ? x + width - 15 : x;
  const badgeY = y + 4;
  const badgeWidth = hasPhoto ? 15 : width;

  return (
    <Paragraph
      paragraph={genParagraph}
      x={badgeX}
      y={badgeY}
      width={badgeWidth}
    />
  );
}

/**
 * Render status badge (alive/deceased)
 *
 * FUTURE Phase 4 implementation.
 * Will show indicator for deceased status (living status default).
 *
 * @param status - Alive or deceased status
 * @param x - Badge X position
 * @param y - Badge Y position
 * @returns Badge component or null (currently null - not implemented)
 */
export function renderStatusBadge(
  status: 'alive' | 'deceased',
  x: number,
  y: number
): JSX.Element | null {
  // Phase 4: Implement deceased indicator
  // Could use small icon or color indicator
  return null;
}

/**
 * Render admin role badge
 *
 * FUTURE Phase 4 implementation.
 * Will show indicator for admin/moderator roles.
 *
 * @param isAdmin - Whether user has admin role
 * @param x - Badge X position
 * @param y - Badge Y position
 * @returns Badge component or null (currently null - not implemented)
 */
export function renderAdminBadge(
  isAdmin: boolean,
  x: number,
  y: number
): JSX.Element | null {
  // Phase 4: Implement admin badge
  // Could use crown icon or role indicator
  return null;
}

/**
 * Render VIP badge
 *
 * FUTURE Phase 4 implementation.
 * Will show indicator for VIP/featured profiles.
 *
 * @param isVIP - Whether profile is VIP
 * @param x - Badge X position
 * @param y - Badge Y position
 * @returns Badge component or null (currently null - not implemented)
 */
export function renderVIPBadge(
  isVIP: boolean,
  x: number,
  y: number
): JSX.Element | null {
  // Phase 4: Implement VIP badge
  // Could use star icon or highlight indicator
  return null;
}

/**
 * BadgeRenderer component
 *
 * Renders all applicable badges for a node.
 * Currently only generation badge implemented.
 *
 * @param props - Badge renderer props
 * @returns Badge components group or null
 */
export const BadgeRenderer: React.FC<BadgeRendererProps> = ({
  generation,
  status,
  isAdmin,
  isVIP,
  x,
  y,
  width,
  hasPhoto,
}) => {
  const badges: (JSX.Element | null)[] = [];

  // Generation badge (currently implemented)
  if (generation !== undefined) {
    badges.push(
      renderGenerationBadge(generation, x, y, width, hasPhoto)
    );
  }

  // Status badge (Phase 4)
  if (status) {
    badges.push(
      renderStatusBadge(status, x, y)
    );
  }

  // Admin badge (Phase 4)
  if (isAdmin) {
    badges.push(
      renderAdminBadge(isAdmin, x, y)
    );
  }

  // VIP badge (Phase 4)
  if (isVIP) {
    badges.push(
      renderVIPBadge(isVIP, x, y)
    );
  }

  // Filter out nulls, add keys, and return as fragment
  const validBadges = badges
    .filter((b): b is JSX.Element => b !== null)
    .map((badge, index) => React.cloneElement(badge, { key: `badge-${index}` }));

  if (validBadges.length === 0) return null;

  return <>{validBadges}</>;
};

// Export constants for testing
export const BADGE_CONSTANTS = {
  GENERATION_FONT_SIZE: 7,
  GENERATION_COLOR: '#24212140', // Sadu Night 25% opacity
  BADGE_TOP_OFFSET: 4,
  PHOTO_BADGE_RIGHT_OFFSET: 15,
  PHOTO_BADGE_WIDTH: 15,
};
