import moment from "moment-hijri";

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
export const toArabicNumerals = (num) => {
  // Handle null, undefined, or NaN
  if (num === null || num === undefined || isNaN(num)) {
    return "";
  }
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).replace(
    /[0-9]/g,
    (digit) => arabicNumbers[parseInt(digit)],
  );
};

/**
 * Create a date object from Hijri components
 */
export const createFromHijri = (year, month, day) => {
  // Validate inputs
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  try {
    // moment-hijri expects format: iYYYY/iM/iD
    const hijriDateString = `${year}/${month}/${day}`;
    const m = moment(hijriDateString, "iYYYY/iM/iD");

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
 * Convert a moment object to our JSONB structure
 */
export const toDateData = (momentObj, approximate = false) => {
  if (!momentObj || !momentObj.isValid()) {
    return null;
  }

  try {
    // Get Gregorian values
    const gregorian = {
      year: momentObj.year(),
      month: momentObj.month() + 1,
      day: momentObj.date(),
    };

    // Get Hijri values with error handling
    let hijri;
    let display;

    try {
      const hijriYear = momentObj.iYear();
      const hijriMonth = momentObj.iMonth() + 1;
      const hijriDay = momentObj.iDate();

      // Validate Hijri values
      if (!isNaN(hijriDay) && !isNaN(hijriMonth) && !isNaN(hijriYear)) {
        hijri = {
          year: hijriYear,
          month: hijriMonth,
          day: hijriDay,
        };

        // Format display string (Hijri)
        display = `${toArabicNumerals(hijri.day)}/${toArabicNumerals(hijri.month)}/${toArabicNumerals(hijri.year)} هـ`;
      } else {
        // If Hijri conversion fails, use Gregorian display
        hijri = null;
        display = `${gregorian.day}/${gregorian.month}/${gregorian.year}`;
      }
    } catch (hijriError) {
      // If Hijri conversion throws an error, use Gregorian display
      hijri = null;
      display = `${gregorian.day}/${gregorian.month}/${gregorian.year}`;
    }

    return {
      gregorian,
      hijri,
      approximate,
      display,
    };
  } catch (error) {
    return null;
  }
};

/**
 * Parse a date data object to moment
 */
export const fromDateData = (dateData) => {
  if (!dateData) return null;

  try {
    // Prefer Gregorian for internal consistency
    if (dateData.gregorian) {
      return createFromGregorian(
        dateData.gregorian.year,
        dateData.gregorian.month,
        dateData.gregorian.day,
      );
    }

    // Fallback to Hijri if Gregorian not available
    if (dateData.hijri) {
      return createFromHijri(
        dateData.hijri.year,
        dateData.hijri.month,
        dateData.hijri.day,
      );
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

// For compatibility with dayjs imports
export default moment;
