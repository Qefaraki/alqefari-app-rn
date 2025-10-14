/**
 * Najdi Sadu Design System - Color Palette
 *
 * Culturally authentic colors inspired by traditional Najdi Sadu weaving.
 * These colors should be used consistently across all components.
 *
 * @see docs/DESIGN_SYSTEM.md for full design system documentation
 */

export const NAJDI_COLORS = {
  // Core Palette
  background: "#F9F7F3",    // Al-Jass White - Primary background
  container: "#D1BBA3",      // Camel Hair Beige - Containers & cards
  text: "#242121",           // Sadu Night - All text
  primary: "#A13333",        // Najdi Crimson - Primary actions
  secondary: "#D58C4A",      // Desert Ochre - Secondary accents

  // Text Variations
  textLight: "#24212199",    // Sadu Night 60% - Muted text
  textMedium: "#242121CC",   // Sadu Night 80% - Secondary text
  muted: "#73637280",        // Muted gray for secondary text/labels

  // Utility Colors
  white: "#FFFFFF",
  border: "#D1BBA340",       // Camel Hair Beige 40% - Borders
  overlay: "rgba(36, 33, 33, 0.4)", // Sadu Night 40% - Modal overlays

  // Status Colors (Najdi-compliant)
  success: "#D58C4A",        // Desert Ochre - Positive states
  warning: "#D58C4A",        // Desert Ochre - Attention states
  error: "#A13333",          // Najdi Crimson - Destructive states

  // Notification-specific
  approved: "#D58C4A",       // Approved notifications
  pending: "#D1BBA3",        // Pending/neutral notifications
  rejected: "#A13333",       // Rejected notifications
} as const;

/**
 * Opacity helpers for creating tinted backgrounds
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `${color}${opacityHex}`;
  }
  // Handle rgba colors
  return color;
};

/**
 * Common background tints
 */
export const NAJDI_BACKGROUNDS = {
  subtle: withOpacity(NAJDI_COLORS.container, 0.1),     // 10% tint
  light: withOpacity(NAJDI_COLORS.container, 0.2),      // 20% tint
  medium: withOpacity(NAJDI_COLORS.container, 0.3),     // 30% tint
  primarySubtle: withOpacity(NAJDI_COLORS.primary, 0.08), // 8% crimson tint
  secondarySubtle: withOpacity(NAJDI_COLORS.secondary, 0.15), // 15% ochre tint
} as const;

/**
 * Shadow presets (iOS-style, max 0.08 opacity)
 */
export const NAJDI_SHADOWS = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export type NajdiColor = keyof typeof NAJDI_COLORS;
