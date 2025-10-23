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
};

export default tokens;
