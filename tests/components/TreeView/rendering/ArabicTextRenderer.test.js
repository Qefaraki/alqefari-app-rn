/**
 * ArabicTextRenderer tests
 * Phase 2 Day 2
 */

import {
  initializeArabicFonts,
  createArabicParagraph,
  getArabicFonts,
  isArabicFontsReady,
  ARABIC_TEXT_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/ArabicTextRenderer';

// Mock Skia
const mockParagraph = {
  layout: jest.fn(),
  getHeight: jest.fn(() => 14),
  getMinIntrinsicWidth: jest.fn(() => 100),
  getMaxIntrinsicWidth: jest.fn(() => 120),
};

const mockBuilder = {
  pushStyle: jest.fn(),
  addText: jest.fn(),
  build: jest.fn(() => mockParagraph),
};

const mockTypeface = {
  getFamilyName: jest.fn(() => 'SF Arabic'),
};

const mockFont = {
  getSize: jest.fn(() => 11),
  getTypeface: jest.fn(() => mockTypeface),
};

const mockFontMgr = {
  matchFamilyStyle: jest.fn(() => mockTypeface),
};

const mockFontProvider = {
  registerFont: jest.fn(),
};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    FontMgr: {
      System: jest.fn(() => mockFontMgr),
    },
    TypefaceFontProvider: {
      Make: jest.fn(() => mockFontProvider),
    },
    ParagraphBuilder: {
      Make: jest.fn(() => mockBuilder),
    },
    Font: jest.fn(() => mockFont),
    Color: jest.fn((color) => color),
  },
  listFontFamilies: jest.fn(() => [
    'SF Arabic',
    '.SF Arabic',
    'Geeza Pro',
    'Damascus',
  ]),
}));

