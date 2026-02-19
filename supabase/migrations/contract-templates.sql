-- ============================================================
-- Migracja: Wzory umów per wyjazd (trip_contract_templates)
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Tabela wzorów umów
CREATE TABLE IF NOT EXISTS trip_contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  template_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id)
);

-- 2. RLS
ALTER TABLE trip_contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract templates"
  ON trip_contract_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Kolumna contract_number w trip_contracts (jeśli jeszcze nie istnieje)
ALTER TABLE trip_contracts ADD COLUMN IF NOT EXISTS contract_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_contracts_contract_number
  ON trip_contracts(contract_number)
  WHERE contract_number IS NOT NULL;
