-- Create profile_creation_requests table for users who can't find their profile
CREATE TABLE IF NOT EXISTS profile_creation_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name_chain TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  additional_info TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_profile_creation_requests_user_id ON profile_creation_requests(user_id);
CREATE INDEX idx_profile_creation_requests_status ON profile_creation_requests(status);
CREATE INDEX idx_profile_creation_requests_created_at ON profile_creation_requests(created_at DESC);

-- Enable RLS
ALTER TABLE profile_creation_requests ENABLE ROW LEVEL SECURITY;

-- Policies for profile_creation_requests
-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON profile_creation_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create requests" ON profile_creation_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON profile_creation_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- Admins can update requests
CREATE POLICY "Admins can update requests" ON profile_creation_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- Create function to notify admins of new requests
CREATE OR REPLACE FUNCTION notify_admins_of_profile_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification into audit log
  INSERT INTO audit_log (
    action_type,
    actor_id,
    details
  ) VALUES (
    'profile_creation_request',
    NEW.user_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'name_chain', NEW.name_chain,
      'phone_number', NEW.phone_number,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new requests
CREATE TRIGGER on_profile_request_created
  AFTER INSERT ON profile_creation_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_of_profile_request();

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_profile_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_profile_request_updated_at
  BEFORE UPDATE ON profile_creation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_request_updated_at();