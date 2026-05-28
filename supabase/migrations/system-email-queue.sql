-- Kolejka systemowych e-maili wysyłanych przez Gmail SMTP.
-- Uruchom ręcznie w Supabase SQL Editor przed użyciem kolejkowanej wysyłki.

CREATE TABLE IF NOT EXISTS system_email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     TEXT,
  source_type     TEXT NOT NULL,
  source_id       UUID,
  trip_id         UUID,
  parent_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL,
  recipient_name  TEXT,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'bounced')),
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  smtp_message_id TEXT,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_email_queue_status_scheduled_idx
  ON system_email_queue (status, scheduled_at);

CREATE INDEX IF NOT EXISTS system_email_queue_trip_id_idx
  ON system_email_queue (trip_id);

CREATE INDEX IF NOT EXISTS system_email_queue_parent_id_idx
  ON system_email_queue (parent_id);

CREATE INDEX IF NOT EXISTS system_email_queue_source_idx
  ON system_email_queue (source_type, source_id);

ALTER TABLE system_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_email_queue_admin_read" ON system_email_queue;

CREATE POLICY "system_email_queue_admin_read" ON system_email_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION claim_system_email_queue_batch(batch_size INTEGER DEFAULT 15)
RETURNS SETOF system_email_queue
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH picked AS (
    SELECT id
    FROM system_email_queue
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
      AND attempt_count < max_attempts
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE system_email_queue q
  SET status = 'sending',
      attempt_count = q.attempt_count + 1,
      last_attempt_at = NOW(),
      updated_at = NOW()
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
$$;

