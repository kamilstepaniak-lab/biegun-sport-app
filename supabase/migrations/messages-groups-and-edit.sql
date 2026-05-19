-- Targetowanie wiadomości do grup treningowych + edycja wiadomości
-- Do ręcznego uruchomienia na Supabase.

-- NULL lub pusta tablica = wiadomość dla wszystkich rodziców
ALTER TABLE messages ADD COLUMN IF NOT EXISTS target_group_ids UUID[];

-- Znacznik ostatniej edycji
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Admini mogą edytować wiadomości
DROP POLICY IF EXISTS "admin_update_messages" ON messages;
CREATE POLICY "admin_update_messages" ON messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
