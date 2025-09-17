// Test Arabic numerals issue
console.log("=== Testing Arabic Numerals Issue ===\n");

// Mock the toArabicNumerals function
const toArabicNumerals = (str) => {
  if (!str) {
    console.log("ERROR: toArabicNumerals received null/undefined");
    return "";
  }
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(str).replace(
    /[0-9]/g,
    (digit) => arabicNumbers[parseInt(digit)],
  );
};

// Test 1: Basic conversion
console.log("Test 1: Basic Arabic numeral conversion");
const test1 = "15/03/2024";
const result1 = toArabicNumerals(test1);
console.log(`Input: ${test1}`);
console.log(`Output: ${result1}`);
console.log(`Expected: ١٥/٠٣/٢٠٢٤\n`);

// Test 2: With Hijri indicator
console.log("Test 2: With Hijri indicator");
const test2 = "05/09/1445 هـ";
const result2 = toArabicNumerals(test2);
console.log(`Input: ${test2}`);
console.log(`Output: ${result2}`);
console.log(`Expected: ٠٥/٠٩/١٤٤٥ هـ\n`);

// Test 3: Words format
console.log("Test 3: Words format with numbers");
const test3 = "15 مارس 2024";
const result3 = toArabicNumerals(test3);
console.log(`Input: ${test3}`);
console.log(`Output: ${result3}`);
console.log(`Expected: ١٥ مارس ٢٠٢٤\n`);

// Test 4: What happens with undefined
console.log("Test 4: Undefined input");
const result4 = toArabicNumerals(undefined);
console.log(`Input: undefined`);
console.log(`Output: "${result4}"`);
console.log(`Expected: empty string\n`);

// Test 5: Simulate the full formatDate flow
console.log("Test 5: Full formatDate flow with Arabic numerals");

function formatDate(day, month, year, type = "gregorian", settings = {}) {
  if (!day || !month || !year) {
    console.log("  Missing date parts:", { day, month, year });
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

    if (arabicNumerals) {
      console.log(`  Before Arabic conversion: "${result}"`);
      result = toArabicNumerals(result);
      console.log(`  After Arabic conversion: "${result}"`);
    }

    return result;
  }

  return `${day}/${month}/${year}`;
}

// Test with Hijri date and Arabic numerals
const hijriResult = formatDate(5, 9, 1445, "hijri", {
  dateFormat: "numeric",
  arabicNumerals: true,
});
console.log(`Final result: "${hijriResult}"`);
console.log(`Expected: "٠٥/٠٩/١٤٤٥ هـ"\n`);

// Test with Gregorian date and Arabic numerals
const gregResult = formatDate(15, 3, 2024, "gregorian", {
  dateFormat: "numeric",
  arabicNumerals: true,
});
console.log(`Final result: "${gregResult}"`);
console.log(`Expected: "١٥/٠٣/٢٠٢٤"`);
