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
 * Format a date for display
 */
function formatDate(day, month, year, type = "hijri") {
  if (!day || !month || !year) return "";

  if (type === "hijri") {
    const monthName = hijriMonths[month - 1] || month;
    return `${toArabicNumerals(day)} ${monthName} ${toArabicNumerals(year)} هـ`;
  } else {
    const monthName = gregorianMonthsAr[month - 1] || month;
    return `${day} ${monthName} ${year}`;
  }
}

/**
 * Format a date object based on user's calendar preference
 * @param {Object} dateData - The date object with hijri_day, hijri_month, hijri_year, day, month, year
 * @param {string} preference - 'hijri' or 'gregorian'
 * @returns {string} Formatted date string
 */
export function formatDateByPreference(dateData, preference = "hijri") {
  if (!dateData) return "";

  if (preference === "hijri") {
    // Check nested structure first (new format)
    if (
      dateData.hijri &&
      dateData.hijri.day &&
      dateData.hijri.month &&
      dateData.hijri.year
    ) {
      return formatDate(
        dateData.hijri.day,
        dateData.hijri.month,
        dateData.hijri.year,
        "hijri",
      );
    }
    // Check flat structure (legacy format)
    if (dateData.hijri_day && dateData.hijri_month && dateData.hijri_year) {
      return formatDate(
        dateData.hijri_day,
        dateData.hijri_month,
        dateData.hijri_year,
        "hijri",
      );
    }
    // Fall back to Gregorian if Hijri not available
    if (
      dateData.gregorian &&
      dateData.gregorian.day &&
      dateData.gregorian.month &&
      dateData.gregorian.year
    ) {
      return formatDate(
        dateData.gregorian.day,
        dateData.gregorian.month,
        dateData.gregorian.year,
        "gregorian",
      );
    }
    if (dateData.day && dateData.month && dateData.year) {
      return formatDate(
        dateData.day,
        dateData.month,
        dateData.year,
        "gregorian",
      );
    }
  } else {
    // Show Gregorian date if available
    // Check nested structure first (new format)
    if (
      dateData.gregorian &&
      dateData.gregorian.day &&
      dateData.gregorian.month &&
      dateData.gregorian.year
    ) {
      return formatDate(
        dateData.gregorian.day,
        dateData.gregorian.month,
        dateData.gregorian.year,
        "gregorian",
      );
    }
    // Check flat structure (legacy format)
    if (dateData.day && dateData.month && dateData.year) {
      return formatDate(
        dateData.day,
        dateData.month,
        dateData.year,
        "gregorian",
      );
    }
    // Fall back to Hijri if Gregorian not available
    if (
      dateData.hijri &&
      dateData.hijri.day &&
      dateData.hijri.month &&
      dateData.hijri.year
    ) {
      return formatDate(
        dateData.hijri.day,
        dateData.hijri.month,
        dateData.hijri.year,
        "hijri",
      );
    }
    if (dateData.hijri_day && dateData.hijri_month && dateData.hijri_year) {
      return formatDate(
        dateData.hijri_day,
        dateData.hijri_month,
        dateData.hijri_year,
        "hijri",
      );
    }
  }

  // If we have a display field, use it as last resort
  if (dateData.display) {
    return dateData.display;
  }

  return "";
}

/**
 * Get the label for the date based on preference
 * @param {string} preference - 'hijri' or 'gregorian'
 * @returns {string} The appropriate label
 */
export function getDateLabel(preference = "hijri") {
  return preference === "hijri" ? "التاريخ الهجري" : "التاريخ الميلادي";
}
