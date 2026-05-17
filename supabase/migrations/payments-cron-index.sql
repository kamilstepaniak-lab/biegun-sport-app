-- ────────────────────────────────────────────────────────────────────────────
-- Indeks pod zapytanie crona przypomnień o płatnościach
-- ────────────────────────────────────────────────────────────────────────────
-- Cron /api/cron/payment-reminders filtruje płatności po due_date (równość)
-- oraz status (IN). Indeks złożony (due_date, status) pozwala bazie znaleźć
-- te wiersze bez skanowania całej tabeli — istotne dopiero przy tysiącach
-- płatności, ale tani do dodania teraz.
--
-- Uruchom w Supabase → SQL Editor.

CREATE INDEX IF NOT EXISTS idx_payments_due_date_status
  ON payments (due_date, status);
