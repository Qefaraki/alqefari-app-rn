// Design tokens for neo-native (non-glass) UI
// Neutral surfaces, soft elevation, crisp dividers, Arabic-first

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
  },
  radii: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
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
