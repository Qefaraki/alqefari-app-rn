// Design tokens for neo-native (non-glass) UI
// Neutral surfaces, soft elevation, crisp dividers, Arabic-first
// Aligned with iOS Human Interface Guidelines

const tokens = {
  colors: {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    divider: 'rgba(0,0,0,0.08)',
    outline: 'rgba(0,0,0,0.12)',
    accent: '#007AFF',
    success: '#34C759',
    danger: '#FF3B30',
    najdi: {
      background: '#F9F7F3', // Al-Jass White
      container: '#D1BBA3', // Camel Hair Beige
      text: '#242121', // Sadu Night
      textMuted: '#736372',
      primary: '#A13333', // Najdi Crimson
      secondary: '#D58C4A', // Desert Ochre
      focus: '#957EB5',
    },
    diff: {
      added: '#34C759',       // iOS green for new values
      addedBg: '#34C75915',   // 8% opacity
      removed: '#FF3B30',     // iOS red for old values
      removedBg: '#FF3B3015', // 8% opacity
      modified: '#007AFF',    // iOS blue for changes
      modifiedBg: '#007AFF15', // 8% opacity
    },
  },
  // iOS-standard typography scale
  typography: {
    largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41 },
    title1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
    title2: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
    title3: { fontSize: 20, fontWeight: '600', lineHeight: 25 },
    headline: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
    body: { fontSize: 17, fontWeight: '400', lineHeight: 22 },
    callout: { fontSize: 16, fontWeight: '400', lineHeight: 21 },
    subheadline: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
    footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
    caption1: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
    caption2: { fontSize: 11, fontWeight: '400', lineHeight: 13 },
  },
  radii: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,  // Full pill shape for chips
  },
  // iOS-standard spacing scale (8px grid)
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  // iOS minimum touch target
  touchTarget: {
    minimum: 44,
  },
  shadow: {
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 3,
    },
  },
  // Profile Viewer patterns - all specs support Dynamic Type scaling
  profileViewer: {
    // Pattern 1: Enhanced Hero (avatar + action buttons, centered)
    hero: {
      avatarSize: 100,
      avatarBorderRadius: 50,
      minHeight: 160,  // Min height to prevent cramping at large text sizes
      paddingVertical: 16,
      paddingHorizontal: 16,
      actionButtonSize: 24,  // Icon size
      actionButtonPadding: 8,  // Padding inside touch target
      actionButtonTouchTarget: 44,  // Minimum iOS touch target
      headerSpacing: 8,  // Gap between close button and action buttons
      nameMaxWidth: '90%',  // Prevent bunching on small screens
    },
    // Pattern 2: Bio Section (1000 char limit, 150 char preview)
    bio: {
      charLimit: 1000,
      previewChars: 150,
      expandButtonHeight: 44,
      expandButtonFontSize: 15,
      expandButtonFontWeight: '600',
      containerPadding: 16,
      containerMarginVertical: 8,
    },
    // Pattern 3: Inline Field Rows (flexible height, multi-line support)
    inlineRow: {
      minHeight: 44,  // Flexible - grows with content
      paddingVertical: 12,
      paddingHorizontal: 16,
      iconSize: 18,
      iconColorMuted: true,  // Use textMuted color for secondary icons
      gapBetweenElements: 12,  // Between icon and text
      borderBottomOpacity: 0.06,  // Subtle divider
    },
    // Pattern 4: Life Events Timeline (vertical timeline)
    timeline: {
      dotSize: 12,
      dotBorderWidth: 2,
      lineWidth: 1,
      lineColorOpacity: 0.15,
      leftPadding: 24,  // Space for timeline on left
      eventMinHeight: 60,  // Flexible - grows with content
      yearFontSize: 13,
      yearFontWeight: '600',
      descriptionFontSize: 15,
      descriptionMaxLines: 0,  // Unlimited wrapping
    },
    // Social Media Section specs
    social: {
      iconSize: 20,
      gridGap: 16,
      gridItemMinWidth: 60,  // Min width for label below icon
      labelFontSize: 12,
      labelFontWeight: '500',
    },
  },
};

// Dynamic Type scaling - scales values proportionally with system text size
// Supports iOS accessibility text sizes (XS, S, M, L, XL, XXL, Accessibility XXL)
// Scale factor ranges from 0.85 (smallest) to 1.5+ (largest)
export const useScaledValue = (baseValue, maxScale = 1.3) => {
  // When Dynamic Type is implemented, this will read from UITraitCollection
  // For now, returns base value (hook structure is ready for future implementation)
  if (typeof baseValue !== 'number') return baseValue;

  // Future implementation will scale like:
  // const scale = Math.min(fontSizeScale / 17, maxScale);
  // return Math.round(baseValue * scale);

  return baseValue;
};

// Accessibility size detection - identifies when user has enabled large accessibility text
// Trigger alternative layouts or simplified information hierarchies at extreme sizes
export const useAccessibilitySize = () => {
  // When Dynamic Type is implemented, this will detect if current size is accessibility level
  // For now, returns false (hook structure ready for future implementation)

  return {
    isAccessibilitySize: false,  // True if text size > XXL (accessibility level)
    currentTextSize: 'medium',   // XS, S, M, L, XL, XXL, or 'accessibility'
    shouldUseAlternateLayout: false,  // True if should switch to simplified layout
  };
};

export default tokens;
