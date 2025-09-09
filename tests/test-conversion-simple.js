// Simple test to check conversion output
const gregorianToHijri = (year, month, day) => {
  // Mock implementation to test
  return { year: 1445, month: 9, day: 5 };
};

const result = gregorianToHijri(2024, 3, 15);
console.log("Conversion result:", result);
console.log("Has year?", result.year);
console.log("Has month?", result.month);
console.log("Has day?", result.day);

// Now test how it would be used
const sampleDate = {
  gregorian: { day: 15, month: 3, year: 2024 },
  hijri: result || { day: 5, month: 9, year: 1445 },
};

console.log("\nSample date structure:");
console.log(JSON.stringify(sampleDate, null, 2));

// Check accessing nested properties
console.log("\nAccessing hijri.day:", sampleDate.hijri.day);
console.log("Accessing hijri.month:", sampleDate.hijri.month);
console.log("Accessing hijri.year:", sampleDate.hijri.year);
