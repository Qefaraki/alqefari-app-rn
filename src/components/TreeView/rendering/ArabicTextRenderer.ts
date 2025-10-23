/**
 * ArabicTextRenderer - Arabic text shaping and rendering with Skia Paragraph
 *
 * Phase 2 Day 2 - Extracted from TreeView.js (lines 184-299)
 *
 * Creates properly shaped Arabic text paragraphs using Skia's ParagraphBuilder.
 * Handles RTL text direction, font fallback chain, and SF Arabic font integration.
 *
 * Font Strategy:
 * - Primary: SF Arabic (loaded from assets/fonts/)
 * - Fallback chain: .SF Arabic, Geeza Pro, Damascus, Al Nile, Baghdad, System
 * - Supports regular (400) and bold (700) weights
 *
 * Text Shaping:
 * - RTL text direction for Arabic
 * - Center text alignment
 * - Single line with ellipsis truncation
 * - Custom max width for layout
 *
 * Performance:
 * - Font provider initialized once globally
 * - Typeface cached after first match
 * - Font objects reused across paragraphs
 */

import { Skia, listFontFamilies, Paragraph } from '@shopify/react-native-skia';

// SF Arabic font alias and asset
const SF_ARABIC_ALIAS = 'SF Arabic';
// Note: SF Arabic font asset available at ../../../assets/fonts/SF Arabic Regular.ttf
// Font is loaded via system font manager, not from asset directly

// Arabic font fallback chain (priority order)
const ARABIC_FONT_NAMES = [
  'SF Arabic',
  '.SF Arabic',
  '.SF NS Arabic',
  '.SFNSArabic',
  'Geeza Pro',
  'GeezaPro',
  'Damascus',
  'Al Nile',
  'Baghdad',
  '.SF NS Display',
  '.SF NS Text',
  '.SF NS',
  '.SFNS-Regular',
] as const;

// Global font resources (initialized once)
let fontMgr: ReturnType<typeof Skia.FontMgr.System> | null = null;
let arabicFontProvider: ReturnType<typeof Skia.TypefaceFontProvider.Make> | null = null;
let arabicTypeface: ReturnType<typeof fontMgr.matchFamilyStyle> | null = null;
let arabicFont: ReturnType<typeof Skia.Font> | null = null;
let arabicFontBold: ReturnType<typeof Skia.Font> | null = null;

/**
 * Initialize Arabic font system
 *
 * Attempts to load SF Arabic font and create font provider.
 * Tries multiple font name variants in priority order until a match is found.
 * Called once on module initialization.
 *
 * @returns True if initialization successful, false otherwise
 */
export function initializeArabicFonts(): boolean {
  if (fontMgr && arabicFontProvider) return true; // Already initialized

  try {
    fontMgr = Skia.FontMgr.System();
    arabicFontProvider = Skia.TypefaceFontProvider.Make();

    if (!fontMgr || !arabicFontProvider) return false;

    // Try each font name in priority order
    for (const fontName of ARABIC_FONT_NAMES) {
      try {
        arabicTypeface = fontMgr.matchFamilyStyle(fontName, {
          weight: 400,
          width: 5,
          slant: 0,
        });

        if (arabicTypeface) {
          // Create regular font (400 weight)
          arabicFont = Skia.Font(arabicTypeface, 11);

          // Create bold font (700 weight)
          const boldTypeface = fontMgr.matchFamilyStyle(fontName, {
            weight: 700,
            width: 5,
            slant: 0,
          });
          arabicFontBold = boldTypeface
            ? Skia.Font(boldTypeface, 11)
            : arabicFont; // Fallback to regular if bold not available

          // Register font with provider
          if (arabicTypeface && arabicFontProvider) {
            try {
              arabicFontProvider.registerFont(arabicTypeface, SF_ARABIC_ALIAS);
            } catch (e) {
              // Registration may fail if already registered - ignore
            }
          }

          return true; // Success!
        }
      } catch (e) {
        // Try next font in fallback chain
        continue;
      }
    }

    return false; // No fonts matched
  } catch (error) {
    console.error('Failed to initialize Arabic fonts:', error);
    return false;
  }
}

// Initialize fonts on module load
initializeArabicFonts();

/**
 * Create Arabic text paragraph with proper RTL shaping
 *
 * Uses Skia ParagraphBuilder to create properly shaped Arabic text.
 * Applies RTL text direction, center alignment, and font fallback chain.
 *
 * @param text - Arabic text to render
 * @param fontWeight - Font weight: 'normal' or 'bold'
 * @param fontSize - Font size in pixels
 * @param color - Text color (hex string)
 * @param maxWidth - Maximum paragraph width in pixels
 * @returns Skia Paragraph object or null if creation fails
 *
 * @example
 * const paragraph = createArabicParagraph('محمد', 'bold', 14, '#242121', 120);
 * if (paragraph) {
 *   // Render with <Paragraph paragraph={paragraph} x={100} y={50} />
 * }
 */
export function createArabicParagraph(
  text: string,
  fontWeight: 'normal' | 'bold',
  fontSize: number,
  color: string,
  maxWidth: number
): Paragraph | null {
  if (!text || !Skia.ParagraphBuilder) return null;

  try {
    // Paragraph style (alignment, direction, truncation)
    const paragraphStyle = {
      textAlign: 2, // Center align (0=left, 1=right, 2=center)
      textDirection: 1, // RTL direction (0=LTR, 1=RTL)
      maxLines: 1,
      ellipsis: '...',
    };

    // Re-register font if available (ensures provider has latest typeface)
    if (arabicTypeface && arabicFontProvider) {
      try {
        arabicFontProvider.registerFont(arabicTypeface, SF_ARABIC_ALIAS);
      } catch (e) {
        // Already registered - ignore
      }
    }

    // Text style (color, font, weight)
    const textStyle = {
      color: Skia.Color(color),
      fontSize: fontSize,
      fontFamilies: arabicTypeface
        ? [SF_ARABIC_ALIAS]
        : [
            SF_ARABIC_ALIAS,
            '.SF Arabic',
            '.SF NS Arabic',
            '.SFNSArabic',
            'Geeza Pro',
            'GeezaPro',
            'Damascus',
            'Al Nile',
            'Baghdad',
            'System',
          ],
      fontStyle: {
        weight: fontWeight === 'bold' ? 700 : 400,
      },
    };

    // Create paragraph builder
    const builder = arabicFontProvider
      ? Skia.ParagraphBuilder.Make(paragraphStyle, arabicFontProvider)
      : Skia.ParagraphBuilder.Make(paragraphStyle);

    if (!builder) return null;

    // Build paragraph
    builder.pushStyle(textStyle);
    builder.addText(text);

    const paragraph = builder.build();
    if (!paragraph) return null;

    // Layout paragraph with max width
    paragraph.layout(maxWidth);

    return paragraph;
  } catch (error) {
    console.error('Error creating paragraph:', error);
    return null;
  }
}

/**
 * Get font resources for direct use
 *
 * Returns initialized font objects for custom rendering.
 *
 * @returns Font resources or null if not initialized
 */
export function getArabicFonts() {
  return {
    regular: arabicFont,
    bold: arabicFontBold,
    typeface: arabicTypeface,
    provider: arabicFontProvider,
  };
}

/**
 * Check if Arabic fonts are initialized
 *
 * @returns True if fonts successfully loaded
 */
export function isArabicFontsReady(): boolean {
  return !!(fontMgr && arabicFontProvider && arabicTypeface);
}

// Export constants for testing
export const ARABIC_TEXT_CONSTANTS = {
  SF_ARABIC_ALIAS,
  ARABIC_FONT_NAMES,
};
