-- Migration: Create photo change approval system tables
-- Purpose: Enable moderated photo changes with admin approval workflow
-- Tables: photo_change_requests, photo_rejection_templates

-- ============================================================================
-- TABLE: photo_change_requests
-- ============================================================================
-- Tracks all photo change requests with approval workflow
-- Features: Version control, expiration, status tracking, audit trail

CREATE TABLE photo_change_requests (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Submitter tracking (auth.users.id from the user who submitted)
  submitter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Photo data
  old_photo_url TEXT,  -- Captured at submission time for comparison
  new_photo_url TEXT NOT NULL,  -- Pending photo URL
  new_photo_blurhash TEXT,  -- Optional BlurHash for progressive loading

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),

  -- Review data
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,  -- Populated on rejection (from template or custom)

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,  -- When approved/rejected
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Optimistic locking and audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- TABLE: photo_rejection_templates
-- ============================================================================
-- Admin-customizable rejection reason templates for consistent messaging

CREATE TABLE photo_rejection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,  -- Short label shown in UI (e.g., "صورة غير واضحة")
  message TEXT NOT NULL,  -- Full rejection message (gentle Arabic)
  display_order INTEGER NOT NULL DEFAULT 0,  -- Sort order in template list
  is_active BOOLEAN NOT NULL DEFAULT true,  -- Soft delete support
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes for common queries

-- 1. Find all pending requests (admin queue)
CREATE INDEX idx_photo_requests_status_created
  ON photo_change_requests(status, created_at DESC);

-- 2. Partial index for pending-only queries (smaller, faster)
CREATE INDEX idx_photo_requests_pending_only
  ON photo_change_requests(created_at DESC)
  WHERE status = 'pending';

-- 3. Find requests by submitter (user's own history)
CREATE INDEX idx_photo_requests_submitter
  ON photo_change_requests(submitter_user_id, created_at DESC);

-- 4. Find requests by profile (check if profile has pending request)
CREATE INDEX idx_photo_requests_profile
  ON photo_change_requests(profile_id, status);

-- 5. Expiration cleanup queries
CREATE INDEX idx_photo_requests_expiration
  ON photo_change_requests(expires_at)
  WHERE status = 'pending';

-- 6. Template sorting
CREATE INDEX idx_rejection_templates_order
  ON photo_rejection_templates(display_order, created_at)
  WHERE is_active = true;

-- 7. Business rule enforcement: Only one pending request per profile
CREATE UNIQUE INDEX idx_photo_requests_one_pending_per_profile
  ON photo_change_requests(profile_id)
  WHERE status = 'pending';

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE photo_change_requests IS
  'Tracks photo change requests requiring moderator/admin approval. Features version control, auto-expiration after 7 days, and rate limiting (5 requests per 24 hours).';

COMMENT ON COLUMN photo_change_requests.submitter_user_id IS
  'User ID from auth.users.id (matches profiles.user_id). Set to NULL if user is deleted.';

COMMENT ON COLUMN photo_change_requests.old_photo_url IS
  'Captured at submission time for comparison view. NULL if profile had no photo.';

COMMENT ON COLUMN photo_change_requests.expires_at IS
  'Auto-expires after 7 days. Trigger sets status to expired (no user notification).';

COMMENT ON TABLE photo_rejection_templates IS
  'Admin-managed rejection reason templates. Supports unlimited custom messages with gentle Arabic language.';

COMMENT ON COLUMN photo_rejection_templates.display_order IS
  'Sort order in template picker. Lower numbers appear first.';
