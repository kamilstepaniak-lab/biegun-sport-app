-- Karnet (lub dowolna płatność) może mieć termin równy terminowi raty 1.
-- Gdy due_with_first_installment = true, efektywny termin płatności jest
-- wyliczany z raty 1 (installment_number = 1 / is_first_installment), a nie
-- z due_date / due_days_from_confirmation tego szablonu.
ALTER TABLE trip_payment_templates
  ADD COLUMN IF NOT EXISTS due_with_first_installment BOOLEAN NOT NULL DEFAULT false;
