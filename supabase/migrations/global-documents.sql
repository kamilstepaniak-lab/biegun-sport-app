-- Migracja: Tabela globalnych dokumentów (Regulamin obozu, itp.)
-- Uruchom w Supabase SQL Editor (projekt → SQL Editor → New query)

-- 1. Utwórz tabelę (jeśli nie istnieje)
CREATE TABLE IF NOT EXISTS global_documents (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE global_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read global documents" ON global_documents;
DROP POLICY IF EXISTS "Admins can insert global documents"            ON global_documents;
DROP POLICY IF EXISTS "Admins can update global documents"            ON global_documents;
DROP POLICY IF EXISTS "Admins can delete global documents"            ON global_documents;

-- Wszyscy zalogowani mogą czytać
CREATE POLICY "Authenticated users can read global documents"
  ON global_documents FOR SELECT
  USING (auth.role() = 'authenticated');

-- Tylko admini mogą wstawiać
CREATE POLICY "Admins can insert global documents"
  ON global_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Tylko admini mogą aktualizować
CREATE POLICY "Admins can update global documents"
  ON global_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Tylko admini mogą usuwać
CREATE POLICY "Admins can delete global documents"
  ON global_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
