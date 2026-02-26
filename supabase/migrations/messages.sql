-- Prosty system wiadomości: admin pisze ogłoszenia, rodzice czytają

CREATE TABLE IF NOT EXISTS messages (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Wszyscy zalogowani użytkownicy mogą czytać wiadomości
CREATE POLICY "read_messages" ON messages
  FOR SELECT TO authenticated USING (true);

-- Tylko admini mogą tworzyć wiadomości
CREATE POLICY "admin_insert_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admini mogą usuwać wiadomości
CREATE POLICY "admin_delete_messages" ON messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Odczyty wiadomości ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_reads (
  message_id  UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_reads" ON message_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "insert_own_reads" ON message_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admini mogą widzieć wszystkie odczyty (do statystyk)
CREATE POLICY "admin_read_all_reads" ON message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
