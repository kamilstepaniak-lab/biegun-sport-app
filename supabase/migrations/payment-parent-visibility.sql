-- Widoczność płatności dla rodzica.
-- Istniejące płatności zostają widoczne po migracji.
-- Wysłanie maila informacyjnego ustawia trips.payments_released_at,
-- więc późniejsze płatności tworzone po potwierdzeniu udziału rodzica
-- są od razu widoczne.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS payments_released_at TIMESTAMPTZ;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS parent_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_payments_parent_visible
  ON payments(parent_visible);
