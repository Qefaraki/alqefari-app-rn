/**
 * Timestamp Formatting Utilities
 * Provides hybrid relative/absolute timestamp formatting for Arabic
 */

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const parseFlexibleTimestamp = (timestamp: string | Date): Date => {
  if (timestamp instanceof Date) return timestamp;
  if (!timestamp) return new Date(NaN);

  let normalized = timestamp.trim();

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
  }

  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const date = parseISO(normalized);
  if (isNaN(date.getTime())) {
    return new Date(normalized);
  }

  return date;
};

/**
 * Format timestamp with hybrid approach:
 * - Recent (< 1 hour): "منذ 30 دقيقة"
 * - Today: "اليوم 02:30 م"
 * - Yesterday: "أمس 02:30 م"
 * - Older: "10 يناير, 02:30 م"
 */
export const formatRelativeTime = (timestamp: string | Date): string => {
  try {
    const date = parseFlexibleTimestamp(timestamp);

    // Validate date
    if (isNaN(date.getTime())) {
      return 'تاريخ غير صالح';
    }

    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    // Future dates (system clock issues)
    if (diffHours < 0) {
      return 'المستقبل';
    }

    // Recent (< 1 hour)
    if (diffHours < 1) {
      return formatDistanceToNow(date, { locale: ar, addSuffix: true });
    }

    // Today (< 24 hours)
    if (isToday(date)) {
      return 'اليوم ' + format(date, 'h:mm a', { locale: ar });
    }

    // Yesterday
    if (isYesterday(date)) {
      return 'أمس ' + format(date, 'h:mm a', { locale: ar });
    }

    // This week (< 7 days)
    if (diffHours < 168) {
      return format(date, 'EEEE h:mm a', { locale: ar });
    }

    // Older than a week
    return format(date, 'd MMMM, h:mm a', { locale: ar });
  } catch (error) {
    console.warn('Failed to format timestamp:', timestamp, error);
    return 'تاريخ غير صالح';
  }
};

/**
 * Format absolute timestamp with full date and time
 * Used for tooltips and long-press displays
 */
export const formatAbsoluteTime = (timestamp: string | Date): string => {
  try {
    const date = parseFlexibleTimestamp(timestamp);

    if (isNaN(date.getTime())) {
      return 'تاريخ غير صالح';
    }

    return format(date, 'PPpp', { locale: ar });
  } catch (error) {
    console.warn('Failed to format absolute timestamp:', timestamp, error);
    return 'تاريخ غير صالح';
  }
};

/**
 * Format timestamp for activity log cards
 * Shows relative time with fallback to absolute
 */
export const formatActivityTimestamp = (timestamp: string | Date): string => {
  return formatRelativeTime(timestamp);
};

/**
 * Smart timestamp that shows both relative and absolute in tooltip format
 * Example: "منذ ساعتين (10 يناير 2025, 02:30 م)"
 */
export const formatSmartTimestamp = (timestamp: string | Date): {
  display: string;
  tooltip: string;
} => {
  const relative = formatRelativeTime(timestamp);
  const absolute = formatAbsoluteTime(timestamp);

  return {
    display: relative,
    tooltip: absolute,
  };
};
