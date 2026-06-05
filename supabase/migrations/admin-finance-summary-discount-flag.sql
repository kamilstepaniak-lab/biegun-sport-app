-- ────────────────────────────────────────────────────────────────────────────
-- Widok admin_finance_summary — zniżka tylko gdy realnie udzielona
-- ────────────────────────────────────────────────────────────────────────────
-- Zmiana semantyki kolumny „Zniżka": wcześniej liczyła każde obniżenie kwoty
-- względem original_amount (także zwykłą edycję ceny). Teraz zniżką jest TYLKO
-- płatność z ustawionym discount_applied_at (checkbox „Zniżka" w dialogu wpłaty).
-- Edycja ceny (updatePaymentAmount) zeruje discount_applied_at, więc nie liczy
-- się jako zniżka — spójnie z ekranem /admin/payments (przekreślona cena).
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
  -- Zniżka = obniżenie kwoty względem original_amount, ale TYLKO dla płatności
  -- z udzieloną zniżką (discount_applied_at IS NOT NULL). Edycja ceny nie liczy.
  COALESCE(SUM(GREATEST(p.original_amount - p.amount, 0))
    FILTER (WHERE p.currency = 'PLN' AND p.discount_applied_at IS NOT NULL), 0) AS discount_pln,
  COALESCE(SUM(GREATEST(p.original_amount - p.amount, 0))
    FILTER (WHERE p.currency = 'EUR' AND p.discount_applied_at IS NOT NULL), 0) AS discount_eur
FROM payments p
JOIN trip_registrations r ON r.id = p.registration_id
JOIN trips t              ON t.id = r.trip_id
WHERE p.status <> 'cancelled'
GROUP BY t.id, t.title, t.departure_datetime;
