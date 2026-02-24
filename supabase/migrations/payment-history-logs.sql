-- Tabela historii zmian statusów płatności (Audit Log)
-- Tylko do zapisu (INSERT) — brak polityk UPDATE i DELETE

CREATE TABLE IF NOT EXISTS payment_history_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  changed_by      UUID REFERENCES profiles(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  old_status      TEXT,
  new_status      TEXT NOT NULL,
  old_amount_paid NUMERIC(10,2),
  new_amount_paid NUMERIC(10,2),
  action          TEXT NOT NULL, -- 'payment_added' | 'marked_paid' | 'status_changed' | 'cancelled'
  note            TEXT
);

-- Indeks dla szybkiego filtrowania po payment_id i dacie
CREATE INDEX IF NOT EXISTS payment_history_logs_payment_id_idx ON payment_history_logs(payment_id);
CREATE INDEX IF NOT EXISTS payment_history_logs_changed_at_idx ON payment_history_logs(changed_at DESC);

-- RLS
ALTER TABLE payment_history_logs ENABLE ROW LEVEL SECURITY;

-- Tylko admini mogą czytać
CREATE POLICY "admin_read_payment_history" ON payment_history_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tylko admini mogą dodawać wpisy (INSERT przez Server Action)
CREATE POLICY "admin_insert_payment_history" ON payment_history_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- CELOWO BRAK polityk UPDATE i DELETE — tabela jest append-only (czarna skrzynka)
