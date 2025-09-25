import React from 'react';
import { ImageSourcePropType } from 'react-native';

// Map of all available Sadu patterns
const SADU_PATTERNS = {
  // Hero/Feature patterns (bold, geometric)
  hero: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],

  // Large story patterns (balanced, repeating)
  large: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],

  // Side-by-side patterns (delicate borders)
  side: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60],

  // Text-only accent patterns
  text: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80],

  // Loading/skeleton patterns (subtle, animated)
  loading: [81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102],

  // Special event patterns
  festive: [45, 46, 47, 48, 49], // Eid, celebrations
  somber: [88, 89, 90, 91, 92],  // Condolences
  breaking: [1, 2, 3, 4, 5],     // Urgent news
};

// Pattern selection logic
export const getSaduPattern = (
  articleId: number,
  variant: 'hero' | 'large' | 'side' | 'text' | 'loading' = 'side',
  title?: string
): ImageSourcePropType => {
  // Check for special content types
  if (title) {
    if (title.includes('عيد') || title.includes('احتفال') || title.includes('زواج')) {
      const festivePattern = SADU_PATTERNS.festive[articleId % SADU_PATTERNS.festive.length];
      return require(`../../../../assets/sadu_patterns/png/${festivePattern}.png`);
    }

    if (title.includes('وفاة') || title.includes('رحل') || title.includes('عزاء')) {
      const somberPattern = SADU_PATTERNS.somber[articleId % SADU_PATTERNS.somber.length];
      return require(`../../../../assets/sadu_patterns/png/${somberPattern}.png`);
    }

    if (title.includes('عاجل') || title.includes('هام')) {
      const breakingPattern = SADU_PATTERNS.breaking[articleId % SADU_PATTERNS.breaking.length];
      return require(`../../../../assets/sadu_patterns/png/${breakingPattern}.png`);
    }
  }

  // Regular pattern selection based on variant
  const patternSet = SADU_PATTERNS[variant];
  const patternIndex = articleId % patternSet.length;
  const patternNumber = patternSet[patternIndex];

  // Dynamic require doesn't work in React Native, so we need a switch
  return getPatternImage(patternNumber);
};

