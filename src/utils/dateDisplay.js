import { toArabicNumerals } from "./dateUtils";

// Arabic month names
const hijriMonths = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

const gregorianMonthsAr = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/**
 * Format a date based on user preferences
 */
function formatDate(day, month, year, type = "gregorian", settings = {}) {
  if (!day || !month || !year) return "";

  const { dateFormat = "numeric", arabicNumerals = false } = settings;

  // Format based on type - Always use DD/MM/YYYY format
  if (dateFormat === "numeric") {
    // Numeric format: DD/MM/YYYY only
    const dayStr = day.toString().padStart(2, "0");
    const monthStr = month.toString().padStart(2, "0");
    const yearStr = year.toString();

    let result = `${dayStr}/${monthStr}/${yearStr}`;

    // Add calendar indicator
    if (type === "hijri") {
      result += " هـ";
    }

    // Convert to Arabic numerals if needed
    if (arabicNumerals) {
      result = toArabicNumerals(result);
    }

    return result;
  } else if (dateFormat === "words") {
    // Full words format: 15 يناير 2024
    if (type === "hijri") {
      const monthName = hijriMonths[month - 1] || month;
      const result = `${day} ${monthName} ${year} هـ`;
      return arabicNumerals ? toArabicNumerals(result) : result;
    } else {
      const monthName = gregorianMonthsAr[month - 1] || month;
      const result = `${day} ${monthName} ${year}`;
      return arabicNumerals ? toArabicNumerals(result) : result;
    }
  }

  // Fallback to numeric
  return `${day}/${month}/${year}`;
}

/**
 * Format a date object based on user's preferences
 * @param {Object} dateData - The date object with hijri/gregorian data
 * @param {Object} settings - User's date display settings
 * @returns {string} Formatted date string
 */
export function formatDateByPreference(dateData, settings = {}) {
  if (!dateData) return "";

  // Use default settings if not provided - simplified
  const finalSettings = {
    defaultCalendar: "gregorian",
    dateFormat: "numeric",
    showBothCalendars: false,
    arabicNumerals: false,
    ...settings,
  };

  const preference = finalSettings.defaultCalendar;
  let primaryDate = "";
  let secondaryDate = "";

  // Format primary calendar
  if (preference === "hijri") {
    // Try to get Hijri date
    if (
      dateData.hijri &&
      dateData.hijri.day &&
      dateData.hijri.month &&
      dateData.hijri.year
    ) {
      primaryDate = formatDate(
        dateData.hijri.day,
        dateData.hijri.month,
        dateData.hijri.year,
        "hijri",
        finalSettings,
      );
    } else if (
      dateData.hijri_day &&
      dateData.hijri_month &&
      dateData.hijri_year
    ) {
      primaryDate = formatDate(
        dateData.hijri_day,
        dateData.hijri_month,
        dateData.hijri_year,
        "hijri",
        finalSettings,
      );
    }

    // Get Gregorian for secondary if showing both
    if (finalSettings.showBothCalendars) {
      if (
        dateData.gregorian &&
        dateData.gregorian.day &&
        dateData.gregorian.month &&
        dateData.gregorian.year
      ) {
        secondaryDate = formatDate(
          dateData.gregorian.day,
          dateData.gregorian.month,
          dateData.gregorian.year,
          "gregorian",
          finalSettings,
        );
      } else if (dateData.day && dateData.month && dateData.year) {
        secondaryDate = formatDate(
          dateData.day,
          dateData.month,
          dateData.year,
          "gregorian",
          finalSettings,
        );
      }
    }
  } else {
    // Try to get Gregorian date
    if (
      dateData.gregorian &&
      dateData.gregorian.day &&
      dateData.gregorian.month &&
      dateData.gregorian.year
    ) {
      primaryDate = formatDate(
        dateData.gregorian.day,
        dateData.gregorian.month,
        dateData.gregorian.year,
        "gregorian",
        finalSettings,
      );
    } else if (dateData.day && dateData.month && dateData.year) {
      primaryDate = formatDate(
        dateData.day,
        dateData.month,
        dateData.year,
        "gregorian",
        finalSettings,
      );
    }

    // Get Hijri for secondary if showing both
    if (finalSettings.showBothCalendars) {
      if (
        dateData.hijri &&
        dateData.hijri.day &&
        dateData.hijri.month &&
        dateData.hijri.year
      ) {
        secondaryDate = formatDate(
          dateData.hijri.day,
          dateData.hijri.month,
          dateData.hijri.year,
          "hijri",
          finalSettings,
        );
      } else if (
        dateData.hijri_day &&
        dateData.hijri_month &&
        dateData.hijri_year
      ) {
        secondaryDate = formatDate(
          dateData.hijri_day,
          dateData.hijri_month,
          dateData.hijri_year,
          "hijri",
          finalSettings,
        );
      }
    }
  }

  // Combine dates if showing both
  if (finalSettings.showBothCalendars && primaryDate && secondaryDate) {
    return `${primaryDate} (${secondaryDate})`;
  }

  // Return primary date or fallback
  return primaryDate || dateData.display || "";
}

/**
 * Get the label for the date based on preference
 * @param {string} preference - 'hijri' or 'gregorian'
 * @returns {string} The appropriate label
 */
export function getDateLabel(preference = "hijri") {
  return preference === "hijri" ? "التاريخ الهجري" : "التاريخ الميلادي";
}
