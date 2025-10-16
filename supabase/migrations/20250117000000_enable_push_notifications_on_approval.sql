-- Enable push notifications when profile link requests are approved
-- This migration adds a trigger to call the send-push-notification Edge Function
-- whenever a new notification is created for profile link approvals/rejections

-- Enable pg_net extension for making HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send push notification via Edge Function
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
BEGIN
  -- Only send push for profile link notifications
  IF NEW.type NOT IN ('profile_link_approved', 'profile_link_rejected') THEN
    RETURN NEW;
  END IF;

  -- Build Edge Function URL
  v_edge_function_url := v_supabase_url || '/functions/v1/send-push-notification';

  -- Build payload for Edge Function
  v_payload := jsonb_build_object(
    'userId', NEW.user_id,
    'title', NEW.title,
    'body', NEW.body,
    'data', COALESCE(NEW.data, '{}'::jsonb),
    'priority', 'high',
    'sound', 'default'
  );

  -- Make async HTTP POST request to Edge Function
  -- Using pg_net.http_post for async, non-blocking request
  SELECT INTO v_request_id net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_supabase_anon_key
    ),
    body := v_payload
  );

  -- Log the request
  RAISE NOTICE 'Push notification request queued: request_id=%, notification_id=%, user_id=%',
    v_request_id, NEW.id, NEW.user_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the transaction if push notification fails
    RAISE WARNING 'Failed to queue push notification for notification_id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to send push notification after notification insert
DROP TRIGGER IF EXISTS trigger_send_push_on_notification_insert ON notifications;

CREATE TRIGGER trigger_send_push_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_push_notification();

-- Add comment
COMMENT ON FUNCTION trigger_send_push_notification IS
  'Triggers push notification via Edge Function when profile link notifications are created. Uses embedded Supabase configuration.';

COMMENT ON TRIGGER trigger_send_push_on_notification_insert ON notifications IS
  'Automatically sends push notifications for profile link approvals/rejections';