// Helper to get pattern image by number
const getPatternImage = (num: number): ImageSourcePropType => {
  switch(num) {
    case 1: return require('../../../../assets/sadu_patterns/png/1.png');
    case 2: return require('../../../../assets/sadu_patterns/png/2.png');
    case 3: return require('../../../../assets/sadu_patterns/png/3.png');
    case 4: return require('../../../../assets/sadu_patterns/png/4.png');
    case 5: return require('../../../../assets/sadu_patterns/png/5.png');
    case 6: return require('../../../../assets/sadu_patterns/png/6.png');
    case 7: return require('../../../../assets/sadu_patterns/png/7.png');
    case 8: return require('../../../../assets/sadu_patterns/png/8.png');
    case 9: return require('../../../../assets/sadu_patterns/png/9.png');
    case 10: return require('../../../../assets/sadu_patterns/png/10.png');
    case 11: return require('../../../../assets/sadu_patterns/png/11.png');
    case 12: return require('../../../../assets/sadu_patterns/png/12.png');
    case 13: return require('../../../../assets/sadu_patterns/png/13.png');
    case 14: return require('../../../../assets/sadu_patterns/png/14.png');
    case 15: return require('../../../../assets/sadu_patterns/png/15.png');
    case 16: return require('../../../../assets/sadu_patterns/png/16.png');
    case 17: return require('../../../../assets/sadu_patterns/png/17.png');
    case 18: return require('../../../../assets/sadu_patterns/png/18.png');
    case 19: return require('../../../../assets/sadu_patterns/png/19.png');
    case 20: return require('../../../../assets/sadu_patterns/png/20.png');
    case 21: return require('../../../../assets/sadu_patterns/png/21.png');
    case 22: return require('../../../../assets/sadu_patterns/png/22.png');
    case 23: return require('../../../../assets/sadu_patterns/png/23.png');
    case 24: return require('../../../../assets/sadu_patterns/png/24.png');
    case 25: return require('../../../../assets/sadu_patterns/png/25.png');
    case 26: return require('../../../../assets/sadu_patterns/png/26.png');
    case 27: return require('../../../../assets/sadu_patterns/png/27.png');
    case 28: return require('../../../../assets/sadu_patterns/png/28.png');
    case 29: return require('../../../../assets/sadu_patterns/png/29.png');
    case 30: return require('../../../../assets/sadu_patterns/png/30.png');
    case 31: return require('../../../../assets/sadu_patterns/png/31.png');
    case 32: return require('../../../../assets/sadu_patterns/png/32.png');
    case 33: return require('../../../../assets/sadu_patterns/png/33.png');
    case 34: return require('../../../../assets/sadu_patterns/png/34.png');
    case 35: return require('../../../../assets/sadu_patterns/png/35.png');
    case 36: return require('../../../../assets/sadu_patterns/png/36.png');
    case 37: return require('../../../../assets/sadu_patterns/png/37.png');
    case 38: return require('../../../../assets/sadu_patterns/png/38.png');
    case 39: return require('../../../../assets/sadu_patterns/png/39.png');
    case 40: return require('../../../../assets/sadu_patterns/png/40.png');
    case 41: return require('../../../../assets/sadu_patterns/png/41.png');
    case 42: return require('../../../../assets/sadu_patterns/png/42.png');
    case 43: return require('../../../../assets/sadu_patterns/png/43.png');
    case 44: return require('../../../../assets/sadu_patterns/png/44.png');
    case 45: return require('../../../../assets/sadu_patterns/png/45.png');
    case 46: return require('../../../../assets/sadu_patterns/png/46.png');
    case 47: return require('../../../../assets/sadu_patterns/png/47.png');
    case 48: return require('../../../../assets/sadu_patterns/png/48.png');
    case 49: return require('../../../../assets/sadu_patterns/png/49.png');
    case 50: return require('../../../../assets/sadu_patterns/png/50.png');
    case 51: return require('../../../../assets/sadu_patterns/png/51.png');
    case 52: return require('../../../../assets/sadu_patterns/png/52.png');
    case 53: return require('../../../../assets/sadu_patterns/png/53.png');
    case 54: return require('../../../../assets/sadu_patterns/png/54.png');
    case 55: return require('../../../../assets/sadu_patterns/png/55.png');
    case 56: return require('../../../../assets/sadu_patterns/png/56.png');
    case 58: return require('../../../../assets/sadu_patterns/png/58.png');
    case 59: return require('../../../../assets/sadu_patterns/png/59.png');
    case 60: return require('../../../../assets/sadu_patterns/png/60.png');
    case 61: return require('../../../../assets/sadu_patterns/png/61.png');
    case 62: return require('../../../../assets/sadu_patterns/png/62.png');
    case 63: return require('../../../../assets/sadu_patterns/png/63.png');
    case 64: return require('../../../../assets/sadu_patterns/png/64.png');
    case 65: return require('../../../../assets/sadu_patterns/png/65.png');
    case 66: return require('../../../../assets/sadu_patterns/png/66.png');
    case 67: return require('../../../../assets/sadu_patterns/png/67.png');
    case 68: return require('../../../../assets/sadu_patterns/png/68.png');
    case 69: return require('../../../../assets/sadu_patterns/png/69.png');
    case 70: return require('../../../../assets/sadu_patterns/png/70.png');
    case 71: return require('../../../../assets/sadu_patterns/png/71.png');
    case 72: return require('../../../../assets/sadu_patterns/png/72.png');
    case 73: return require('../../../../assets/sadu_patterns/png/73.png');
    case 74: return require('../../../../assets/sadu_patterns/png/74.png');
    case 75: return require('../../../../assets/sadu_patterns/png/75.png');
    case 76: return require('../../../../assets/sadu_patterns/png/76.png');
    case 77: return require('../../../../assets/sadu_patterns/png/77.png');
    case 78: return require('../../../../assets/sadu_patterns/png/78.png');
    case 79: return require('../../../../assets/sadu_patterns/png/79.png');
    case 80: return require('../../../../assets/sadu_patterns/png/80.png');
    case 81: return require('../../../../assets/sadu_patterns/png/81.png');
    case 82: return require('../../../../assets/sadu_patterns/png/82.png');
    case 83: return require('../../../../assets/sadu_patterns/png/83.png');
    case 84: return require('../../../../assets/sadu_patterns/png/84.png');
    case 85: return require('../../../../assets/sadu_patterns/png/85.png');
    case 86: return require('../../../../assets/sadu_patterns/png/86.png');
    case 87: return require('../../../../assets/sadu_patterns/png/87.png');
    case 88: return require('../../../../assets/sadu_patterns/png/88.png');
    case 89: return require('../../../../assets/sadu_patterns/png/89.png');
    case 91: return require('../../../../assets/sadu_patterns/png/91.png');
    case 92: return require('../../../../assets/sadu_patterns/png/92.png');
    case 93: return require('../../../../assets/sadu_patterns/png/93.png');
    case 94: return require('../../../../assets/sadu_patterns/png/94.png');
    case 95: return require('../../../../assets/sadu_patterns/png/95.png');
    case 96: return require('../../../../assets/sadu_patterns/png/96.png');
    case 97: return require('../../../../assets/sadu_patterns/png/97.png');
    case 98: return require('../../../../assets/sadu_patterns/png/98.png');
    case 99: return require('../../../../assets/sadu_patterns/png/99.png');
    case 100: return require('../../../../assets/sadu_patterns/png/100.png');
    case 101: return require('../../../../assets/sadu_patterns/png/101.png');
    case 102: return require('../../../../assets/sadu_patterns/png/102.png');
    default: return require('../../../../assets/sadu_patterns/png/1.png');
  }
};

// Get random pattern for loading states
export const getRandomLoadingPattern = (): ImageSourcePropType => {
  const patterns = SADU_PATTERNS.loading;
  const randomIndex = Math.floor(Math.random() * patterns.length);
  return getPatternImage(patterns[randomIndex]);
};