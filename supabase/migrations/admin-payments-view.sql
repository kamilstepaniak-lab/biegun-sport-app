-- ────────────────────────────────────────────────────────────────────────────
-- Widok dla ekranu /admin/payments
-- ────────────────────────────────────────────────────────────────────────────
-- Spłaszcza payment + uczestnik + wyjazd do jednej tabeli, dzięki czemu
-- ekran płatności może:
--   • ładować dane stronami (.range) zamiast wszystkich naraz,
--   • filtrować po stronie bazy (status, daty, wyjazd),
--   • wyszukiwać jednocześnie po nazwisku dziecka ORAZ tytule wyjazdu.
--
-- security_invoker = on → widok respektuje RLS tabel źródłowych (payments,
-- participants, trips). Panel admina i tak czyta przez service role (omija RLS),
-- ale dzięki temu widok jest bezpieczny gdyby ktoś sięgnął po niego jako rodzic.

CREATE OR REPLACE VIEW admin_payments_view
WITH (security_invoker = on) AS
SELECT
  p.*,
  part.first_name                              AS participant_first_name,
  part.last_name                               AS participant_last_name,
  (part.last_name || ' ' || part.first_name)   AS participant_name,
  t.id                                         AS trip_id,
  t.title                                      AS trip_title,
  t.departure_datetime                         AS trip_departure_datetime
FROM payments p
JOIN trip_registrations r ON r.id   = p.registration_id
JOIN participants       part ON part.id = r.participant_id
JOIN trips              t ON t.id   = r.trip_id;

-- Indeks pod sortowanie/filtrowanie po dacie utworzenia (widok sortuje malejąco).
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
