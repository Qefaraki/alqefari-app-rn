/**
 * FontProvider - Context provider for async Arabic font loading
 *
 * Phase 2 Infrastructure - Component for Phase 0
 *
 * Provides Skia FontMgr to all child components with async loading support.
 * Shows loading state (SimpleTreeSkeleton) while fonts are being loaded.
 *
 * Features:
 * - Async font loading with useFonts hook
 * - Loading state with tree skeleton placeholder
 * - Graceful degradation if fonts fail to load
 * - Supports SF Arabic Regular and Bold variants
 *
 * Usage:
 * ```tsx
 * <FontProvider>
 *   <TreeView />
 * </FontProvider>
 * ```
 *
 * Best Practices (from React Native Skia):
 * - useFonts returns null until all fonts are loaded
 * - Always check for null before using fontMgr
 * - Show loading fallback to prevent layout shifts
 * - Load all fonts before rendering tree to prevent FOUC
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useFonts, FontMgr } from '@shopify/react-native-skia';
import { SimpleTreeSkeleton } from '../SimpleTreeSkeleton';
import { Animated as RNAnimated } from 'react-native';

export const FontContext = createContext<FontMgr | null>(null);

export interface FontProviderProps {
  children: React.ReactNode;
}

/**
 * FontProvider component
 *
 * Loads SF Arabic fonts and provides FontMgr to child components.
 * Shows tree skeleton during loading to prevent blank screen.
 *
 * @param props - Provider props
 * @returns Provider with children or loading skeleton
 */
export const FontProvider: React.FC<FontProviderProps> = ({ children }) => {
  // Load SF Arabic fonts (Regular and Bold variants)
  // In tests, useFonts is mocked, so requires won't execute
  let fontConfig;
  try {
    fontConfig = {
      'SF-Arabic': [
        require('../../../assets/fonts/SF-Arabic-Regular.ttf'),
        require('../../../assets/fonts/SF-Arabic-Bold.ttf'),
      ],
    };
  } catch (e) {
    // Fallback for test environment where font files don't exist
    fontConfig = { 'SF-Arabic': [] };
  }

  const fontMgr = useFonts(fontConfig);

  // Font load timeout state (prevents infinite hang if fonts fail)
  const [fontLoadTimeout, setFontLoadTimeout] = useState(false);
  const animationRef = useRef<any>(null);

  // Set timeout for font loading (5 seconds)
  useEffect(() => {
    if (fontMgr) return; // Fonts loaded successfully

    const timer = setTimeout(() => {
      console.warn('[FontProvider] Font loading timeout after 5s, proceeding without custom fonts');
      setFontLoadTimeout(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [fontMgr]);

  // Show loading skeleton while fonts load
  // This prevents blank screen and provides immediate visual feedback
  if (!fontMgr && !fontLoadTimeout) {
    // Create shimmer animation for skeleton
    if (!animationRef.current) {
      const shimmerAnim = new RNAnimated.Value(0.3);

      // Start shimmer animation loop
      const animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          RNAnimated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();
      animationRef.current = { animation, shimmerAnim };
    }

    // Cleanup animation on unmount
    useEffect(() => {
      return () => {
        if (animationRef.current) {
          animationRef.current.animation.stop();
        }
      };
    }, []);

    return <SimpleTreeSkeleton shimmerAnim={animationRef.current.shimmerAnim} />;
  }

  // If timeout occurred, log error and proceed with null fontMgr (graceful degradation)
  if (!fontMgr && fontLoadTimeout) {
    console.error('[FontProvider] Failed to load SF Arabic fonts, using system default');
  }

  return <FontContext.Provider value={fontMgr}>{children}</FontContext.Provider>;
};

/**
 * useFont hook
 *
 * Access FontMgr from context with null check.
 * Returns null if fonts not yet loaded (graceful degradation).
 *
 * @returns FontMgr or null
 */
export const useFont = (): FontMgr | null => {
  const fontMgr = useContext(FontContext);

  if (!fontMgr) {
    console.warn('[FontProvider] Font not loaded yet, using fallback');
    return null; // Graceful degradation
  }

  return fontMgr;
};

/**
 * useFontRequired hook
 *
 * Access FontMgr from context with error if not available.
 * Use this when font is absolutely required (not optional).
 *
 * @returns FontMgr
 * @throws Error if used outside FontProvider
 */
export const useFontRequired = (): FontMgr => {
  const fontMgr = useContext(FontContext);

  if (!fontMgr) {
    throw new Error('useFontRequired must be used within FontProvider and fonts must be loaded');
  }

  return fontMgr;
};
