-- Archiwizacja umów zamiast trwałego usuwania.
-- Podpisane (zaakceptowane) umowy są dowodem zgody — przy "usuwaniu"
-- dostają znacznik archived_at zamiast być kasowane z bazy.

ALTER TABLE trip_contracts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS trip_contracts_archived_at_idx
  ON trip_contracts (archived_at)
  WHERE archived_at IS NULL;
