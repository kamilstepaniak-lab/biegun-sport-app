-- ════════════════════════════════════════════════════════════════════════════
-- KRYTYCZNA POPRAWKA BEZPIECZEŃSTWA — eskalacja uprawnień
-- ════════════════════════════════════════════════════════════════════════════
-- Problem: polityka UPDATE na tabeli `profiles` pozwalała zalogowanemu rodzicowi
-- zmienić dowolną kolumnę własnego wiersza — w tym `role`. Wykonanie
--   UPDATE profiles SET role = 'admin' WHERE id = auth.uid()
-- kończyło się sukcesem. Ponieważ is_admin() oraz polityki "Admins can manage…"
-- czytają profiles.role, rodzic uzyskiwał pełny dostęp administracyjny.
--
-- Potwierdzone empirycznie 2026-05-17.
--
-- UWAGA: ograniczenia kolumnowe (REVOKE UPDATE(role)) nie działają, gdy rola ma
-- uprawnienie UPDATE na całej tabeli — dlatego stosujemy trigger.
--
-- Uruchom w Supabase → SQL Editor.

-- 1) Trigger blokujący zmianę kolumn `role` i `id` przez zwykłych użytkowników.
--    Dozwolone tylko dla: service role (backend/panel) lub zalogowanego admina.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id)
     AND jwt_role <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Zmiana pola role/id jest niedozwolona';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 2) Defense-in-depth: WITH CHECK na polityce UPDATE — użytkownik może zapisać
--    wyłącznie własny wiersz (poprzednia wersja nie miała WITH CHECK).
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
