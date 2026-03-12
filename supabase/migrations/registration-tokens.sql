-- Tokeny do potwierdzania zapisów przez email (bez logowania)
CREATE TABLE IF NOT EXISTS registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Dane rodzica (email jest kluczem do znalezienia/stworzenia konta)
  parent_email TEXT NOT NULL,
  parent_first_name TEXT,
  parent_last_name TEXT,
  parent_phone TEXT,
  
  -- Dane dziecka
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  participant_name TEXT, -- fallback jeśli participant_id jeszcze nie istnieje
  
  -- Dane wyjazdu
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  
  -- Typ akcji
  action TEXT NOT NULL CHECK (action IN ('confirm', 'decline', 'register')),
  -- 'confirm'  = rodzic potwierdza że dziecko jedzie (już jest w bazie)
  -- 'decline'  = rodzic odwołuje
  -- 'register' = nowy zapis (spoza bazy)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  used_at TIMESTAMPTZ,
  
  -- Metadane
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  sent_by UUID REFERENCES profiles(id), -- admin który wysłał
  
  -- Wynik akcji
  result_registration_id UUID REFERENCES trip_registrations(id),
  result_profile_id UUID REFERENCES profiles(id)
);

CREATE INDEX idx_reg_tokens_token ON registration_tokens(token);
CREATE INDEX idx_reg_tokens_email ON registration_tokens(parent_email);
CREATE INDEX idx_reg_tokens_trip ON registration_tokens(trip_id);
CREATE INDEX idx_reg_tokens_status ON registration_tokens(status);

-- RLS
ALTER TABLE registration_tokens ENABLE ROW LEVEL SECURITY;

-- Admin może wszystko
CREATE POLICY "admin_all_reg_tokens" ON registration_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Publiczny odczyt tokenu (bez logowania) — przez API route z service key
-- Nie dajemy dostępu anonimowego do tabeli, obsługujemy przez API z service role key
