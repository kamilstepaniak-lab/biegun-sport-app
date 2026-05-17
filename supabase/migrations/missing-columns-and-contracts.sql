-- ============================================================
-- Migracja porządkowa: dopisuje obiekty, które istnieją w bazie
-- produkcyjnej, ale nie miały dotąd pliku migracji.
-- Wszystkie operacje są idempotentne (IF NOT EXISTS) — bezpieczne
-- do uruchomienia nawet gdy obiekty już istnieją.
-- Uruchom w Supabase SQL Editor.
-- ============================================================

-- ── trips: dodatkowe pola wyjazdu ──────────────────────────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS declaration_deadline     DATE,
  ADD COLUMN IF NOT EXISTS location                 TEXT,
  ADD COLUMN IF NOT EXISTS departure_stop2_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departure_stop2_location TEXT,
  ADD COLUMN IF NOT EXISTS return_stop2_datetime    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_stop2_location    TEXT,
  ADD COLUMN IF NOT EXISTS allow_own_transport      BOOLEAN NOT NULL DEFAULT FALSE;

-- ── trip_registrations: status uczestnictwa ────────────────────
ALTER TABLE trip_registrations
  ADD COLUMN IF NOT EXISTS participation_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (participation_status IN ('unconfirmed', 'confirmed', 'not_going', 'other')),
  ADD COLUMN IF NOT EXISTS participation_note TEXT;

-- ── participants: notatka organizatora ─────────────────────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── payments: kwota pozostała do zapłaty (kolumna generowana) ───
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2)
    GENERATED ALWAYS AS (amount - COALESCE(amount_paid, 0)) STORED;

-- ── trip_contracts: umowy uczestnictwa ─────────────────────────
CREATE TABLE IF NOT EXISTS trip_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  participant_id        UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  registration_id       UUID REFERENCES trip_registrations(id) ON DELETE SET NULL,
  contract_text         TEXT NOT NULL,
  contract_number       TEXT,
  accepted_at           TIMESTAMPTZ,
  accepted_by_parent_id UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  created_by            UUID REFERENCES profiles(id),
  UNIQUE(trip_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_contracts_trip        ON trip_contracts(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_contracts_participant ON trip_contracts(participant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_contracts_contract_number
  ON trip_contracts(contract_number)
  WHERE contract_number IS NOT NULL;

ALTER TABLE trip_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_contracts_admin_all"   ON trip_contracts;
DROP POLICY IF EXISTS "trip_contracts_parent_read" ON trip_contracts;
DROP POLICY IF EXISTS "trip_contracts_parent_accept" ON trip_contracts;

-- Admin zarządza wszystkim
CREATE POLICY "trip_contracts_admin_all" ON trip_contracts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Rodzic czyta umowy swoich dzieci
CREATE POLICY "trip_contracts_parent_read" ON trip_contracts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM participants
    WHERE participants.id = trip_contracts.participant_id
      AND participants.parent_id = auth.uid()
  ));

-- Rodzic akceptuje umowy swoich dzieci
CREATE POLICY "trip_contracts_parent_accept" ON trip_contracts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM participants
    WHERE participants.id = trip_contracts.participant_id
      AND participants.parent_id = auth.uid()
  ));
