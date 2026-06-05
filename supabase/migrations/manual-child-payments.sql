-- Ręczne płatności przypisane bezpośrednio do dziecka, bez wyjazdu.
-- Uruchom ręcznie w Supabase SQL Editor przed wdrożeniem kodu na produkcję.

ALTER TABLE payments
  ALTER COLUMN registration_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS manual_title TEXT;

UPDATE payments p
SET participant_id = r.participant_id
FROM trip_registrations r
WHERE p.registration_id = r.id
  AND p.participant_id IS NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check,
  ADD CONSTRAINT payments_payment_type_check
    CHECK (payment_type IN ('installment', 'season_pass', 'manual'));

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_trip_or_manual_check,
  ADD CONSTRAINT payments_trip_or_manual_check
    CHECK (
      registration_id IS NOT NULL
      OR (participant_id IS NOT NULL AND manual_title IS NOT NULL AND length(trim(manual_title)) > 0)
    );

CREATE INDEX IF NOT EXISTS idx_payments_participant_id
  ON payments(participant_id);

CREATE INDEX IF NOT EXISTS idx_payments_manual
  ON payments(participant_id, created_at DESC)
  WHERE registration_id IS NULL;

DROP VIEW IF EXISTS admin_payments_view;

CREATE VIEW admin_payments_view
WITH (security_invoker = on) AS
SELECT
  p.*,
  part.first_name                                           AS participant_first_name,
  part.last_name                                            AS participant_last_name,
  (part.last_name || ' ' || part.first_name)                AS participant_name,
  t.id                                                      AS trip_id,
  COALESCE(t.title, p.manual_title, 'Płatność ręczna')      AS trip_title,
  t.departure_datetime                                      AS trip_departure_datetime,
  r.confirmed_at                                            AS confirmed_at,
  tpl.due_days_from_confirmation                            AS due_days_from_confirmation,
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
LEFT JOIN trips t ON t.id = r.trip_id
LEFT JOIN trip_payment_templates tpl ON tpl.id = p.template_id;
