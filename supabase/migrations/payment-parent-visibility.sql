-- Widoczność płatności dla rodzica.
-- Istniejące płatności zostają widoczne po migracji; nowe rekordy aplikacja
-- tworzy jako ukryte i publikuje po wysłaniu maila informacyjnego o wyjeździe.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS parent_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_payments_parent_visible
  ON payments(parent_visible);
