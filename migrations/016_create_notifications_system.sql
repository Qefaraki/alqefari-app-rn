-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'profile_link_approved',
        'profile_link_rejected',
        'new_profile_link_request',
        'profile_updated',
        'admin_message',
        'system_message'
    )),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

    -- For tracking related entities
    related_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    related_request_id UUID REFERENCES public.profile_link_requests(id) ON DELETE SET NULL,

    -- For push notification tracking
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    push_error TEXT
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Create push tokens table for storing device tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per user and token
    UNIQUE(user_id, token)
);

-- Create index for active tokens
CREATE INDEX idx_push_tokens_user_active ON public.push_tokens(user_id, is_active) WHERE is_active = true;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}',
    p_related_profile_id UUID DEFAULT NULL,
    p_related_request_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data,
        related_profile_id,
        related_request_id
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_body,
        p_data,
        p_related_profile_id,
        p_related_request_id
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for profile link request status changes
CREATE OR REPLACE FUNCTION notify_profile_link_status_change() RETURNS TRIGGER AS $$
DECLARE
    v_profile_name TEXT;
    v_admin_user_id UUID;
    v_notification_type TEXT;
    v_notification_title TEXT;
    v_notification_body TEXT;
BEGIN
    -- Only process if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get profile name for notifications
    SELECT name INTO v_profile_name
    FROM public.profiles
    WHERE id = NEW.profile_id;

    -- Handle approval
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Notify the requester
        PERFORM create_notification(
            NEW.user_id,
            'profile_link_approved',
            'تمت الموافقة على طلبك! 🎉',
            format('تم ربط ملفك الشخصي "%s" بنجاح. يمكنك الآن تعديل معلوماتك.', COALESCE(v_profile_name, NEW.name_chain)),
            jsonb_build_object(
                'request_id', NEW.id,
                'profile_id', NEW.profile_id,
                'approved_at', NEW.reviewed_at
            ),
            NEW.profile_id,
            NEW.id
        );

    -- Handle rejection
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        -- Notify the requester
        PERFORM create_notification(
            NEW.user_id,
            'profile_link_rejected',
            'تم رفض طلب الربط',
            format('تم رفض طلب ربط الملف "%s". %s',
                COALESCE(v_profile_name, NEW.name_chain),
                COALESCE(NEW.review_notes, 'يرجى التواصل مع المشرف للمزيد من المعلومات.')
            ),
            jsonb_build_object(
                'request_id', NEW.id,
                'profile_id', NEW.profile_id,
                'rejected_at', NEW.reviewed_at,
                'reason', NEW.review_notes
            ),
            NEW.profile_id,
            NEW.id
        );
    END IF;

    -- For new requests, notify admins (handled by separate trigger)

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile link status changes
DROP TRIGGER IF EXISTS trigger_notify_profile_link_status ON public.profile_link_requests;
CREATE TRIGGER trigger_notify_profile_link_status
    AFTER UPDATE ON public.profile_link_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_profile_link_status_change();

-- Trigger to notify admins of new profile link requests
CREATE OR REPLACE FUNCTION notify_admins_new_request() RETURNS TRIGGER AS $$
DECLARE
    v_admin RECORD;
    v_profile_name TEXT;
BEGIN
    -- Only for new pending requests
    IF NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- Get profile name
    SELECT name INTO v_profile_name
    FROM public.profiles
    WHERE id = NEW.profile_id;

    -- Notify all admins and super_admins
    FOR v_admin IN
        SELECT DISTINCT user_id
        FROM public.profiles
        WHERE role IN ('admin', 'super_admin')
        AND user_id IS NOT NULL
    LOOP
        PERFORM create_notification(
            v_admin.user_id,
            'new_profile_link_request',
            'طلب ربط جديد',
            format('طلب جديد من %s لربط الملف الشخصي "%s"',
                COALESCE(NEW.phone, 'مستخدم'),
                COALESCE(v_profile_name, NEW.name_chain)
            ),
            jsonb_build_object(
                'request_id', NEW.id,
                'profile_id', NEW.profile_id,
                'requester_phone', NEW.phone,
                'is_admin_notification', true
            ),
            NEW.profile_id,
            NEW.id
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new profile link requests
DROP TRIGGER IF EXISTS trigger_notify_admins_new_request ON public.profile_link_requests;
CREATE TRIGGER trigger_notify_admins_new_request
    AFTER INSERT ON public.profile_link_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_new_request();

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.notifications
        WHERE user_id = p_user_id
        AND is_read = false
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, read_at = NOW()
    WHERE id = p_notification_id
    AND user_id = p_user_id
    AND is_read = false;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = p_user_id
    AND is_read = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for user notifications with related data
CREATE OR REPLACE VIEW public.user_notifications AS
SELECT
    n.*,
    p.name as related_profile_name,
    p.photo_url as related_profile_photo,
    plr.name_chain as request_name_chain,
    plr.phone as request_phone
FROM public.notifications n
LEFT JOIN public.profiles p ON n.related_profile_id = p.id
LEFT JOIN public.profile_link_requests plr ON n.related_request_id = plr.id;

-- RLS policies for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- System can insert notifications for any user (via functions)
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- RLS for push tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can manage own push tokens" ON public.push_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Cleanup old notifications job (run daily)
CREATE OR REPLACE FUNCTION cleanup_old_notifications() RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.notifications
    WHERE expires_at < NOW()
    OR (is_read = true AND read_at < NOW() - INTERVAL '7 days');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.push_tokens TO authenticated;
GRANT SELECT ON public.user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
