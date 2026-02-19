-- ============================================================
-- Migracja: Numer umowy (contract_number) w trip_contracts
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Dodaj kolumnę contract_number do tabeli trip_contracts
ALTER TABLE trip_contracts
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- 2. Utwórz unikalny indeks na contract_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_contracts_contract_number
  ON trip_contracts(contract_number)
  WHERE contract_number IS NOT NULL;

-- 3. Uzupełnij istniejące umowy numerami wstecznie (opcjonalne)
--    Format: numer/rok np. 1/2025
DO $$
DECLARE
  rec RECORD;
  yr TEXT;
  counter INT := 0;
BEGIN
  FOR rec IN
    SELECT id, created_at FROM trip_contracts WHERE contract_number IS NULL ORDER BY created_at
  LOOP
    counter := counter + 1;
    yr := EXTRACT(YEAR FROM rec.created_at)::TEXT;
    UPDATE trip_contracts
    SET contract_number = counter::TEXT || '/' || yr
    WHERE id = rec.id;
  END LOOP;
END $$;
