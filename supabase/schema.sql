-- ====================================
-- BiegunSport - Schemat bazy danych
-- ====================================

-- Włączenie rozszerzenia UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- TABELA: profiles
-- ====================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  secondary_email TEXT,
  secondary_phone TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ====================================
-- TABELA: participants (dzieci)
-- ====================================
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  height_cm INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_participants_parent ON participants(parent_id);
CREATE INDEX idx_participants_birth_date ON participants(birth_date);

-- ====================================
-- TABELA: custom_field_definitions
-- ====================================
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT UNIQUE NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  options JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_field_definitions_order ON custom_field_definitions(display_order);

-- ====================================
-- TABELA: participant_custom_fields
-- ====================================
CREATE TABLE participant_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, field_name)
);

CREATE INDEX idx_custom_fields_participant ON participant_custom_fields(participant_id);

-- ====================================
-- TABELA: groups
-- ====================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER,
  is_selectable_by_parent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_order ON groups(display_order);

-- ====================================
-- TABELA: participant_groups
-- ====================================
CREATE TABLE participant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID UNIQUE NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_participant_groups_participant ON participant_groups(participant_id);
CREATE INDEX idx_participant_groups_group ON participant_groups(group_id);

-- ====================================
-- TABELA: trips
-- ====================================
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  departure_datetime TIMESTAMPTZ NOT NULL,
  departure_location TEXT NOT NULL,
  return_datetime TIMESTAMPTZ NOT NULL,
  return_location TEXT NOT NULL,
  bank_account_pln TEXT DEFAULT '39 1240 1444 1111 0010 7170 4855',
  bank_account_eur TEXT DEFAULT 'PL21 1240 1444 1978 0010 7136 2778',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_departure ON trips(departure_datetime);

-- ====================================
-- TABELA: trip_groups
-- ====================================
CREATE TABLE trip_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(trip_id, group_id)
);

CREATE INDEX idx_trip_groups_trip ON trip_groups(trip_id);
CREATE INDEX idx_trip_groups_group ON trip_groups(group_id);

-- ====================================
-- TABELA: trip_payment_templates
-- ====================================
CREATE TABLE trip_payment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('installment', 'season_pass')),
  installment_number INTEGER,
  is_first_installment BOOLEAN DEFAULT FALSE,
  includes_season_pass BOOLEAN DEFAULT FALSE,
  category_name TEXT,
  birth_year_from INTEGER,
  birth_year_to INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PLN', 'EUR')),
  due_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_templates_trip ON trip_payment_templates(trip_id);
CREATE INDEX idx_payment_templates_type ON trip_payment_templates(payment_type);

-- ====================================
-- TABELA: trip_registrations
-- ====================================
CREATE TABLE trip_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  registered_by UUID NOT NULL REFERENCES profiles(id),
  registration_type TEXT NOT NULL CHECK (registration_type IN ('parent', 'admin')),
  is_outside_group BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, participant_id)
);

CREATE INDEX idx_registrations_trip ON trip_registrations(trip_id);
CREATE INDEX idx_registrations_participant ON trip_registrations(participant_id);
CREATE INDEX idx_registrations_status ON trip_registrations(status);

-- ====================================
-- TABELA: payments
-- ====================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES trip_registrations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES trip_payment_templates(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('installment', 'season_pass')),
  installment_number INTEGER,
  original_amount DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('PLN', 'EUR')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'partially_paid_overdue', 'cancelled')),
  paid_at TIMESTAMPTZ,
  payment_method_used TEXT CHECK (payment_method_used IN ('cash', 'transfer')),
  admin_notes TEXT,
  marked_by UUID REFERENCES profiles(id),
  discount_applied_by UUID REFERENCES profiles(id),
  discount_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_registration ON payments(registration_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);

-- ====================================
-- TABELA: payment_transactions
-- ====================================
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('PLN', 'EUR')),
  transaction_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_payment ON payment_transactions(payment_id);
CREATE INDEX idx_transactions_date ON payment_transactions(transaction_date);

-- ====================================
-- TABELA: notifications
-- ====================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('payment_reminder', 'new_trip', 'trip_update', 'custom')),
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'group', 'trip', 'individual')),
  target_group_id UUID REFERENCES groups(id),
  target_trip_id UUID REFERENCES trips(id),
  target_user_id UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- ====================================
-- TABELA: notification_logs
-- ====================================
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

CREATE INDEX idx_logs_notification ON notification_logs(notification_id);
CREATE INDEX idx_logs_recipient ON notification_logs(recipient_id);

-- ====================================
-- SEED DATA: Grupy
-- ====================================
INSERT INTO groups (name, description, display_order, is_selectable_by_parent) VALUES
  ('Beeski', 'Grupa dla początkujących narciarzy', 1, TRUE),
  ('ProKids', 'Grupa dla dzieci z podstawową umiejętnością jazdy', 2, TRUE),
  ('Hero', 'Grupa średniozaawansowana', 3, TRUE),
  ('SemiPRO', 'Grupa zaawansowana', 4, TRUE),
  ('PRO', 'Grupa profesjonalna', 5, TRUE);

-- ====================================
-- TRIGGER: Auto-tworzenie profilu
-- ====================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'parent'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ====================================
-- TRIGGER: Aktualizacja updated_at
-- ====================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
