// Test the formatDate function directly
console.log("Testing formatDate function directly:\n");

// Mock formatDate based on our implementation
function formatDate(day, month, year, type = "gregorian", settings = {}) {
  if (!day || !month || !year) {
    console.log("Missing date parts:", { day, month, year });
    return "";
  }

  const { dateFormat = "numeric", arabicNumerals = false } = settings;

  if (dateFormat === "numeric") {
    const dayStr = day.toString().padStart(2, "0");
    const monthStr = month.toString().padStart(2, "0");
    const yearStr = year.toString();

    let result = `${dayStr}/${monthStr}/${yearStr}`;

    if (type === "hijri") {
      result += " هـ";
    }

    if (arabicNumerals && type === "hijri") {
      // Convert to Arabic numerals
      const arabicMap = {
        0: "٠",
        1: "١",
        2: "٢",
        3: "٣",
        4: "٤",
        5: "٥",
        6: "٦",
        7: "٧",
        8: "٨",
        9: "٩",
      };
      result = result.replace(/[0-9]/g, (d) => arabicMap[d]);
    }

    return result;
  }

  return `${day}/${month}/${year}`;
}

// Test 1: Hijri date formatting
const hijriResult = formatDate(5, 9, 1445, "hijri", {
  dateFormat: "numeric",
  arabicNumerals: false,
});
console.log("Hijri formatting (5/9/1445):", hijriResult);
console.log("Expected: 05/09/1445 هـ\n");

// Test 2: Gregorian date formatting
const gregResult = formatDate(15, 3, 2024, "gregorian", {
  dateFormat: "numeric",
  arabicNumerals: false,
});
console.log("Gregorian formatting (15/3/2024):", gregResult);
console.log("Expected: 15/03/2024\n");

// Test 3: With Arabic numerals
const hijriArabic = formatDate(5, 9, 1445, "hijri", {
  dateFormat: "numeric",
  arabicNumerals: true,
});
console.log("Hijri with Arabic numerals:", hijriArabic);
console.log("Expected: ٠٥/٠٩/١٤٤٥ هـ\n");

// Test 4: Missing data
const missingResult = formatDate(null, 9, 1445, "hijri", {
  dateFormat: "numeric",
});
console.log("With missing day:", missingResult);
console.log("Expected: (empty string)");
