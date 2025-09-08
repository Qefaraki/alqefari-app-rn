import { formatDate } from "./dateUtils";

/**
 * Format a date object based on user's calendar preference
 * @param {Object} dateData - The date object with hijri_day, hijri_month, hijri_year, day, month, year
 * @param {string} preference - 'hijri' or 'gregorian'
 * @returns {string} Formatted date string
 */
export function formatDateByPreference(dateData, preference = "hijri") {
  if (!dateData) return "";

  if (preference === "hijri") {
    // Show Hijri date if available
    if (dateData.hijri_day && dateData.hijri_month && dateData.hijri_year) {
      return formatDate(
        dateData.hijri_day,
        dateData.hijri_month,
        dateData.hijri_year,
        "hijri",
      );
    }
    // Fall back to Gregorian if Hijri not available
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
    if (dateData.day && dateData.month && dateData.year) {
      return formatDate(
        dateData.day,
        dateData.month,
        dateData.year,
        "gregorian",
      );
    }
    // Fall back to Hijri if Gregorian not available
    if (dateData.hijri_day && dateData.hijri_month && dateData.hijri_year) {
      return formatDate(
        dateData.hijri_day,
        dateData.hijri_month,
        dateData.hijri_year,
        "hijri",
      );
    }
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
