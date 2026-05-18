-- ────────────────────────────────────────────────────────────────────────────
-- Widok agregujący dla ekranu /admin/finance
-- ────────────────────────────────────────────────────────────────────────────
-- Ekran finansów potrzebuje sum płatności per wyjazd. Zamiast pobierać do
-- przeglądarki wszystkie wiersze płatności i sumować je w JS, agregacja
-- odbywa się w bazie — ekran pobiera jeden wiersz na wyjazd (~kilkadziesiąt
-- wierszy zamiast tysięcy).
--
-- security_invoker = on → widok respektuje RLS tabel źródłowych.
--
-- Uruchom w Supabase → SQL Editor.

CREATE OR REPLACE VIEW admin_finance_summary
WITH (security_invoker = on) AS
SELECT
  t.id                                                          AS trip_id,
  t.title                                                       AS trip_title,
  t.departure_datetime                                          AS trip_departure,
  COUNT(DISTINCT r.participant_id)                              AS participant_count,
  COUNT(*)                                                       AS total_payments,
  COUNT(*) FILTER (WHERE p.status = 'paid')                      AS paid_payments,
  COALESCE(SUM(p.amount)      FILTER (WHERE p.currency = 'PLN'), 0) AS total_pln,
  COALESCE(SUM(p.amount_paid) FILTER (WHERE p.currency = 'PLN'), 0) AS paid_pln,
  COALESCE(SUM(p.amount)      FILTER (WHERE p.currency = 'EUR'), 0) AS total_eur,
  COALESCE(SUM(p.amount_paid) FILTER (WHERE p.currency = 'EUR'), 0) AS paid_eur,
  -- Zniżka = obniżenie kwoty względem original_amount (closeAsDiscount / edycja kwoty).
  COALESCE(SUM(GREATEST(p.original_amount - p.amount, 0)) FILTER (WHERE p.currency = 'PLN'), 0) AS discount_pln,
  COALESCE(SUM(GREATEST(p.original_amount - p.amount, 0)) FILTER (WHERE p.currency = 'EUR'), 0) AS discount_eur
FROM payments p
JOIN trip_registrations r ON r.id = p.registration_id
JOIN trips t              ON t.id = r.trip_id
WHERE p.status <> 'cancelled'
GROUP BY t.id, t.title, t.departure_datetime;
