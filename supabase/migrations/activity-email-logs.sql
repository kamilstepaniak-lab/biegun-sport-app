-- ─── activity_logs ────────────────────────────────────────────────────────────
-- Loguje zdarzenia aplikacyjne (akceptacja umów, zmiany profilu, zapisy, maile)

CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL,
  user_email  TEXT,
  action_type TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx    ON activity_logs (user_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Tylko admin może czytać (inserty via service role — brak ograniczeń)
CREATE POLICY "activity_logs_admin_read" ON activity_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── email_logs ────────────────────────────────────────────────────────────────
-- Loguje wszystkie maile wysłane z systemu BS APP

CREATE TABLE IF NOT EXISTS email_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email    TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  template_id TEXT,
  trip_id     UUID,
  sent_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs (sent_at DESC);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Tylko admin może czytać
CREATE POLICY "email_logs_admin_read" ON email_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
