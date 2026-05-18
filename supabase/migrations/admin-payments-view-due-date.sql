-- ────────────────────────────────────────────────────────────────────────────
-- Rozszerzenie admin_payments_view o dane potrzebne do wyliczenia terminu
-- ────────────────────────────────────────────────────────────────────────────
-- Ekran /admin/payments pokazywał „—" w kolumnie Termin dla płatności z regułą
-- „X dni od potwierdzenia", bo czytał wprost payments.due_date (puste dla tej
-- reguły). Dodajemy confirmed_at (z rejestracji) oraz due_days_from_confirmation
-- (z szablonu cennika), żeby admin liczył termin tak samo jak panel rodzica
-- (przez resolveEffectiveDueDate).
--
-- CREATE OR REPLACE VIEW dopuszcza dokładanie nowych kolumn tylko na końcu.

CREATE OR REPLACE VIEW admin_payments_view
WITH (security_invoker = on) AS
SELECT
  p.*,
  part.first_name                              AS participant_first_name,
  part.last_name                               AS participant_last_name,
  (part.last_name || ' ' || part.first_name)   AS participant_name,
  t.id                                         AS trip_id,
  t.title                                      AS trip_title,
  t.departure_datetime                         AS trip_departure_datetime,
  r.confirmed_at                               AS confirmed_at,
  tpl.due_days_from_confirmation               AS due_days_from_confirmation,
  -- Efektywny termin: konkretne due_date, a gdy go brak (reguła „X dni od
  -- potwierdzenia") — confirmed_at + X dni. Pozwala filtrować/sortować po
  -- realnym terminie także dla płatności z pustym payments.due_date.
  COALESCE(
    p.due_date,
    CASE
      WHEN tpl.due_days_from_confirmation IS NOT NULL AND r.confirmed_at IS NOT NULL
        THEN (r.confirmed_at::date + tpl.due_days_from_confirmation)
    END
  )                                            AS effective_due_date
FROM payments p
JOIN trip_registrations r ON r.id   = p.registration_id
JOIN participants       part ON part.id = r.participant_id
JOIN trips              t ON t.id   = r.trip_id
LEFT JOIN trip_payment_templates tpl ON tpl.id = p.template_id;
