-- Globalne ustawienia aplikacji (klucz → wartość).
-- Obecnie: wspólne konto bankowe PLN/EUR dla wszystkich wyjazdów.
-- Uruchom w Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read"   ON app_settings;
DROP POLICY IF EXISTS "app_settings_write"  ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;

-- Wszyscy zalogowani mogą czytać (rodzic potrzebuje numeru konta do przelewu)
CREATE POLICY "app_settings_read" ON app_settings
  FOR SELECT TO authenticated USING (true);

-- Tylko admin zapisuje
CREATE POLICY "app_settings_write" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "app_settings_update" ON app_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO app_settings (key, value) VALUES
  ('bank_account_pln', ''),
  ('bank_account_eur', '')
ON CONFLICT (key) DO NOTHING;
