import {
  gregorianToHijri,
  hijriToGregorian,
} from "../src/utils/hijriConverter.js";
import { formatDateByPreference } from "../src/utils/dateDisplay.js";

console.log("=== Testing Hijri Conversion System ===\n");

// Test 1: Basic Gregorian to Hijri conversion
console.log("Test 1: Gregorian to Hijri conversion");
const hijriDate = gregorianToHijri(2024, 3, 15);
console.log("Input: 15/03/2024");
console.log("Output:", hijriDate);
console.log("Expected: ~5/9/1445\n");

// Test 2: Hijri to Gregorian conversion
console.log("Test 2: Hijri to Gregorian conversion");
const gregorianDate = hijriToGregorian(1445, 9, 5);
console.log("Input: 5/9/1445");
console.log("Output:", gregorianDate);
console.log("Expected: ~15/03/2024\n");

// Test 3: formatDateByPreference with Hijri preference
console.log("Test 3: Format with Hijri preference");
const sampleDate1 = {
  gregorian: { day: 15, month: 3, year: 2024 },
  hijri: { day: 5, month: 9, year: 1445 },
};

const hijriSettings = {
  defaultCalendar: "hijri",
  dateFormat: "numeric",
  showBothCalendars: false,
  arabicNumerals: false,
};

const hijriFormatted = formatDateByPreference(sampleDate1, hijriSettings);
console.log("Input date object:", JSON.stringify(sampleDate1, null, 2));
console.log("Settings:", JSON.stringify(hijriSettings, null, 2));
console.log("Output:", hijriFormatted);
console.log("Expected: 05/09/1445 هـ\n");

// Test 4: formatDateByPreference with Gregorian preference
console.log("Test 4: Format with Gregorian preference");
const gregorianSettings = {
  defaultCalendar: "gregorian",
  dateFormat: "numeric",
  showBothCalendars: false,
  arabicNumerals: false,
};

const gregorianFormatted = formatDateByPreference(
  sampleDate1,
  gregorianSettings,
);
console.log("Settings:", JSON.stringify(gregorianSettings, null, 2));
console.log("Output:", gregorianFormatted);
console.log("Expected: 15/03/2024\n");

// Test 5: Format with words
console.log("Test 5: Format with words (Hijri)");
const hijriWordsSettings = {
  defaultCalendar: "hijri",
  dateFormat: "words",
  showBothCalendars: false,
  arabicNumerals: false,
};

const hijriWords = formatDateByPreference(sampleDate1, hijriWordsSettings);
console.log("Settings:", JSON.stringify(hijriWordsSettings, null, 2));
console.log("Output:", hijriWords);
console.log("Expected: 5 رمضان 1445 هـ\n");

// Test 6: Show both calendars
console.log("Test 6: Show both calendars");
const bothSettings = {
  defaultCalendar: "hijri",
  dateFormat: "numeric",
  showBothCalendars: true,
  arabicNumerals: false,
};

const bothFormatted = formatDateByPreference(sampleDate1, bothSettings);
console.log("Settings:", JSON.stringify(bothSettings, null, 2));
console.log("Output:", bothFormatted);
console.log("Expected: 05/09/1445 هـ (15/03/2024)\n");

// Test 7: Test with different date structure (as might come from database)
console.log("Test 7: Database date structure");
const dbDate = {
  day: 15,
  month: 3,
  year: 2024,
  hijri_day: 5,
  hijri_month: 9,
  hijri_year: 1445,
};

const dbHijriFormatted = formatDateByPreference(dbDate, hijriSettings);
console.log("Input (DB structure):", JSON.stringify(dbDate, null, 2));
console.log("Output with Hijri preference:", dbHijriFormatted);
console.log("Expected: 05/09/1445 هـ\n");

// Test 8: Edge case - missing Hijri data
console.log("Test 8: Missing Hijri data");
const incompleteDate = {
  gregorian: { day: 15, month: 3, year: 2024 },
  // No hijri field
};

const incompleteFormatted = formatDateByPreference(
  incompleteDate,
  hijriSettings,
);
console.log("Input (no Hijri):", JSON.stringify(incompleteDate, null, 2));
console.log("Output with Hijri preference:", incompleteFormatted);
console.log("Expected: fallback to Gregorian or empty\n");

console.log("=== Testing Complete ===");
