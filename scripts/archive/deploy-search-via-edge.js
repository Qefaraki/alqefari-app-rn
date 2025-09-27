const https = require("https");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// SQL to deploy
const sql = `
-- Create normalize_arabic function
CREATE OR REPLACE FUNCTION normalize_arabic(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            input_text,
            '[ً-ْ؟]', '', 'g'
          ),
          '[أإآ]', 'ا', 'g'
        ),
        '[ىي]', 'ي', 'g'
      ),
      '\\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create search function
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INT,
  photo_url TEXT,
  birth_year_hijri INT,
  death_year_hijri INT,
  match_score FLOAT,
  match_depth INT,
  father_name TEXT,
  grandfather_name TEXT
) AS $$
DECLARE
  v_normalized_names TEXT[];
BEGIN
  SELECT array_agg(normalize_arabic(unnest))
  INTO v_normalized_names
  FROM unnest(p_names);
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    SELECT 
      p.id,
      p.hid,
      p.name,
      p.father_id,
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      p.birth_year_hijri,
      p.death_year_hijri
    FROM profiles p
    WHERE p.deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' بن ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    SELECT DISTINCT ON (a.id)
      a.id,
      a.hid,
      a.name,
      a.current_chain as name_chain,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      (
        SELECT COUNT(*)::FLOAT / array_length(v_normalized_names, 1)::FLOAT
        FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(a.name_array)
      ) as match_score,
      array_length(a.name_array, 1) as match_depth,
      CASE WHEN array_length(a.display_names, 1) >= 2 
        THEN a.display_names[2] 
        ELSE NULL 
      END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3 
        THEN a.display_names[3] 
        ELSE NULL 
      END as grandfather_name,
      (v_normalized_names <@ a.name_array) as has_all_names
    FROM ancestry a
    WHERE 
      EXISTS (
        SELECT 1 FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(a.name_array)
      )
    ORDER BY a.id, a.depth DESC
  )
  SELECT 
    m.id,
    m.hid,
    m.name,
    m.name_chain,
    m.generation,
    m.photo_url,
    m.birth_year_hijri,
    m.death_year_hijri,
    m.match_score,
    m.match_depth,
    m.father_name,
    m.grandfather_name
  FROM matches m
  WHERE m.has_all_names
  ORDER BY 
    m.match_score DESC,
    m.generation DESC,
    m.match_depth ASC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain TO anon, authenticated;
GRANT EXECUTE ON FUNCTION normalize_arabic TO anon, authenticated;

-- Create index
CREATE INDEX IF NOT EXISTS idx_profiles_father_id 
  ON profiles(father_id) 
  WHERE deleted_at IS NULL;
`;

console.log("🔍 Deploying search function via Edge Function...\n");

// Call the edge function to execute SQL
const url = new URL(`${supabaseUrl}/functions/v1/execute-sql`);

const postData = JSON.stringify({ sql });

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    Authorization: `Bearer ${supabaseKey}`,
    apikey: supabaseKey,
  },
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Response status:", res.statusCode);

    if (res.statusCode === 200) {
      console.log("✅ Search function deployed successfully!");
    } else {
      console.log("❌ Deployment failed");
      console.log("Response:", data);
      console.log(
        "\nYou may need to manually deploy the SQL in Supabase dashboard:",
      );
      console.log("  supabase/migrations/036_create_name_chain_search.sql");
    }
  });
});

req.on("error", (error) => {
  console.error("Request error:", error);
});

req.write(postData);
req.end();
