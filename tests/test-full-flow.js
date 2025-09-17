// Test the full flow from settings to display
console.log("=== Testing Full Date Flow ===\n");

// 1. Simulate the sampleDate creation in SettingsModal
const gregorianToHijri = (year, month, day) => {
  // Simplified conversion - returns correct structure
  return { year: 1445, month: 9, day: 5 };
};

const sampleGregorian = { day: 15, month: 3, year: 2024 };
const sampleHijri = gregorianToHijri(2024, 3, 15);

const sampleDate = {
  gregorian: sampleGregorian,
  hijri: sampleHijri || { day: 5, month: 9, year: 1445 },
};

console.log("1. Sample date structure:");
console.log(JSON.stringify(sampleDate, null, 2));

// 2. Simulate settings when user clicks "Hijri"
const hijriSettings = {
  defaultCalendar: "hijri",
  dateFormat: "numeric",
  showBothCalendars: false,
  arabicNumerals: false,
};

console.log("\n2. Settings when Hijri selected:");
console.log(JSON.stringify(hijriSettings, null, 2));

// 3. Simulate formatDateByPreference
function formatDateByPreference(dateData, settings = {}) {
  if (!dateData) return "";

  const finalSettings = {
    defaultCalendar: "gregorian",
    dateFormat: "numeric",
    showBothCalendars: false,
    arabicNumerals: false,
    ...settings,
  };

  console.log("\n3. Final settings after merge:");
  console.log(JSON.stringify(finalSettings, null, 2));

  const preference = finalSettings.defaultCalendar;
  let primaryDate = "";

  // Format primary calendar
  if (preference === "hijri") {
    console.log("\n4. Preference is hijri, checking for hijri data...");

    // Check for hijri data (nested structure)
    if (
      dateData.hijri &&
      dateData.hijri.day &&
      dateData.hijri.month &&
      dateData.hijri.year
    ) {
      console.log("   Found hijri data:", dateData.hijri);

      // Simplified formatDate
      const d = dateData.hijri.day.toString().padStart(2, "0");
      const m = dateData.hijri.month.toString().padStart(2, "0");
      const y = dateData.hijri.year.toString();
      primaryDate = `${d}/${m}/${y} هـ`;

      console.log("   Formatted:", primaryDate);
    } else {
      console.log("   No hijri data found!");
    }
  } else {
    console.log("\n4. Preference is gregorian");
    if (dateData.gregorian && dateData.gregorian.day) {
      const d = dateData.gregorian.day.toString().padStart(2, "0");
      const m = dateData.gregorian.month.toString().padStart(2, "0");
      const y = dateData.gregorian.year.toString();
      primaryDate = `${d}/${m}/${y}`;
    }
  }

  return primaryDate || dateData.display || "";
}

// Test the full flow
console.log("\n=== Testing with Hijri Settings ===");
const result = formatDateByPreference(sampleDate, hijriSettings);
console.log("\nFinal result:", result);
console.log("Expected: 05/09/1445 هـ");

// Test with Gregorian settings
console.log("\n=== Testing with Gregorian Settings ===");
const gregSettings = {
  defaultCalendar: "gregorian",
  dateFormat: "numeric",
  showBothCalendars: false,
  arabicNumerals: false,
};

const gregResult = formatDateByPreference(sampleDate, gregSettings);
console.log("\nFinal result:", gregResult);
console.log("Expected: 15/03/2024");
