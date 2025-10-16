-- Add notification delivery logging for observability and debugging
-- This allows tracking of push notification delivery success/failure

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('queued', 'sent', 'failed', 'invalid_token', 'timeout', 'no_token')),
  http_status_code INT,
  error_message TEXT,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for debugging and monitoring
CREATE INDEX idx_delivery_log_user_id ON notification_delivery_log(user_id);
CREATE INDEX idx_delivery_log_created_at ON notification_delivery_log(created_at DESC);
CREATE INDEX idx_delivery_log_delivery_status ON notification_delivery_log(delivery_status);
CREATE INDEX idx_delivery_log_notification_id ON notification_delivery_log(notification_id);

-- RLS policies for delivery log
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all delivery logs for debugging
CREATE POLICY "Admins can view all delivery logs"
ON notification_delivery_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Users can view their own delivery logs
CREATE POLICY "Users can view own delivery logs"
ON notification_delivery_log FOR SELECT
USING (auth.uid() = user_id);

-- System can insert delivery logs (for trigger)
CREATE POLICY "System can insert delivery logs"
ON notification_delivery_log FOR INSERT
WITH CHECK (true);

-- Add comments
COMMENT ON TABLE notification_delivery_log IS
  'Tracks push notification delivery attempts for debugging and monitoring. Each row represents one delivery attempt to one device.';

COMMENT ON COLUMN notification_delivery_log.delivery_status IS
  'Status of delivery: queued (pending send), sent (successfully delivered), failed (generic failure), invalid_token (token rejected by Expo), timeout (Edge Function timeout), no_token (user has no push token)';

COMMENT ON COLUMN notification_delivery_log.http_status_code IS
  'HTTP status code from Edge Function response (200 = success, 408 = timeout, 400+ = error)';

COMMENT ON COLUMN notification_delivery_log.error_message IS
  'Error message from failed delivery attempt (for debugging)';

COMMENT ON COLUMN notification_delivery_log.response_body IS
  'Full response body from Edge Function (for detailed debugging)';
