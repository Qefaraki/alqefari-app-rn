import dayjs from "dayjs";
import calendarSystems from "@calidy/dayjs-calendarsystems";

// Extend dayjs with calendar systems plugin for Hijri support
dayjs.extend(calendarSystems);

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
  return dayjs()
    .toCalendarSystem("islamic-civil")
    .year(year)
    .month(month - 1)
    .date(day);
};

/**
 * Create a date object from Gregorian components
 */
export const createFromGregorian = (year, month, day) => {
  return dayjs()
    .year(year)
    .month(month - 1)
    .date(day);
};

/**
 * Convert a dayjs object to our JSONB structure
 */
export const toDateData = (dayjsObj, approximate = false) => {
  if (!dayjsObj || !dayjsObj.isValid()) {
    return null;
  }

  // Get Gregorian values
  const gregorian = {
    year: dayjsObj.year(),
    month: dayjsObj.month() + 1,
    day: dayjsObj.date(),
  };

  // Get Hijri values
  const hijriObj = dayjsObj.toCalendarSystem("islamic-civil");
  const hijri = {
    year: hijriObj.year(),
    month: hijriObj.month() + 1,
    day: hijriObj.date(),
  };

  // Format display string (Hijri by default)
  const display = `${toArabicNumerals(hijri.day)}/${toArabicNumerals(hijri.month)}/${toArabicNumerals(hijri.year)} هـ`;

  return {
    gregorian,
    hijri,
    approximate,
    display,
  };
};

/**
 * Parse a date data object to dayjs
 */
export const fromDateData = (dateData) => {
  if (!dateData) return null;

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

  return null;
};

/**
 * Get month name in Arabic
 */
export const getMonthName = (monthIndex, isHijri = true) => {
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
  let firstDay, daysInMonth, daysInPrevMonth, startingDayOfWeek;

  if (isHijri) {
    const currentMonth = dayjs()
      .toCalendarSystem("islamic-civil")
      .year(year)
      .month(month - 1);
    firstDay = currentMonth.startOf("month");
    daysInMonth = currentMonth.daysInMonth();
    startingDayOfWeek = firstDay.day();

    const prevMonth = currentMonth.subtract(1, "month");
    daysInPrevMonth = prevMonth.daysInMonth();
  } else {
    const currentMonth = dayjs()
      .year(year)
      .month(month - 1);
    firstDay = currentMonth.startOf("month");
    daysInMonth = currentMonth.daysInMonth();
    startingDayOfWeek = firstDay.day();

    const prevMonth = currentMonth.subtract(1, "month");
    daysInPrevMonth = prevMonth.daysInMonth();
  }

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
};

/**
 * Validate date constraints
 */
export const validateDates = (birthDate, deathDate) => {
  const errors = { dob: null, dod: null };
  const now = dayjs();

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

export default dayjs;
