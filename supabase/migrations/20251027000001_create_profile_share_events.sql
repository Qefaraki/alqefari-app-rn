-- Create profile_share_events table for tracking QR code scans and sharing analytics
-- Migration: 20251027000001_create_profile_share_events

CREATE TABLE IF NOT EXISTS public.profile_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sharer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  share_method TEXT NOT NULL CHECK (share_method IN ('qr_scan', 'copy_link', 'whatsapp', 'system_share')),
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX idx_profile_share_events_profile_id ON public.profile_share_events(profile_id);
CREATE INDEX idx_profile_share_events_sharer_id ON public.profile_share_events(sharer_id);
CREATE INDEX idx_profile_share_events_shared_at ON public.profile_share_events(shared_at DESC);
CREATE INDEX idx_profile_share_events_share_method ON public.profile_share_events(share_method);

-- Enable RLS
ALTER TABLE public.profile_share_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view share events for profiles they have permission to view
CREATE POLICY "Users can view share events for permitted profiles"
  ON public.profile_share_events
  FOR SELECT
  USING (
    -- Allow viewing if user has any permission level (admin, moderator, inner, suggest)
    -- Blocked users will not pass this check
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_share_events.profile_id
        AND profiles.deleted_at IS NULL
    )
  );

-- Policy: Only admins can insert share events
-- Note: In production, this is called from deepLinking.ts after successful profile view
CREATE POLICY "Anyone can insert share events"
  ON public.profile_share_events
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.profile_share_events IS 'Tracks profile sharing events (QR scans, link copies, WhatsApp shares) for analytics. Used by deep linking system and ShareProfileSheet component.';
COMMENT ON COLUMN public.profile_share_events.profile_id IS 'The profile that was shared (required)';
COMMENT ON COLUMN public.profile_share_events.sharer_id IS 'The user who shared the profile (nullable - may be unknown)';
COMMENT ON COLUMN public.profile_share_events.share_method IS 'How the profile was shared: qr_scan (QR code scan), copy_link (copy to clipboard), whatsapp (WhatsApp share), system_share (iOS/Android share sheet)';
COMMENT ON COLUMN public.profile_share_events.shared_at IS 'When the share event occurred (defaults to now())';
