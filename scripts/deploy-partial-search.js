require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

async function deployPartialSearch() {
  try {
    console.log("🔍 Deploying improved partial matching search...");
    console.log(
      "Please run the following SQL in Supabase Dashboard SQL Editor:\n",
    );

    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "fix-search-partial-matching.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("--- COPY THIS SQL ---\n");
    console.log(sql);
    console.log("\n--- END SQL ---");

    console.log("\n📋 Instructions:");
    console.log("1. Go to your Supabase Dashboard");
    console.log("2. Navigate to SQL Editor");
    console.log("3. Paste the SQL above");
    console.log('4. Click "Run"');
    console.log("\nThis will enable partial matching in search, so:");
    console.log('  - "محمد عب" will match "محمد عبدالله"');
    console.log('  - "عبد" will match all names starting with عبد');
    console.log("  - Search becomes much more forgiving!");
  } catch (err) {
    console.error("Error reading SQL file:", err);
    process.exit(1);
  }
}

deployPartialSearch();
