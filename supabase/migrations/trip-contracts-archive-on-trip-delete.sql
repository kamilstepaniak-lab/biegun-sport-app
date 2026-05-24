-- Archiwizacja podpisanych umów przy usuwaniu wyjazdu.
--
-- Zmiana modelu: trip_contracts.trip_id staje się nullable; FK przechodzi
-- z ON DELETE CASCADE na ON DELETE SET NULL. Dzięki temu po usunięciu
-- wyjazdu podpisane umowy (dowód prawny zgody rodzica) nie znikają
-- z bazy — zostają z trip_id = NULL i pokazane są w zakładce "Archiwum".
--
-- Snapshot tytułu wyjazdu i daty wyjazdu jest zapisywany w samej umowie
-- w momencie archiwizacji — żeby archiwum było czytelne nawet po usunięciu
-- wpisu w tabeli trips.

ALTER TABLE trip_contracts
  ADD COLUMN IF NOT EXISTS trip_title_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS trip_departure_snapshot TIMESTAMPTZ;

ALTER TABLE trip_contracts
  ALTER COLUMN trip_id DROP NOT NULL;

ALTER TABLE trip_contracts
  DROP CONSTRAINT IF EXISTS trip_contracts_trip_id_fkey;

ALTER TABLE trip_contracts
  ADD CONSTRAINT trip_contracts_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;
