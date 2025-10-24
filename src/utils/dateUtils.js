import moment from "moment-hijri";
import {
  hijriToGregorian,
  gregorianToHijri,
  isValidHijriDate,
  isValidGregorianDate,
} from "./hijriConverter";

// Configure moment for Arabic locale
moment.locale("ar");

// Arabic month names for Hijri calendar
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

// Arabic month names for Gregorian calendar
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

// Arabic weekday names
const weekdaysAr = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
const weekdaysShortAr = [
  "أحد",
  "إثنين",
  "ثلاثاء",
  "أربعاء",
  "خميس",
  "جمعة",
  "سبت",
];

/**
 * Convert Arabic numerals to Eastern Arabic numerals
 */
export const toArabicNumerals = (str) => {
  // Handle null or undefined
  if (str === null || str === undefined || str === "") {
    return "";
  }
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(str).replace(
    /[0-9]/g,
    (digit) => arabicNumbers[parseInt(digit)],
  );
};

/**
 * Convert Eastern Arabic numerals to Western numerals
 */
export const fromArabicNumerals = (str) => {
  if (!str) return "";
  const westernNumbers = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  return String(str).replace(
    /[٠-٩]/g,
    (digit) => westernNumbers[digit] || digit,
  );
};

/**
 * Create a date object from Hijri components
 */
export const createFromHijri = (year, month, day) => {
  // Validate inputs - allow any year between 1-2200
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  // Basic range validation
  if (
    year < 1 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 30
  ) {
    return null;
  }

  try {
    // Always use our custom converter for consistent handling
    // This supports any year from 1-2200
    if (!isValidHijriDate(year, month, day)) {
      // If validation fails, still try to convert (relaxed validation)
      // This allows dates like 1300s which might fail strict validation
    }

    // Convert to Gregorian
    const gregorian = hijriToGregorian(year, month, day);
    if (!gregorian) {
      // If our converter fails, try moment-hijri as fallback
      try {
        const hijriDateString = `${year}/${month}/${day}`;
        const m = moment(hijriDateString, "iYYYY/iM/iD");

        if (m.isValid()) {
          return m;
        }
      } catch (momentError) {
        // Continue to manual creation below
      }

      // If all conversions fail, create a rough approximation
      // Hijri year 1 = 622 CE, average 354.36 days per Hijri year
      const approximateGregorianYear = Math.floor(
        622 + ((year - 1) * 354.36) / 365.25,
      );
      const m = moment()
        .year(approximateGregorianYear)
        .month(month - 1)
        .date(day);

      // Store the original Hijri values
      m._hijriYear = year;
      m._hijriMonth = month;
      m._hijriDay = day;

      return m;
    }

    // Create a moment object from the Gregorian date
    const m = moment()
      .year(gregorian.year)
      .month(gregorian.month - 1)
      .date(gregorian.day);

    // Store the original Hijri values for later retrieval
    m._hijriYear = year;
    m._hijriMonth = month;
    m._hijriDay = day;

    return m;
  } catch (error) {
    console.error("Error creating date from Hijri:", error);

    // Last resort: create with approximation
    const approximateGregorianYear = Math.floor(
      622 + ((year - 1) * 354.36) / 365.25,
    );
    const m = moment()
      .year(approximateGregorianYear)
      .month(month - 1)
      .date(day);

    m._hijriYear = year;
    m._hijriMonth = month;
    m._hijriDay = day;

    return m;
  }
};

/**
 * Create a date object from Gregorian components
 */
export const createFromGregorian = (year, month, day) => {
  // Validate inputs
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  try {
    const m = moment()
      .year(year)
      .month(month - 1)
      .date(day);

    // Verify the date is valid
    if (!m.isValid()) {
      return null;
    }

    return m;
  } catch (error) {
    return null;
  }
};

/**
 * Create a date object from partial date components (year-only or year+month)
 * Supports storing dates where user only knows the year
 * @param {number} year - Year (required)
 * @param {number|null} month - Month (optional, defaults to July/7 for conversion)
 * @param {number|null} day - Day (optional, defaults to 1 for conversion)
 * @param {boolean} isHijri - Whether input is Hijri calendar
 * @returns {Object|null} - Moment object with stored year/month/day values
 */