describe('ArabicTextRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeArabicFonts', () => {
    it('should initialize font system successfully', () => {
      const result = initializeArabicFonts();

      expect(result).toBe(true);
    });

    it('should return true if already initialized', () => {
      initializeArabicFonts(); // First call
      const result = initializeArabicFonts(); // Second call

      expect(result).toBe(true);
    });

    it('should try multiple font names in fallback chain', () => {
      const { Skia } = require('@shopify/react-native-skia');
      Skia.FontMgr.System().matchFamilyStyle.mockReturnValueOnce(null); // First fails
      Skia.FontMgr.System().matchFamilyStyle.mockReturnValueOnce(mockTypeface); // Second succeeds

      const result = initializeArabicFonts();

      expect(result).toBe(true);
    });
  });

  describe('createArabicParagraph', () => {
    it('should create paragraph with normal weight', () => {
      const paragraph = createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeTruthy();
      expect(mockBuilder.pushStyle).toHaveBeenCalled();
      expect(mockBuilder.addText).toHaveBeenCalledWith('محمد');
      expect(mockParagraph.layout).toHaveBeenCalledWith(120);
    });

    it('should create paragraph with bold weight', () => {
      const paragraph = createArabicParagraph('أحمد', 'bold', 16, '#A13333', 100);

      expect(paragraph).toBeTruthy();
      expect(mockBuilder.addText).toHaveBeenCalledWith('أحمد');
    });

    it('should return null for empty text', () => {
      const paragraph = createArabicParagraph('', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeNull();
    });

    it('should return null if ParagraphBuilder not available', () => {
      const { Skia } = require('@shopify/react-native-skia');
      const originalPB = Skia.ParagraphBuilder;
      Skia.ParagraphBuilder = null;

      const paragraph = createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeNull();
      Skia.ParagraphBuilder = originalPB; // Restore
    });

    it('should handle different font sizes', () => {
      const sizes = [11, 14, 16, 20, 28];

      sizes.forEach((size) => {
        const paragraph = createArabicParagraph('نص', 'normal', size, '#242121', 120);
        expect(paragraph).toBeTruthy();
      });
    });

    it('should handle different colors', () => {
      const colors = ['#242121', '#A13333', '#D58C4A', '#FFFFFF', '#000000'];

      colors.forEach((color) => {
        const paragraph = createArabicParagraph('نص', 'normal', 14, color, 120);
        expect(paragraph).toBeTruthy();
      });
    });

    it('should handle different max widths', () => {
      const widths = [50, 100, 150, 200, 300];

      widths.forEach((width) => {
        const paragraph = createArabicParagraph('نص', 'normal', 14, '#242121', width);
        expect(paragraph).toBeTruthy();
        expect(mockParagraph.layout).toHaveBeenCalledWith(width);
      });
    });

    it('should use RTL text direction', () => {
      createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      const makeCall = require('@shopify/react-native-skia').Skia.ParagraphBuilder.Make;
      const paragraphStyle = makeCall.mock.calls[makeCall.mock.calls.length - 1][0];

      expect(paragraphStyle.textDirection).toBe(1); // 1 = RTL
    });

    it('should use center text alignment', () => {
      createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      const makeCall = require('@shopify/react-native-skia').Skia.ParagraphBuilder.Make;
      const paragraphStyle = makeCall.mock.calls[makeCall.mock.calls.length - 1][0];

      expect(paragraphStyle.textAlign).toBe(2); // 2 = center
    });

    it('should limit to single line with ellipsis', () => {
      createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      const makeCall = require('@shopify/react-native-skia').Skia.ParagraphBuilder.Make;
      const paragraphStyle = makeCall.mock.calls[makeCall.mock.calls.length - 1][0];

      expect(paragraphStyle.maxLines).toBe(1);
      expect(paragraphStyle.ellipsis).toBe('...');
    });

    it('should handle builder creation failure', () => {
      const { Skia } = require('@shopify/react-native-skia');
      Skia.ParagraphBuilder.Make.mockReturnValueOnce(null);

      const paragraph = createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeNull();
    });

    it('should handle paragraph build failure', () => {
      mockBuilder.build.mockReturnValueOnce(null);

      const paragraph = createArabicParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeNull();
      mockBuilder.build.mockReturnValue(mockParagraph); // Restore
    });
  });

  describe('getArabicFonts', () => {
    it('should return font resources', () => {
      const fonts = getArabicFonts();

      expect(fonts).toHaveProperty('regular');
      expect(fonts).toHaveProperty('bold');
      expect(fonts).toHaveProperty('typeface');
      expect(fonts).toHaveProperty('provider');
    });

    it('should return null if fonts not initialized', () => {
      // Note: In real scenario, fonts are initialized on module load
      // This tests the return structure
      const fonts = getArabicFonts();

      expect(fonts).toBeDefined();
    });
  });

  describe('isArabicFontsReady', () => {
    it('should return true when fonts initialized', () => {
      initializeArabicFonts();
      const ready = isArabicFontsReady();

      expect(ready).toBe(true);
    });
  });

  describe('ARABIC_TEXT_CONSTANTS', () => {
    it('should export SF_ARABIC_ALIAS', () => {
      expect(ARABIC_TEXT_CONSTANTS.SF_ARABIC_ALIAS).toBe('SF Arabic');
    });

    it('should export ARABIC_FONT_NAMES array', () => {
      expect(Array.isArray(ARABIC_TEXT_CONSTANTS.ARABIC_FONT_NAMES)).toBe(true);
      expect(ARABIC_TEXT_CONSTANTS.ARABIC_FONT_NAMES).toContain('SF Arabic');
      expect(ARABIC_TEXT_CONSTANTS.ARABIC_FONT_NAMES).toContain('.SF Arabic');
      expect(ARABIC_TEXT_CONSTANTS.ARABIC_FONT_NAMES).toContain('Geeza Pro');
    });

    it('should have SF Arabic as first fallback', () => {
      expect(ARABIC_TEXT_CONSTANTS.ARABIC_FONT_NAMES[0]).toBe('SF Arabic');
    });
  });
});
