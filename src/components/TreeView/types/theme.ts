/**
 * Theme and design token type definitions for TreeView
 * Phase 1 Day 3 - Type system
 *
 * Three-tier architecture:
 * - Reference tokens (raw values)
 * - Semantic tokens (contextual meaning)
 * - Component tokens (usage-specific)
 */

/**
 * Najdi Sadu color palette (Reference tokens)
 * Culturally authentic colors inspired by Saudi Arabian heritage
 */
export interface ColorTokens {
  /** Al-Jass White - Primary background (#F9F7F3) */
  background: {
    primary: string;
    secondary: string;
  };

  /** Camel Hair Beige - Containers & cards (#D1BBA3) */
  container: {
    default: string;
    elevated: string;
    transparent: string; // With alpha channel
  };

  /** Sadu Night - All text (#242121) */
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
  };

  /** Najdi Crimson - Primary actions (#A13333) */
  accent: {
    primary: string;
    secondary: string;
    transparent: string; // With alpha channel
  };

  /** Desert Ochre - Secondary accents (#D58C4A) */
  secondaryAccent: {
    default: string;
    muted: string;
  };

  /** Semantic colors for node states */
  node: {
    male: string; // Najdi Crimson
    female: string; // Desert Ochre
    deceased: string; // Grayscale treatment
    selected: string; // Highlighted state
    hover: string; // Hover state
  };

  /** Connection line colors */
  connection: {
    parent: string; // Parent-child lines
    spouse: string; // Marriage lines
    highlight: string; // Selected path
  };

  /** Shadow colors */
  shadow: {
    default: string;
    elevated: string;
  };
}

/**
 * Typography scale (Semantic tokens)
 * iOS-standard sizes with SF Arabic font
 */
export interface Typography {
  /** Font family */
  fontFamily: {
    regular: string; // SF Arabic Regular
    medium: string; // SF Arabic Medium
    bold: string; // SF Arabic Bold
  };

  /** Font sizes (iOS scale) */
  fontSize: {
    /** 34pt - Large titles */
    largeTitle: number;

    /** 28pt - Navigation titles */
    title1: number;

    /** 22pt - Section headers */
    title2: number;

    /** 20pt - Content headers */
    title3: number;

    /** 17pt - Body text (default) */
    body: number;

    /** 15pt - Secondary text */
    callout: number;

    /** 13pt - Captions */
    footnote: number;

    /** 12pt - Micro text */
    caption2: number;
  };

  /** Font weights */
  fontWeight: {
    regular: '400';
    medium: '500';
    semibold: '600';
    bold: '700';
  };

  /** Line heights (multipliers) */
  lineHeight: {
    tight: number; // 1.1 - Titles
    normal: number; // 1.4 - Body
    relaxed: number; // 1.6 - Long-form
  };
}

/**
 * Spacing scale (8px grid)
 * Consistent spacing throughout the design system
 */
export interface Spacing {
  /** 4px - Micro spacing */
  xs: number;

  /** 8px - Base unit */
  sm: number;

  /** 12px - Small gaps */
  md: number;

  /** 16px - Default spacing */
  base: number;

  /** 20px - Medium spacing */
  lg: number;

  /** 24px - Large spacing */
  xl: number;

  /** 32px - Extra large spacing */
  '2xl': number;

  /** 40px - Section spacing */
  '3xl': number;

  /** 48px - Major sections */
  '4xl': number;
}

/**
 * Border radius values
 */
export interface BorderRadius {
  /** 4px - Small elements */
  sm: number;

  /** 8px - Default radius */
  md: number;

  /** 12px - Large elements */
  lg: number;

  /** 16px - Extra large */
  xl: number;

  /** 999px - Fully rounded */
  full: number;
}

/**
 * Shadow definitions
 * Subtle shadows following 2024 design trends (max 0.08 opacity)
 */
export interface Shadow {
  /** Subtle shadow for cards */
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number; // Android
  };

  /** Elevated shadow for modals/overlays */
  elevated: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };

  /** No shadow */
  none: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

/**
 * Complete theme tokens (Component tokens)
 * Combines all design tokens for TreeView
 */
export interface ThemeTokens {
  /** Color palette */
  colors: ColorTokens;

  /** Typography scale */
  typography: Typography;

  /** Spacing scale */
  spacing: Spacing;

  /** Border radius */
  borderRadius: BorderRadius;

  /** Shadow definitions */
  shadow: Shadow;

  /** Dark mode flag */
  isDarkMode: boolean;
}

/**
 * Node visual style
 * Component-specific tokens for node rendering
 */
export interface NodeStyle {
  /** Background color */
  backgroundColor: string;

  /** Border color */
  borderColor: string;

  /** Border width */
  borderWidth: number;

  /** Border radius */
  borderRadius: number;

  /** Shadow style */
  shadow: Shadow['card'] | Shadow['elevated'] | Shadow['none'];

  /** Text color */
  textColor: string;

  /** Opacity (for dimming) */
  opacity: number;
}

/**
 * Connection line style
 * Component-specific tokens for relationship lines
 */
export interface ConnectionStyle {
  /** Line color */
  color: string;

  /** Line width in pixels */
  width: number;

  /** Line opacity */
  opacity: number;

  /** Dash pattern (solid if undefined) */
  dashPattern?: number[];
}