export const createFromPartialDate = (year, month = null, day = null, isHijri = false) => {
  // Year is required
  if (!year || isNaN(year)) {
    return null;
  }

  // Determine default month/day for conversion (use mid-year for approximation)
  const monthForConversion = month || 7; // July for Gregorian, mid-year
  const dayForConversion = day || 1;

  try {
    let momentObj;

    if (isHijri) {
      momentObj = createFromHijri(year, monthForConversion, dayForConversion);
    } else {
      momentObj = createFromGregorian(year, monthForConversion, dayForConversion);
    }

    if (!momentObj) {
      return null;
    }

    // Store the actual input values (with nulls for missing fields)
    momentObj._partialYear = year;
    momentObj._partialMonth = month;
    momentObj._partialDay = day;
    momentObj._isPartialDate = true;

    return momentObj;
  } catch (error) {
    console.error("Error creating partial date:", error);
    return null;
  }
};

/**
 * Convert a moment object to our JSONB structure
 * Supports partial dates (year-only or year+month)
 * @param {Object} momentObj - Moment object to convert
 * @param {boolean} approximate - Whether this is an approximate date
 * @param {boolean} hasMonth - Whether to include month in output (for partial dates)
 * @param {boolean} hasDay - Whether to include day in output (for partial dates)
 * @returns {Object|null} - JSONB structure or null
 */
export const toDateData = (momentObj, approximate = false, hasMonth = true, hasDay = true) => {
  if (!momentObj || !momentObj.isValid()) {
    return null;
  }

  try {
    // Get Gregorian values
    const gregorianYear = momentObj.year();
    const gregorianMonth = hasMonth ? momentObj.month() + 1 : null;
    const gregorianDay = hasDay ? momentObj.date() : null;

    // Get Hijri values with error handling
    let hijriYear, hijriMonth, hijriDay;
    let display;

    // Check if we have stored Hijri values (for ancient dates)
    if (momentObj._hijriYear && momentObj._hijriMonth && momentObj._hijriDay) {
      hijriYear = momentObj._hijriYear;
      hijriMonth = hasMonth ? momentObj._hijriMonth : null;
      hijriDay = hasDay ? momentObj._hijriDay : null;

      if (hasMonth && hasDay) {
        display = `${toArabicNumerals(hijriDay)}/${toArabicNumerals(hijriMonth)}/${toArabicNumerals(hijriYear)} هـ`;
      } else if (hasMonth) {
        display = `${toArabicNumerals(hijriMonth)}/${toArabicNumerals(hijriYear)} هـ`;
      } else {
        display = `${toArabicNumerals(hijriYear)} هـ`;
      }
    } else {
      // For dates without stored Hijri values, try different approaches
      try {
        // First try moment-hijri's built-in conversion
        hijriYear = momentObj.iYear();
        hijriMonth = hasMonth ? momentObj.iMonth() + 1 : null;
        hijriDay = hasDay ? momentObj.iDate() : null;

        // Validate Hijri values
        if (!isNaN(hijriYear)) {
          if (hasMonth && hasDay && !isNaN(hijriDay) && !isNaN(hijriMonth)) {
            display = `${toArabicNumerals(hijriDay)}/${toArabicNumerals(hijriMonth)}/${toArabicNumerals(hijriYear)} هـ`;
          } else if (hasMonth && !isNaN(hijriMonth)) {
            display = `${toArabicNumerals(hijriMonth)}/${toArabicNumerals(hijriYear)} هـ`;
          } else {
            display = `${toArabicNumerals(hijriYear)} هـ`;
          }
        } else {
          throw new Error("Invalid Hijri conversion");
        }
      } catch (hijriError) {
        // If moment-hijri fails, use our custom converter (only if we have all components)
        if (hasMonth && hasDay) {
          const hijriConverted = gregorianToHijri(
            gregorianYear,
            gregorianMonth,
            gregorianDay,
          );
          if (hijriConverted) {
            hijriYear = hijriConverted.year;
            hijriMonth = hijriConverted.month;
            hijriDay = hijriConverted.day;
            display = `${toArabicNumerals(hijriDay)}/${toArabicNumerals(hijriMonth)}/${toArabicNumerals(hijriYear)} هـ`;
          } else {
            // If all conversions fail, use Gregorian display
            hijriYear = hijriMonth = hijriDay = null;
            if (hasMonth && hasDay) {
              display = `${gregorianDay}/${gregorianMonth}/${gregorianYear}`;
            } else if (hasMonth) {
              display = `${gregorianMonth}/${gregorianYear}`;
            } else {
              display = `${gregorianYear}`;
            }
          }
        } else {
          // For partial dates, just use year
          hijriYear = momentObj.iYear();
          hijriMonth = null;
          hijriDay = null;
          display = `${toArabicNumerals(hijriYear)} هـ`;
        }
      }
    }

    // Return structure compatible with database
    // Using nested structure as primary format
    // Only include month/day if they are present
    const gregorianObj = { year: gregorianYear };
    if (hasMonth) gregorianObj.month = gregorianMonth;
    if (hasDay) gregorianObj.day = gregorianDay;

    const result = {
      gregorian: gregorianObj,
      approximate: approximate || !hasMonth || !hasDay, // Auto-set approximate for partial dates
      display,
    };

    // Add Hijri if available
    if (hijriYear) {
      const hijriObj = { year: hijriYear };
      if (hasMonth && hijriMonth) hijriObj.month = hijriMonth;
      if (hasDay && hijriDay) hijriObj.day = hijriDay;
      result.hijri = hijriObj;
    }

    return result;
  } catch (error) {
    console.error("Error converting to date data:", error);
    return null;
  }
};

