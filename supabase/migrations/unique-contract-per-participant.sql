-- ============================================================
-- Migracja: Unikalny indeks na (trip_id, participant_id) w trip_contracts
-- Zapobiega tworzeniu duplikatów umów przy równoczesnych requestach
-- Uruchom w Supabase SQL Editor
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_contracts_trip_participant
  ON trip_contracts(trip_id, participant_id);
