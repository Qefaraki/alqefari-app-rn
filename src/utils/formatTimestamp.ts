/**
 * Timestamp Formatting Utilities
 * Provides hybrid relative/absolute timestamp formatting for Arabic
 */

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * Format timestamp with hybrid approach:
 * - Recent (< 1 hour): "منذ 30 دقيقة"
 * - Today: "اليوم 02:30 م"
 * - Yesterday: "أمس 02:30 م"
 * - Older: "10 يناير, 02:30 م"
 */
export const formatRelativeTime = (timestamp: string | Date): string => {
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;

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
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;

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