/**
 * Parse a date data object to moment
 * Supports both complete dates and partial dates (year-only)
 */
export const fromDateData = (dateData) => {
  if (!dateData) return null;

  try {
    // Prefer Gregorian for internal consistency
    if (dateData.gregorian) {
      const { year, month, day } = dateData.gregorian;

      // Handle partial dates
      if (year && !month && !day) {
        return createFromPartialDate(year, null, null, false);
      } else if (year && month && !day) {
        return createFromPartialDate(year, month, null, false);
      }

      // Complete date
      return createFromGregorian(year, month, day);
    }

    // Fallback to Hijri if Gregorian not available
    if (dateData.hijri) {
      const { year, month, day } = dateData.hijri;

      // Handle partial dates
      if (year && !month && !day) {
        return createFromPartialDate(year, null, null, true);
      } else if (year && month && !day) {
        return createFromPartialDate(year, month, null, true);
      }

      // Complete date
      return createFromHijri(year, month, day);
    }
  } catch (error) {
    return null;
  }

  return null;
};

/**
 * Get month name in Arabic
 */
export const getMonthName = (monthIndex, isHijri = true) => {
  if (monthIndex < 0 || monthIndex > 11) return "";
  return isHijri ? hijriMonths[monthIndex] : gregorianMonthsAr[monthIndex];
};

/**
 * Get weekday names in Arabic
 */
export const getWeekdayNames = (short = false) => {
  return short ? weekdaysShortAr : weekdaysAr;
};

/**
 * Generate calendar days for a given month
 */
