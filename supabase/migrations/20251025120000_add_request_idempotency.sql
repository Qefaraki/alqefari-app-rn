-- Track processed requests to prevent duplicate mutations
CREATE TABLE IF NOT EXISTS processed_requests (
  request_id UUID PRIMARY KEY,
  operation_type TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB
);

-- Indexes for cleanup and lookups
CREATE INDEX IF NOT EXISTS idx_processed_requests_timestamp ON processed_requests(processed_at);
CREATE INDEX IF NOT EXISTS idx_processed_requests_profile ON processed_requests(profile_id);

-- Cleanup function for old records
CREATE OR REPLACE FUNCTION cleanup_old_processed_requests()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_requests
  WHERE processed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE processed_requests IS 'Stores processed request IDs to prevent duplicate mutations on retry. Auto-cleaned after 7 days.';
COMMENT ON COLUMN processed_requests.request_id IS 'Unique request identifier from client';
COMMENT ON COLUMN processed_requests.operation_type IS 'Type of operation: profile_update, add_marriage, etc.';
COMMENT ON COLUMN processed_requests.result IS 'Cached result to return on duplicate requests';
