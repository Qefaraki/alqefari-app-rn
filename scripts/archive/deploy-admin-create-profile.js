#!/usr/bin/env node

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Drop if exists and recreate admin_create_profile
DROP FUNCTION IF EXISTS admin_create_profile CASCADE;

CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name text,
    p_gender text,
    p_father_id uuid DEFAULT NULL,
    p_mother_id uuid DEFAULT NULL,
    p_generation integer DEFAULT NULL,
    p_sibling_order integer DEFAULT 1,
    p_kunya text DEFAULT NULL,
    p_nickname text DEFAULT NULL,
    p_status text DEFAULT 'alive',
    p_dob_data jsonb DEFAULT NULL,
    p_bio text DEFAULT NULL,
    p_birth_place text DEFAULT NULL,
    p_current_residence text DEFAULT NULL,
    p_occupation text DEFAULT NULL,
    p_education text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_photo_url text DEFAULT NULL,
    p_social_media_links jsonb DEFAULT '{}',
    p_achievements text DEFAULT NULL,
    p_timeline jsonb DEFAULT NULL,
    p_dob_is_public boolean DEFAULT true,
    p_profile_visibility text DEFAULT 'public'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_profile profiles;
    v_calculated_generation integer;
    v_parent_generation integer;
    v_existing_sibling_order integer;
BEGIN
    -- Validate required fields
    IF p_name IS NULL OR p_name = '' THEN
        RAISE EXCEPTION 'Name is required';
    END IF;

    IF p_gender NOT IN ('male', 'female', 'other') THEN
        RAISE EXCEPTION 'Invalid gender value';
    END IF;

    -- Calculate generation if not provided
    IF p_generation IS NULL THEN
        -- Get parent generation
        IF p_father_id IS NOT NULL THEN
            SELECT generation INTO v_parent_generation FROM profiles WHERE id = p_father_id;
        ELSIF p_mother_id IS NOT NULL THEN
            SELECT generation INTO v_parent_generation FROM profiles WHERE id = p_mother_id;
        END IF;

        IF v_parent_generation IS NOT NULL THEN
            v_calculated_generation := v_parent_generation + 1;
        ELSE
            v_calculated_generation := 1; -- Default if no parent
        END IF;
    ELSE
        v_calculated_generation := p_generation;
    END IF;

    -- Check if sibling order already exists and adjust if needed
    SELECT MAX(sibling_order) + 1 
    INTO v_existing_sibling_order
    FROM profiles 
    WHERE (father_id = p_father_id OR mother_id = p_mother_id)
    AND id != v_new_profile.id;

    IF v_existing_sibling_order IS NOT NULL AND v_existing_sibling_order > p_sibling_order THEN
        p_sibling_order := v_existing_sibling_order;
    END IF;

    -- Insert the profile
    INSERT INTO profiles (
        name,
        arabic_name,
        gender,
        father_id,
        mother_id,
        generation,
        sibling_order,
        kunya,
        nickname,
        status,
        dob_data,
        bio,
        birth_place,
        current_residence,
        occupation,
        education,
        phone,
        email,
        photo_url,
        social_media_links,
        achievements,
        timeline,
        dob_is_public,
        profile_visibility,
        created_at,
        updated_at
    ) VALUES (
        p_name,
        p_name, -- Use same for arabic_name
        p_gender::gender_type,
        p_father_id,
        p_mother_id,
        v_calculated_generation,
        p_sibling_order,
        p_kunya,
        p_nickname,
        CASE 
            WHEN p_status = 'deceased' THEN 'deceased'::life_status
            ELSE 'alive'::life_status
        END,
        p_dob_data,
        p_bio,
        p_birth_place,
        p_current_residence,
        p_occupation,
        p_education,
        p_phone,
        p_email,
        p_photo_url,
        p_social_media_links,
        p_achievements,
        p_timeline,
        p_dob_is_public,
        CASE 
            WHEN p_profile_visibility IN ('public', 'private', 'family_only') 
            THEN p_profile_visibility::visibility_type
            ELSE 'public'::visibility_type
        END,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_new_profile;

    -- Log the action
    INSERT INTO audit_logs (table_name, action, record_id, old_data, new_data, metadata)
    VALUES (
        'profiles', 'insert', v_new_profile.id,
        NULL, to_jsonb(v_new_profile), 
        jsonb_build_object(
            'source', 'admin_create_profile',
            'admin_id', auth.uid()
        )
    );

    RETURN jsonb_build_object(
        'id', v_new_profile.id,
        'name', v_new_profile.name,
        'gender', v_new_profile.gender,
        'generation', v_new_profile.generation
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_create_profile TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_create_profile IS 'Admin function to create profiles with validation and auto-generation calculation';
`;

async function deployFunction() {
  console.log("Deploying admin_create_profile function...");

  try {
    const { error } = await supabase.rpc("execute_sql", {
      query: sql,
    });

    if (error) {
      // Try direct query if execute_sql doesn't exist
      const { error: directError } = await supabase
        .from("_migrations")
        .select("*")
        .limit(0);

      if (!directError) {
        console.error(
          "Cannot deploy function. Please run this SQL in Supabase Dashboard:",
        );
        console.log("\n" + sql);
        return;
      }

      throw error;
    }

    console.log("✅ Function deployed successfully!");

    // Test the function
    console.log("\nTesting function existence...");
    const { data: testData, error: testError } = await supabase.rpc(
      "admin_create_profile",
      {
        p_name: "TEST_DELETE_ME",
        p_gender: "male",
      },
    );

    if (testError) {
      console.log("⚠️ Function exists but test failed:", testError.message);
      if (testError.message.includes("permission denied")) {
        console.log("This is expected if you're not authenticated as admin.");
      }
    } else {
      console.log("✅ Function is working!");
      // Clean up test data if created
      if (testData?.id) {
        await supabase.from("profiles").delete().eq("id", testData.id);
      }
    }
  } catch (err) {
    console.error("Error deploying function:", err.message);
    console.log("\nPlease run this SQL manually in Supabase Dashboard:");
    console.log("\n" + sql);
  }
}

deployFunction();
