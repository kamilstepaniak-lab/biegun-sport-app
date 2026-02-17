-- ====================================
-- BiegunSport - Row Level Security Policies
-- ====================================

-- ====================================
-- WŁĄCZENIE RLS
-- ====================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_payment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- ====================================
-- FUNKCJA POMOCNICZA: is_admin
-- ====================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- POLITYKI: profiles
-- ====================================
-- Użytkownik może czytać swój profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Użytkownik może aktualizować swój profil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin może wszystko
CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: participants
-- ====================================
-- Rodzic widzi tylko swoje dzieci
CREATE POLICY "Parents can view own children"
  ON participants FOR SELECT
  USING (parent_id = auth.uid() OR is_admin());

-- Rodzic może dodawać swoje dzieci
CREATE POLICY "Parents can insert own children"
  ON participants FOR INSERT
  WITH CHECK (parent_id = auth.uid() OR is_admin());

-- Rodzic może edytować swoje dzieci
CREATE POLICY "Parents can update own children"
  ON participants FOR UPDATE
  USING (parent_id = auth.uid() OR is_admin());

-- Rodzic może usuwać swoje dzieci
CREATE POLICY "Parents can delete own children"
  ON participants FOR DELETE
  USING (parent_id = auth.uid() OR is_admin());

-- ====================================
-- POLITYKI: participant_custom_fields
-- ====================================
CREATE POLICY "Users can manage own children custom fields"
  ON participant_custom_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id AND (p.parent_id = auth.uid() OR is_admin())
    )
  );

-- ====================================
-- POLITYKI: participant_groups
-- ====================================
CREATE POLICY "Users can view own children groups"
  ON participant_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id AND (p.parent_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can manage own children groups"
  ON participant_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id AND (p.parent_id = auth.uid() OR is_admin())
    )
  );

-- ====================================
-- POLITYKI: groups
-- ====================================
-- Wszyscy zalogowani mogą czytać grupy
CREATE POLICY "Authenticated users can view groups"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

-- Tylko admin może zarządzać grupami
CREATE POLICY "Admins can manage groups"
  ON groups FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: trips
-- ====================================
-- Wszyscy zalogowani mogą czytać opublikowane wyjazdy
CREATE POLICY "Users can view published trips"
  ON trips FOR SELECT
  USING (status = 'published' OR is_admin());

-- Tylko admin może zarządzać wyjazdami
CREATE POLICY "Admins can manage trips"
  ON trips FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: trip_groups
-- ====================================
CREATE POLICY "Users can view trip groups"
  ON trip_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage trip groups"
  ON trip_groups FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: trip_payment_templates
-- ====================================
CREATE POLICY "Users can view payment templates"
  ON trip_payment_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payment templates"
  ON trip_payment_templates FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: trip_registrations
-- ====================================
-- Rodzic widzi zapisy swoich dzieci
CREATE POLICY "Parents can view own children registrations"
  ON trip_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id AND p.parent_id = auth.uid()
    ) OR is_admin()
  );

-- Rodzic może zapisywać swoje dzieci
CREATE POLICY "Parents can register own children"
  ON trip_registrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = participant_id AND p.parent_id = auth.uid()
    ) OR is_admin()
  );

-- Tylko admin może aktualizować i usuwać
CREATE POLICY "Admins can manage registrations"
  ON trip_registrations FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: payments
-- ====================================
-- Rodzic widzi płatności swoich dzieci
CREATE POLICY "Parents can view own children payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_registrations tr
      JOIN participants p ON tr.participant_id = p.id
      WHERE tr.id = registration_id AND p.parent_id = auth.uid()
    ) OR is_admin()
  );

-- Tylko admin może zarządzać płatnościami
CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: payment_transactions
-- ====================================
-- Rodzic widzi transakcje swoich dzieci
CREATE POLICY "Parents can view own children transactions"
  ON payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payments pm
      JOIN trip_registrations tr ON pm.registration_id = tr.id
      JOIN participants p ON tr.participant_id = p.id
      WHERE pm.id = payment_id AND p.parent_id = auth.uid()
    ) OR is_admin()
  );

-- Tylko admin może zarządzać transakcjami
CREATE POLICY "Admins can manage transactions"
  ON payment_transactions FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: notifications
-- ====================================
CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: notification_logs
-- ====================================
CREATE POLICY "Admins can manage notification logs"
  ON notification_logs FOR ALL
  USING (is_admin());

-- ====================================
-- POLITYKI: custom_field_definitions
-- ====================================
CREATE POLICY "Users can view custom field definitions"
  ON custom_field_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage custom field definitions"
  ON custom_field_definitions FOR ALL
  USING (is_admin());
