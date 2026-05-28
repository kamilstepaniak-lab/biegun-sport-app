-- Trzy proste flagi na uczestniku (kolumny w widoku CRM):
--   has_whatsapp     — rodzic ma WhatsApp
--   entry_fee_paid   — opłacone wpisowe
--   contract_signed  — umowa podpisana
-- Wszystkie domyślnie false; admin przełącza w tabeli /admin/participants.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entry_fee_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN NOT NULL DEFAULT false;
