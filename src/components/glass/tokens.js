// Design tokens for the liquid-glass aesthetic
// Centralized so we can tune the look consistently across components

export const glassTokens = {
  radii: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 28,
    xl: 36,
  },
  blurIntensity: {
    subtle: 28,
    medium: 40,
    strong: 64,
  },
  // Base surface overlay colors for a bright UI
  surfaceOverlay: {
    // Vertical overlay from slightly brighter top to slightly dimmer bottom
    gradient: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.28)'],
  },
  // Hairline borders that feel like condensed water on the glass
  borders: {
    inner: 'rgba(255,255,255,0.55)',
    outer: 'rgba(0,0,0,0.04)',
  },
  // Soft ambient elevation – avoid harsh shadows
  elevation: {
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.10,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 3,
    },
  },
  highlight: {
    // Specular highlight sweeping from top-left
    sheen: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.0)'],
  },
};

export default glassTokens;


