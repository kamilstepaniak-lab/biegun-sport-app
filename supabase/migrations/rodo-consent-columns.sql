-- ────────────────────────────────────────────────────────────────────────────
-- Zgoda RODO przy rejestracji
-- ────────────────────────────────────────────────────────────────────────────
-- Dodaje kolumnę przechowującą moment potwierdzenia przez rodzica zapoznania się
-- z informacją o przetwarzaniu danych osobowych (wymagane do rejestracji).
--
-- Zgody marketingowe (wizerunek, marketing e-mail) NIE są zbierane przy
-- rejestracji — będą częścią umów akceptowanych osobno przez rodzica.
--
-- Uruchom w Supabase → SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rodo_accepted_at TIMESTAMPTZ;
