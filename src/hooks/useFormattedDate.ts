import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { formatDateByPreference } from '../utils/dateDisplay';
import { gregorianToHijri } from '../utils/hijriConverter';
import { toArabicNumerals } from '../utils/dateUtils';

interface DateInput {
  gregorian?: { day: number; month: number; year: number };
  hijri?: { day: number; month: number; year: number };
}

export function useFormattedDate(
  date: Date | string | number | DateInput | null | undefined,
  options: {
    relative?: boolean;
    relativeThreshold?: number; // days
  } = {}
): string {
  const { settings } = useSettings();

  // Extract specific settings to ensure proper re-renders
  const defaultCalendar = settings?.defaultCalendar;
  const dateFormat = settings?.dateFormat;
  const showBothCalendars = settings?.showBothCalendars;
  const arabicNumerals = settings?.arabicNumerals;

  return useMemo(() => {
    if (!date) return '';

    const { relative = false, relativeThreshold = 14 } = options;

    // Convert input to Date object
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
    } else if (typeof date === 'object' && 'gregorian' in date) {
      // Already formatted date object - use current settings
      const currentSettings = {
        defaultCalendar,
        dateFormat,
        showBothCalendars,
        arabicNumerals
      };
      return formatDateByPreference(date, currentSettings);
    } else {
      return '';
    }

    // Calculate relative time if requested
    if (relative) {
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      // Within relative threshold, show relative time
      if (diffDays <= relativeThreshold) {
        const formatRelative = (value: number | string): string => {
          const str = String(value);
          // Use extracted arabicNumerals value instead of settings object
          return arabicNumerals ? toArabicNumerals(str) : str;
        };

        // For dates older than threshold, show actual date with user preferences
        if (diffDays > relativeThreshold) {
          // Fall through to show actual date
        } else if (diffDays >= 14) {
          return 'منذ أسبوعين';
        } else if (diffDays >= 7) {
          return 'منذ أسبوع';
        } else if (diffDays > 0) {
          const dayStr = formatRelative(diffDays);
          return diffDays === 1 ? 'أمس' : `منذ ${dayStr} ${diffDays === 2 ? 'يومين' : 'أيام'}`;
        } else if (diffHours > 0) {
          const hourStr = formatRelative(diffHours);
          return diffHours === 1
            ? 'منذ ساعة'
            : diffHours === 2
              ? 'منذ ساعتين'
              : `منذ ${hourStr} ${diffHours <= 10 ? 'ساعات' : 'ساعة'}`;
        } else if (diffMinutes > 0) {
          const minuteStr = formatRelative(diffMinutes);
          return diffMinutes === 1
            ? 'منذ دقيقة'
            : diffMinutes === 2
              ? 'منذ دقيقتين'
              : `منذ ${minuteStr} ${diffMinutes <= 10 ? 'دقائق' : 'دقيقة'}`;
        } else {
          return 'قبل لحظات';
        }
      }
    }

    // Convert to standard date format
    const gregorian = {
      day: dateObj.getDate(),
      month: dateObj.getMonth() + 1,
      year: dateObj.getFullYear(),
    };
    const hijri = gregorianToHijri(gregorian.year, gregorian.month, gregorian.day);

    // Create settings object from extracted values to ensure proper updates
    const currentSettings = {
      defaultCalendar,
      dateFormat,
      showBothCalendars,
      arabicNumerals
    };

    return formatDateByPreference({ gregorian, hijri }, currentSettings);
  }, [date, defaultCalendar, dateFormat, showBothCalendars, arabicNumerals, options.relative, options.relativeThreshold]);
}

// Convenience hooks for common use cases
export function useRelativeDate(date: Date | string | number | null | undefined): string {
  return useFormattedDate(date, { relative: true });
}

export function useAbsoluteDate(date: Date | string | number | null | undefined): string {
  return useFormattedDate(date, { relative: false });
}