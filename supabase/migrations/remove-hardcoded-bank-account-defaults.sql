-- Usuwa hardcoded numery kont bankowych z DEFAULT na kolumnach trips.
-- Konta są teraz konfigurowane przez NEXT_PUBLIC_DEFAULT_BANK_ACCOUNT_PLN/EUR
-- (wstawiane przez aplikację) lub wpisywane ręcznie przy tworzeniu wyjazdu.
--
-- Istniejące rekordy zachowują swoje dotychczasowe wartości — DROP DEFAULT
-- nie modyfikuje wierszy, jedynie usuwa default dla nowych INSERTów.

ALTER TABLE trips
  ALTER COLUMN bank_account_pln DROP DEFAULT,
  ALTER COLUMN bank_account_eur DROP DEFAULT;
