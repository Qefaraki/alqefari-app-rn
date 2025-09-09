import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Execute the SQL to update get_branch_data function
    const sql = `
      CREATE OR REPLACE FUNCTION get_branch_data(
        p_hid TEXT,
        p_max_depth INT DEFAULT 3,
        p_limit INT DEFAULT 100
      )
      RETURNS TABLE (
        id UUID,
        hid TEXT,
        name TEXT,
        father_id UUID,
        mother_id UUID,
        generation INT,
        sibling_order INT,
        gender TEXT,
        photo_url TEXT,
        status TEXT,
        current_residence TEXT,
        occupation TEXT,
        layout_position JSONB,
        descendants_count INT,
        has_more_descendants BOOLEAN,
        dob_data JSONB,
        dod_data JSONB,
        bio TEXT,
        birth_place TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          p.id,
          p.hid,
          p.name,
          p.father_id,
          p.mother_id,
          p.generation,
          p.sibling_order,
          p.gender,
          p.photo_url,
          p.status,
          p.current_residence,
          p.occupation,
          p.layout_position,
          0::INT as descendants_count,
          false as has_more_descendants,
          p.dob_data,
          p.dod_data,
          p.bio,
          p.birth_place
        FROM profiles p
        WHERE (p_hid IS NULL AND p.generation = 1) OR (p_hid IS NOT NULL AND p.hid = p_hid)
        LIMIT COALESCE(p_limit, 100);
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    `;

    // Execute as raw query
    const { data, error } = await supabase.rpc("query", { query_text: sql });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Function updated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
