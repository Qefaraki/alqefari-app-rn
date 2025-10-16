-- Fix HID generation to prevent reuse after soft deletion
-- Root cause: generate_next_hid excluded soft-deleted profiles, causing HID collisions
--
-- Bug scenario:
-- 1. Add children -> HIDs: parent.1, parent.2, parent.3, parent.4
-- 2. Delete them -> soft delete (deleted_at set, HIDs still in DB)
-- 3. Add again -> generate_next_hid skips deleted rows, generates parent.1-4 AGAIN
-- 4. UNIQUE CONSTRAINT VIOLATION on profiles_hid_key
--
-- Fix: Count ALL profiles (including soft-deleted) when calculating next sibling number
-- This ensures HIDs are never reused, maintaining referential integrity

CREATE OR REPLACE FUNCTION generate_next_hid(parent_hid text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    next_sibling_num INT;
    lock_key BIGINT;
BEGIN
    -- Generate deterministic lock key from parent_hid
    -- This serializes all HID generation for the same parent
    lock_key := ('x' || md5(COALESCE(parent_hid, 'ROOT')))::bit(64)::bigint;

    -- Acquire advisory lock for this parent (released at transaction end)
    PERFORM pg_advisory_xact_lock(lock_key);

    IF parent_hid IS NULL THEN
        -- Root level node
        RETURN 'R' || nextval('hid_counter');
    ELSE
        -- Get next sibling number efficiently
        -- CRITICAL FIX: Removed "AND deleted_at IS NULL" to prevent HID reuse
        -- Count ALL profiles (including soft-deleted) to ensure unique HIDs
        SELECT COALESCE(MAX(
            CAST(
                SUBSTRING(hid FROM LENGTH(parent_hid) + 2)
                AS INTEGER
            )
        ), 0) + 1
        INTO next_sibling_num
        FROM profiles
        WHERE hid LIKE parent_hid || '.%'
        AND hid NOT LIKE parent_hid || '.%.%';
        -- Removed: AND deleted_at IS NULL
        -- Reason: Soft-deleted profiles still occupy HIDs in unique constraint
        -- Must count them to avoid generating duplicate HIDs

        RETURN parent_hid || '.' || next_sibling_num;
    END IF;
END;
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION generate_next_hid IS
'Generates next HID for a profile. CRITICAL: Counts ALL profiles (including soft-deleted)
to prevent HID reuse. Soft-deleted profiles retain their HIDs due to unique constraint.
Uses advisory locks to prevent race conditions during concurrent insertions.';
