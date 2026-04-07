-- Oddzielna data i godzina wyjazdu/powrotu
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS departure_time_known boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS return_time_known boolean NOT NULL DEFAULT true;

-- Termin płatności "N dni od potwierdzenia"
ALTER TABLE trip_payment_templates
  ADD COLUMN IF NOT EXISTS due_days_from_confirmation integer NULL;

-- Timestamp potwierdzenia przez rodzica (kliknięcie "jedzie")
ALTER TABLE trip_registrations
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL;
