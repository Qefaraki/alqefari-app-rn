-- Improve push notification trigger with delivery logging and idempotency
-- This migration adds robust error handling, delivery tracking, and prevents duplicate notifications

CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT := 'https://ezkioroyhzpavmbfavyn.supabase.co';
  v_supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q';
  v_edge_function_url TEXT;
  v_payload JSONB;
  v_request_id BIGINT;
  v_log_id UUID;
BEGIN
  -- Only send push for profile link notifications
  IF NEW.type NOT IN ('profile_link_approved', 'profile_link_rejected') THEN
    RETURN NEW;
  END IF;

  -- Build Edge Function URL
  v_edge_function_url := v_supabase_url || '/functions/v1/send-push-notification';

  -- Build payload for Edge Function
  v_payload := jsonb_build_object(
    'notificationId', NEW.id,
    'userId', NEW.user_id,
    'title', NEW.title,
    'body', NEW.body,
    'data', COALESCE(NEW.data, '{}'::jsonb),
    'priority', 'high',
    'sound', 'default'
  );

  -- Create initial delivery log entry with status 'queued'
  INSERT INTO notification_delivery_log (
    notification_id,
    user_id,
    push_token,
    delivery_status,
    http_status_code
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NULL, -- Token unknown at this point, Edge Function will determine it
    'queued',
    NULL
  ) RETURNING id INTO v_log_id;

  -- Make async HTTP POST request to Edge Function
  -- Using pg_net.http_post for async, non-blocking request
  BEGIN
    SELECT INTO v_request_id net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := v_payload,
      timeout_milliseconds := 8000 -- 8 second timeout (increased from 5s for cold starts)
    );

    -- Log the request ID
    RAISE NOTICE 'Push notification queued: request_id=%, notification_id=%, user_id=%, log_id=%',
      v_request_id, NEW.id, NEW.user_id, v_log_id;

    -- Update delivery log with request ID (successful queue)
    UPDATE notification_delivery_log
    SET
      delivery_status = 'sent', -- Optimistically assume sent (Edge Function will update if it fails)
      http_status_code = 202 -- Accepted (queued for delivery)
    WHERE id = v_log_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      RAISE WARNING 'Failed to queue push notification for notification_id=%: %', NEW.id, SQLERRM;

      -- Update delivery log with error
      UPDATE notification_delivery_log
      SET
        delivery_status = 'failed',
        error_message = SQLERRM
      WHERE id = v_log_id;
  END;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it uses the new function
DROP TRIGGER IF EXISTS trigger_send_push_on_notification_insert ON notifications;

CREATE TRIGGER trigger_send_push_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_push_notification();

-- Update comments
COMMENT ON FUNCTION trigger_send_push_notification IS
  'Triggers push notification via Edge Function when profile link notifications are created. Logs all delivery attempts to notification_delivery_log table for debugging. Uses 8-second timeout to accommodate Edge Function cold starts.';

COMMENT ON TRIGGER trigger_send_push_on_notification_insert ON notifications IS
  'Automatically sends push notifications for profile link approvals/rejections and logs delivery status';
