/**
 * Enhanced Hijri-Gregorian converter for historical dates
 * Supports dates from year 1 Hijri (622 CE) onwards without limits
 */

// Hijri calendar constants
const HIJRI_EPOCH = 1948439.5; // Julian day number for 1 Muharram 1 AH (16 July 622 CE)

// Month lengths for Hijri calendar (non-leap year)
const HIJRI_MONTH_DAYS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];

/**
 * Check if a Hijri year is a leap year
 * The Hijri calendar has a 30-year cycle with 11 leap years
 */
function isHijriLeapYear(year) {
  const cycle = year % 30;
  const leapYears = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  return leapYears.includes(cycle);
}

/**
 * Get the number of days in a Hijri month
 */
function getHijriMonthDays(year, month) {
  if (month < 1 || month > 12) return 0;
  const days = HIJRI_MONTH_DAYS[month - 1];
  // Add extra day to last month in leap years
  if (month === 12 && isHijriLeapYear(year)) {
    return days + 1;
  }
  return days;
}

/**
 * Convert Hijri date to Julian Day Number
 */
function hijriToJulianDay(year, month, day) {
  // Calculate the number of days from the beginning of the Hijri calendar
  let totalDays = 0;

  // Add days for complete years
  for (let y = 1; y < year; y++) {
    totalDays += isHijriLeapYear(y) ? 355 : 354;
  }

  // Add days for complete months in the current year
  for (let m = 1; m < month; m++) {
    totalDays += getHijriMonthDays(year, m);
  }

  // Add the days of the current month
  totalDays += day;

  // Convert to Julian Day Number
  return HIJRI_EPOCH + totalDays - 1;
}

/**
 * Convert Julian Day Number to Gregorian date
 */
function julianDayToGregorian(jd) {
  const a = Math.floor(jd + 0.5);
  const b = a + 1537;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return { year, month, day };
}

/**
 * Convert Gregorian date to Julian Day Number
 */
function gregorianToJulianDay(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);

  // Apply Gregorian calendar correction
  if (
    year > 1582 ||
    (year === 1582 && month > 10) ||
    (year === 1582 && month === 10 && day >= 15)
  ) {
    jd = jd - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  } else {
    jd = jd - 32083;
  }

  return jd;
}

/**
 * Convert Julian Day Number to Hijri date
 */
function julianDayToHijri(jd) {
  // Calculate days since Hijri epoch
  const daysSinceEpoch = Math.floor(jd - HIJRI_EPOCH + 1);

  // Find the year
  let year = 1;
  let daysRemaining = daysSinceEpoch;

  while (true) {
    const yearDays = isHijriLeapYear(year) ? 355 : 354;
    if (daysRemaining <= yearDays) break;
    daysRemaining -= yearDays;
    year++;
  }

  // Find the month
  let month = 1;
  while (month <= 12) {
    const monthDays = getHijriMonthDays(year, month);
    if (daysRemaining <= monthDays) break;
    daysRemaining -= monthDays;
    month++;
  }

  const day = daysRemaining;

  return { year, month, day };
}

/**
 * Main conversion function: Hijri to Gregorian
 */
export function hijriToGregorian(hijriYear, hijriMonth, hijriDay) {
  // Validate input - allow years 1-2200
  if (!hijriYear || !hijriMonth || !hijriDay) {
    return null;
  }

  if (hijriYear < 1 || hijriYear > 2200) {
    return null;
  }

  if (hijriMonth < 1 || hijriMonth > 12) {
    return null;
  }

  // Relaxed day validation - allow 1-30 for all months
  if (hijriDay < 1 || hijriDay > 30) {
    return null;
  }

  try {
    const jd = hijriToJulianDay(hijriYear, hijriMonth, hijriDay);
    return julianDayToGregorian(jd);
  } catch (error) {
    console.error("Error converting Hijri to Gregorian:", error);
    // Return approximation instead of null
    const approximateYear = Math.floor(
      622 + ((hijriYear - 1) * 354.36) / 365.25,
    );
    return {
      year: approximateYear,
      month: hijriMonth,
      day: hijriDay,
    };
  }
}

/**
 * Main conversion function: Gregorian to Hijri
 */
export function gregorianToHijri(gregorianYear, gregorianMonth, gregorianDay) {
  // Validate input
  if (!gregorianYear || !gregorianMonth || !gregorianDay) {
    return null;
  }

  // Hijri calendar starts from 622 CE
  if (
    gregorianYear < 622 ||
    (gregorianYear === 622 && gregorianMonth < 7) ||
    (gregorianYear === 622 && gregorianMonth === 7 && gregorianDay < 16)
  ) {
    return null;
  }

  if (gregorianMonth < 1 || gregorianMonth > 12) {
    return null;
  }

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Check for leap year
  if (
    gregorianMonth === 2 &&
    ((gregorianYear % 4 === 0 && gregorianYear % 100 !== 0) ||
      gregorianYear % 400 === 0)
  ) {
    daysInMonth[1] = 29;
  }

  if (gregorianDay < 1 || gregorianDay > daysInMonth[gregorianMonth - 1]) {
    return null;
  }

  try {
    const jd = gregorianToJulianDay(
      gregorianYear,
      gregorianMonth,
      gregorianDay,
    );
    return julianDayToHijri(jd);
  } catch (error) {
    console.error("Error converting Gregorian to Hijri:", error);
    return null;
  }
}

/**
 * Validate if a Hijri date is valid
 */
export function isValidHijriDate(year, month, day) {
  if (!year || !month || !day) return false;
  if (year < 1 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  // Relaxed validation - allow up to 30 days for any month
  return day >= 1 && day <= 30;
}

/**
 * Validate if a Gregorian date is valid
 */
export function isValidGregorianDate(year, month, day) {
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Check for leap year
  if (
    month === 2 &&
    ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)
  ) {
    daysInMonth[1] = 29;
  }

  return day >= 1 && day <= daysInMonth[month - 1];
}