export const generateCalendarDays = (year, month, isHijri = true) => {
  if (!year || !month || isNaN(year) || isNaN(month)) {
    return [];
  }

  try {
    let firstDay, daysInMonth, startingDayOfWeek;

    if (isHijri) {
      // Create a Hijri date for the first day of the month
      const currentMonth = moment()
        .iYear(year)
        .iMonth(month - 1)
        .iDate(1);

      if (!currentMonth.isValid()) {
        return [];
      }

      firstDay = currentMonth.clone().startOf("iMonth");
      daysInMonth = currentMonth.iDaysInMonth();
      startingDayOfWeek = firstDay.day();

      // Get previous month days
      const prevMonth = currentMonth.clone().subtract(1, "iMonth");
      const daysInPrevMonth = prevMonth.iDaysInMonth();

      const days = [];

      // Previous month's trailing days
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        days.push({
          day: daysInPrevMonth - i,
          isCurrentMonth: false,
          isPrevMonth: true,
        });
      }

      // Current month's days
      for (let i = 1; i <= daysInMonth; i++) {
        days.push({
          day: i,
          isCurrentMonth: true,
          isPrevMonth: false,
        });
      }

      // Next month's leading days (to fill the grid to 42 cells)
      const remainingCells = 42 - days.length;
      for (let i = 1; i <= remainingCells; i++) {
        days.push({
          day: i,
          isCurrentMonth: false,
          isPrevMonth: false,
        });
      }

      return days;
    } else {
      // Gregorian calendar
      const currentMonth = moment()
        .year(year)
        .month(month - 1)
        .date(1);

      if (!currentMonth.isValid()) {
        return [];
      }

      firstDay = currentMonth.clone().startOf("month");
      daysInMonth = currentMonth.daysInMonth();
      startingDayOfWeek = firstDay.day();

      const prevMonth = currentMonth.clone().subtract(1, "month");
      const daysInPrevMonth = prevMonth.daysInMonth();

      const days = [];

      // Previous month's trailing days
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        days.push({
          day: daysInPrevMonth - i,
          isCurrentMonth: false,
          isPrevMonth: true,
        });
      }

      // Current month's days
      for (let i = 1; i <= daysInMonth; i++) {
        days.push({
          day: i,
          isCurrentMonth: true,
          isPrevMonth: false,
        });
      }

      // Next month's leading days (to fill the grid to 42 cells)
      const remainingCells = 42 - days.length;
      for (let i = 1; i <= remainingCells; i++) {
        days.push({
          day: i,
          isCurrentMonth: false,
          isPrevMonth: false,
        });
      }

      return days;
    }
  } catch (error) {
    return [];
  }
};

/**
 * Validate date constraints
 */
export const validateDates = (birthDate, deathDate) => {
  const errors = { dob: null, dod: null };
  const now = moment();

  if (birthDate) {
    const birth = fromDateData(birthDate);
    if (birth && birth.isAfter(now)) {
      errors.dob = "تاريخ الميلاد لا يمكن أن يكون في المستقبل";
    }
  }

  if (deathDate) {
    const death = fromDateData(deathDate);
    if (death && death.isAfter(now)) {
      errors.dod = "تاريخ الوفاة لا يمكن أن يكون في المستقبل";
    }

    if (birthDate && death) {
      const birth = fromDateData(birthDate);
      if (birth && death.isBefore(birth)) {
        errors.dod = "تاريخ الوفاة يجب أن يكون بعد تاريخ الميلاد";
      }
    }
  }

  return errors;
};

/**
 * Format a single year based on calendar preference
 * Uses mid-year (July 1) approximation for Hijri conversion
 * @param {number|string} year - The Gregorian year to format
 * @param {boolean} isHijri - Whether to convert to Hijri
 * @param {boolean} useArabicNumerals - Whether to use Eastern Arabic numerals
 * @returns {string} Formatted year string
 */
export const formatYear = (year, isHijri = false, useArabicNumerals = false) => {
  // Validate input
  if (!year || year === '') return '';
  const numYear = Number(year);
  if (isNaN(numYear) || numYear < 1000 || numYear > 3000) return '';

  let displayYear = numYear;
  let suffix = '';

  if (isHijri) {
    // Use mid-year (July 1) for better approximation
    // since Gregorian years span two Hijri years
    const hijriDate = gregorianToHijri(numYear, 7, 1);
    if (hijriDate) {
      displayYear = hijriDate.year;
      suffix = ' هـ';
    } else if (numYear < 622) {
      // Pre-Hijri date (before 622 CE)
      suffix = ' م';
    }
  }

  const result = `${displayYear}${suffix}`;
  return useArabicNumerals ? toArabicNumerals(result) : result;
};

/**
 * Utility function for components to format years based on settings
 * This is NOT a hook - safe to use inside loops/conditions
 * @param {number|string} year - The year to format
 * @param {Object} settings - Settings object from useSettings()
 * @returns {string} Formatted year string
 */
export const formatYearBySettings = (year, settings) => {
  const isHijri = settings?.defaultCalendar === 'hijri';
  const useArabic = settings?.arabicNumerals === true;
  return formatYear(year, isHijri, useArabic);
};

// For compatibility with dayjs imports
export default moment;
