-- Tabela powiadomień (wiadomości masowych)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('payment_reminder', 'new_trip', 'trip_update', 'custom')),
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'group', 'trip', 'individual')),
  target_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  target_trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'failed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER
);

-- Logi wysyłki powiadomień
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT
);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Tylko adminowie mogą zarządzać powiadomieniami
CREATE POLICY "Admins can manage notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view notification logs"
  ON notification_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON notification_logs(notification_id);
