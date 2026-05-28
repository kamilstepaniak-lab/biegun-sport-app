-- Flaga otwierajaca przyjmowanie zgloszen z formularza WordPress na danym wyjezdzie.
-- Endpoint /api/public/trip-registrations odrzuca zgloszenia gdy false.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS registration_form_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN trips.registration_form_enabled IS
  'Gdy true: publiczny endpoint /api/public/trip-registrations przyjmuje zgloszenia dla tego wyjazdu. Domyslnie wylaczone.';
