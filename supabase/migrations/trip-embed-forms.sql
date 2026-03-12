-- Konfiguracja formularzy embedowalnych dla wyjazdów
CREATE TABLE IF NOT EXISTS trip_embed_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
  
  -- Klucz publiczny do identyfikacji formularza (krótki, URL-safe)
  public_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Customizacja formularza
  title TEXT, -- nadpisuje domyślny tytuł wyjazdu
  description TEXT, -- dodatkowy opis
  button_text TEXT DEFAULT 'Zapisz dziecko',
  success_message TEXT DEFAULT 'Dziękujemy za rejestrację! Skontaktujemy się wkrótce.',
  
  -- Pola do zebrania
  require_phone BOOLEAN DEFAULT true,
  require_child_birth_date BOOLEAN DEFAULT false,
  require_child_school BOOLEAN DEFAULT false,
  custom_fields JSONB DEFAULT '[]'::jsonb, -- [{label, type, required}]
  
  -- Limity
  max_registrations INTEGER, -- null = brak limitu
  current_registrations INTEGER DEFAULT 0,
  
  -- CORS - dozwolone domeny
  allowed_origins TEXT[], -- null = wszystkie
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embed_forms_trip ON trip_embed_forms(trip_id);
CREATE INDEX idx_embed_forms_key ON trip_embed_forms(public_key);

-- Zgłoszenia przez formularz embed
CREATE TABLE IF NOT EXISTS embed_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES trip_embed_forms(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  
  -- Dane rodzica
  parent_email TEXT NOT NULL,
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  parent_phone TEXT,
  
  -- Dane dziecka
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  child_birth_date DATE,
  child_school TEXT,
  
  -- Dodatkowe pola
  custom_field_values JSONB DEFAULT '{}'::jsonb,
  
  -- Status przetworzenia
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processed', 'duplicate', 'error')),
  processed_at TIMESTAMPTZ,
  
  -- Wyniki
  result_profile_id UUID REFERENCES profiles(id),
  result_participant_id UUID REFERENCES participants(id),
  result_registration_id UUID REFERENCES trip_registrations(id),
  
  -- Metadane
  source_origin TEXT, -- skąd przyszedł formularz
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embed_submissions_form ON embed_form_submissions(form_id);
CREATE INDEX idx_embed_submissions_email ON embed_form_submissions(parent_email);
CREATE INDEX idx_embed_submissions_status ON embed_form_submissions(status);

-- RLS - admin zarządza, publiczne submity przez API
ALTER TABLE trip_embed_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_embed_forms" ON trip_embed_forms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_embed_submissions" ON embed_form_submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger updated_at
CREATE TRIGGER update_embed_forms_updated_at
  BEFORE UPDATE ON trip_embed_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
