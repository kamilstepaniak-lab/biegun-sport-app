-- Atomowe generowanie numeru umowy: bezpieczne dla równoległych wywołań.
--
-- Wcześniej kod liczył `SELECT count(*) + 1` w aplikacji, co przy
-- równoległym potwierdzeniu (admin + rodzic w tej samej sekundzie)
-- mogło wyprodukować ten sam numer dla różnych umów.
--
-- Rozwiązanie: Postgres RPC z `pg_advisory_xact_lock` na kluczu
-- "contract-number-<rok>". Tylko jedna transakcja jednocześnie może
-- liczyć kolejny numer dla danego roku, więc duplikaty są wykluczone.

CREATE OR REPLACE FUNCTION public.next_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM NOW())::INT;
  v_lock_key BIGINT;
  v_count INT;
BEGIN
  -- Klucz locka: hash z napisu (stabilny dla danego roku)
  v_lock_key := hashtext('contract-number-' || v_year::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*) INTO v_count
    FROM trip_contracts
    WHERE contract_number IS NOT NULL
      AND contract_number LIKE '%/' || v_year::TEXT;

  RETURN (v_count + 1)::TEXT || '/' || v_year::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.next_contract_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_contract_number() TO authenticated, service_role;
