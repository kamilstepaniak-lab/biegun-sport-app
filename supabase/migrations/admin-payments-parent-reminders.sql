-- ────────────────────────────────────────────────────────────────────────────
-- Ekran /admin/payments: szukanie po rodzicu + ręczne przypomnienia mailowe
-- ────────────────────────────────────────────────────────────────────────────
-- Uruchom ręcznie w Supabase SQL Editor PRZED wdrożeniem kodu na produkcję.
-- Bez tej migracji /admin/payments przestanie działać (szukanie używa
-- parent_name z widoku, przypomnienia zapisują last_reminder_sent_at).
--
-- 1. payments.last_reminder_sent_at — kiedy ostatnio wysłano przypomnienie
--    (cron lub ręcznie z listy płatności).
-- 2. Backfill payments.participant_id — płatności tworzone przez synchronizację
--    cennika nie miały ustawianego participant_id (naprawione w kodzie), przez
--    co cron pomijał je przy przypomnieniach.
-- 3. admin_payments_view + dane rodzica (płatnika): parent_id, parent_name,
--    parent_first_name, parent_email — do szukania po nazwisku rodzica
--    i wysyłki przypomnień bez dodatkowych zapytań.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

UPDATE payments p
SET participant_id = r.participant_id
FROM trip_registrations r
WHERE p.registration_id = r.id
  AND p.participant_id IS NULL;

DROP VIEW IF EXISTS admin_payments_view;

CREATE VIEW admin_payments_view
WITH (security_invoker = on) AS
SELECT
  p.*,
  part.first_name                                           AS participant_first_name,
  part.last_name                                            AS participant_last_name,
  (part.last_name || ' ' || part.first_name)                AS participant_name,
  par.id                                                    AS parent_id,
  NULLIF(TRIM(COALESCE(par.last_name, '') || ' ' || COALESCE(par.first_name, '')), '')
                                                            AS parent_name,
  par.first_name                                            AS parent_first_name,
  par.email                                                 AS parent_email,
  t.id                                                      AS trip_id,
  COALESCE(t.title, p.manual_title, 'Płatność ręczna')      AS trip_title,
  t.departure_datetime                                      AS trip_departure_datetime,
  r.confirmed_at                                            AS confirmed_at,
  tpl.due_days_from_confirmation                            AS due_days_from_confirmation,
  -- Efektywny termin: konkretne due_date, a gdy go brak (reguła „X dni od
  -- potwierdzenia") — confirmed_at + X dni.
  COALESCE(
    p.due_date,
    CASE
      WHEN tpl.due_days_from_confirmation IS NOT NULL AND r.confirmed_at IS NOT NULL
        THEN (r.confirmed_at::date + tpl.due_days_from_confirmation)
    END
  )                                                         AS effective_due_date
FROM payments p
LEFT JOIN trip_registrations r ON r.id = p.registration_id
JOIN participants part ON part.id = COALESCE(r.participant_id, p.participant_id)
LEFT JOIN profiles par ON par.id = part.parent_id
LEFT JOIN trips t ON t.id = r.trip_id
LEFT JOIN trip_payment_templates tpl ON tpl.id = p.template_id;
