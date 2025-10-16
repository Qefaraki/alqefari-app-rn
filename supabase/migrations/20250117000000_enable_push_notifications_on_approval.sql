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
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_edge_function_url TEXT;
  v_payload JSONB;
  v_request_id BIGINT;
BEGIN
  -- Only send push for profile link notifications
  IF NEW.type NOT IN ('profile_link_approved', 'profile_link_rejected') THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and anon key from app settings
  -- Note: These should be set via ALTER DATABASE statement or will use defaults
  v_supabase_url := current_setting('app.supabase_url', TRUE);
  v_supabase_anon_key := current_setting('app.supabase_anon_key', TRUE);

  -- If settings not configured, skip push notification (fail gracefully)
  IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
    RAISE WARNING 'Supabase URL or anon key not configured. Skipping push notification.';
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

  -- Log the request (optional)
  RAISE NOTICE 'Push notification request queued: request_id=%, notification_id=%', v_request_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the transaction if push notification fails
    RAISE WARNING 'Failed to queue push notification: %', SQLERRM;
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
  'Triggers push notification via Edge Function when profile link notifications are created';

COMMENT ON TRIGGER trigger_send_push_on_notification_insert ON notifications IS
  'Automatically sends push notifications for profile link approvals/rejections';

-- Note: To configure Supabase URL and anon key, run these commands in SQL editor:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_anon_key = 'your-anon-key';
