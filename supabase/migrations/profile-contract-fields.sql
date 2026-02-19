-- ============================================================
-- Migracja: Dane do umów w profilu rodzica
-- Uruchom w Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_zip    TEXT,
  ADD COLUMN IF NOT EXISTS address_city   TEXT,
  ADD COLUMN IF NOT EXISTS pesel          TEXT;
