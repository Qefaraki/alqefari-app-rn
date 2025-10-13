/**
 * Professional Title Service
 *
 * Manages professional titles for family tree profiles.
 * Provides title abbreviations, validation, and name formatting.
 */

export type ProfessionalTitleValue =
  | 'doctor'
  | 'prof_doctor'
  | 'engineer'
  | 'mister'
  | 'sheikh'
  | 'major_general'
  | 'brigadier'
  | 'other';

export interface ProfessionalTitle {
  value: ProfessionalTitleValue;
  label: string;
  abbrev: string | null;
}

export interface ProfileWithTitle {
  name?: string;
  name_chain?: string;
  fullNameChain?: string;
  professional_title?: ProfessionalTitleValue;
  title_abbreviation?: string;
}

/**
 * Available professional titles
 * Note: 'mister' (أستاذ) has NO abbreviation - it's just a normal Mr.
 */
export const PROFESSIONAL_TITLES: ProfessionalTitle[] = [
  { value: 'doctor', label: 'دكتور', abbrev: 'د.' },
  { value: 'prof_doctor', label: 'أستاذ دكتور', abbrev: 'أ.د.' },
  { value: 'engineer', label: 'مهندس', abbrev: 'م.' },
  { value: 'mister', label: 'أستاذ', abbrev: null }, // No abbreviation
  { value: 'sheikh', label: 'الشيخ', abbrev: 'الشيخ' },
  { value: 'major_general', label: 'اللواء', abbrev: 'اللواء' },
  { value: 'brigadier', label: 'عميد', abbrev: 'عميد' },
  { value: 'other', label: 'آخر (أدخل يدوياً)', abbrev: null },
];

/**
 * Validates custom title input
 * Requirements: Non-empty, max 20 chars, Arabic only
 */
export const validateCustomTitle = (input: string): { valid: boolean; error?: string } => {
  if (!input || input.trim() === '') {
    return { valid: false, error: 'الرجاء إدخال اللقب' };
  }
  if (input.length > 20) {
    return { valid: false, error: 'اللقب طويل جداً (الحد الأقصى 20 حرف)' };
  }
  // Allow Arabic letters, spaces, and dots only
  if (!/^[\u0600-\u06FF\s.]+$/.test(input)) {
    return { valid: false, error: 'يرجى استخدام أحرف عربية فقط' };
  }
  return { valid: true };
};

/**
 * Memoization cache for title abbreviations
 * Key format: "professional_title-title_abbreviation"
 */
const titleCache = new Map<string, string>();

/**
 * Gets the abbreviation for a profile's title
 * Returns empty string if no title or no abbreviation
 */
export const getTitleAbbreviation = (profile: ProfileWithTitle): string => {
  if (!profile.professional_title) return '';

  const cacheKey = `${profile.professional_title}-${profile.title_abbreviation || ''}`;
  if (titleCache.has(cacheKey)) {
    return titleCache.get(cacheKey)!;
  }

  let result = '';
  if (profile.professional_title === 'other') {
    // Use custom abbreviation for "other"
    result = profile.title_abbreviation || '';
  } else {
    // Look up standard title abbreviation
    const title = PROFESSIONAL_TITLES.find(t => t.value === profile.professional_title);
    result = title?.abbrev || '';
  }

  titleCache.set(cacheKey, result);
  return result;
};

/**
 * Formats a name with its title abbreviation
 * Handles overflow for TreeView by dropping title if needed
 *
 * @param profile - Profile with name and title
 * @param options - Optional formatting options
 * @param options.maxLength - Maximum character length (drops title if exceeded)
 * @param options.skipTitle - Force skip title display
 * @returns Formatted name (e.g., "د. محمد" or "محمد")
 */
export const formatNameWithTitle = (
  profile: ProfileWithTitle,
  options?: { maxLength?: number; skipTitle?: boolean }
): string => {
  const abbrev = getTitleAbbreviation(profile);
  // Prefer full name chain over first name only
  const baseName = profile.name_chain || profile.fullNameChain || profile.name || '';

  // If skipTitle requested or no abbreviation, return plain name
  if (options?.skipTitle || !abbrev) {
    return baseName;
  }

  const fullName = `${abbrev} ${baseName}`;

  // Handle overflow for TreeView - drop title if too long
  if (options?.maxLength && fullName.length > options.maxLength) {
    return baseName;
  }

  return fullName;
};

/**
 * Gets the full label for a title value
 * @param value - Professional title enum value
 * @returns Arabic label (e.g., "دكتور", "مهندس")
 */
export const getTitleLabel = (value: ProfessionalTitleValue): string => {
  const title = PROFESSIONAL_TITLES.find(t => t.value === value);
  return title?.label || '';
};

/**
 * Clears the title abbreviation cache
 * Useful for testing or if memory needs to be freed
 */
export const clearTitleCache = (): void => {
  titleCache.clear();
};
