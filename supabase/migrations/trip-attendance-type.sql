-- Dodaje typ uczestnictwa wyjazdu: 'mandatory' (obowiązkowy) / 'optional' (dla chętnych)
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS attendance_type text NOT NULL DEFAULT 'optional';
