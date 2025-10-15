-- Fix unique constraint on profile_link_requests table
--
-- Root cause: Migration 20251015500000 created a 3-column unique constraint
-- (user_id, profile_id, status) but the code expects a 2-column constraint
-- (user_id, profile_id) for the upsert operation.
--
-- The code does: .upsert({ data }, { onConflict: "user_id,profile_id" })
-- PostgreSQL error 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Original design (archived migration 038_phone_auth_system.sql):
-- UNIQUE(user_id, profile_id) -- Just 2 columns

-- Drop the incorrect 3-column constraint
ALTER TABLE profile_link_requests
DROP CONSTRAINT IF EXISTS unique_active_request;

-- Add the correct 2-column constraint
-- This allows users to have only ONE request per profile (regardless of status)
-- When user resubmits, it UPDATES the existing request (upsert behavior)
ALTER TABLE profile_link_requests
ADD CONSTRAINT unique_user_profile UNIQUE (user_id, profile_id);

-- Add helpful comment
COMMENT ON CONSTRAINT unique_user_profile ON profile_link_requests IS
  'Ensures a user can only have one request per profile. Enables upsert behavior when resubmitting.';
