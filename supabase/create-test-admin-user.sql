-- Create test admin user profile
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- IMPORTANT: First create the user in Supabase Auth Dashboard:
-- Go to Authentication > Users and create:
-- Email: admin@test.com
-- Password: testadmin123

-- Then run this SQL to create the admin profile:

-- Get the user ID from auth.users
DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user ID for admin@test.com
    SELECT id INTO user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User admin@test.com not found in auth.users. Please create the user first in Supabase Auth.';
    END IF;
    
    -- Insert or update the profile
    INSERT INTO profiles (
        id,
        hid,
        name,
        email,
        gender,
        generation,
        role,
        sibling_order
    ) VALUES (
        user_id,
        'R999999',  -- Special HID for test admin
        'Test Admin',
        'admin@test.com',
        'male',
        1,
        'admin',
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        email = 'admin@test.com',
        name = COALESCE(profiles.name, 'Test Admin');
    
    -- Handle HID conflict if R999999 is already taken
    EXCEPTION
        WHEN unique_violation THEN
            -- Try with a different HID
            INSERT INTO profiles (
                id,
                hid,
                name,
                email,
                gender,
                generation,
                role,
                sibling_order
            ) VALUES (
                user_id,
                'R999998',  -- Alternative HID
                'Test Admin',
                'admin@test.com',
                'male',
                1,
                'admin',
                0
            )
            ON CONFLICT (id) DO UPDATE SET
                role = 'admin',
                email = 'admin@test.com',
                name = COALESCE(profiles.name, 'Test Admin');
    
    RAISE NOTICE 'Admin profile created/updated successfully for user ID: %', user_id;
END $$;

-- Verify the admin profile was created
SELECT id, hid, name, email, role, generation 
FROM profiles 
WHERE email = 'admin@test.com';