-- Migracja: Tabela szablonów e-maili
-- Uruchom w Supabase SQL Editor (projekt → SQL Editor → New query)

-- 1. Utwórz tabelę (jeśli nie istnieje)
CREATE TABLE IF NOT EXISTS email_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  variables  JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: tylko adminowie mogą odczytywać i modyfikować szablony
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read email templates"  ON email_templates;
DROP POLICY IF EXISTS "Admins can update email templates" ON email_templates;

CREATE POLICY "Admins can read email templates"
  ON email_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 2. Wstaw domyślne szablony (nie nadpisuj istniejących)
INSERT INTO email_templates (id, name, subject, body_html, variables) VALUES

('welcome',
 'Powitalny',
 'Witaj w BiegunSport! 🎿',
 '<h2>Witaj, {{imie}}! 👋</h2><p>Twoje konto zostało pomyślnie utworzone. Możesz teraz dodać swoje dziecko i zapisać je na wyjazd narciarski.</p><p>W razie pytań skontaktuj się z nami: <strong>biuro@biegunsport.pl</strong></p>',
 '[{"key":"{{imie}}","desc":"Imię rodzica"}]'::jsonb),

('trip_info',
 'Info o wyjeździe',
 '{{wyjazd}} – informacja o wyjeździe',
 '<h2>Informacja o wyjeździe 🏔️</h2><p>Szanowni Rodzice,</p><p>Przekazujemy informacje o planowanym wyjeździe <strong>{{wyjazd}}</strong>.</p>{{szczegoly_wyjazdu}}<p>W razie pytań prosimy o kontakt: <strong>biuro@biegunsport.pl</strong></p><p>Pozdrawiamy,<br><strong>Zespół BiegunSport</strong></p>',
 '[{"key":"{{wyjazd}}","desc":"Tytuł wyjazdu"},{"key":"{{szczegoly_wyjazdu}}","desc":"Blok z terminami i płatnościami (generowany automatycznie)"}]'::jsonb),

('registration',
 'Potwierdzenie zapisu',
 '{{wyjazd}} – potwierdzenie zapisu',
 '<h2>Potwierdzenie zapisu ✅</h2><p>Cześć {{imie}},</p><p><strong>{{dziecko}}</strong> został/a pomyślnie zapisany/a na wyjazd <strong>{{wyjazd}}</strong>.</p>{{szczegoly_wyjazdu}}<p>W razie pytań skontaktuj się z nami: <strong>biuro@biegunsport.pl</strong></p>',
 '[{"key":"{{imie}}","desc":"Imię rodzica"},{"key":"{{dziecko}}","desc":"Imię i nazwisko dziecka"},{"key":"{{wyjazd}}","desc":"Tytuł wyjazdu"},{"key":"{{szczegoly_wyjazdu}}","desc":"Blok z terminami i płatnościami"}]'::jsonb),

('payment_confirmed',
 'Płatność potwierdzona',
 '✅ Płatność przyjęta — {{wyjazd}}',
 '<h2>Płatność potwierdzona ✅</h2><p>Cześć {{imie}},</p><p>Płatność dla <strong>{{dziecko}}</strong> została zarejestrowana w systemie.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#16a34a;">{{kwota}} {{waluta}} — opłacone</p><p>Dziękujemy!</p>',
 '[{"key":"{{imie}}","desc":"Imię rodzica"},{"key":"{{dziecko}}","desc":"Imię i nazwisko dziecka"},{"key":"{{wyjazd}}","desc":"Tytuł wyjazdu"},{"key":"{{rodzaj_platnosci}}","desc":"Np. Rata 1, Karnet"},{"key":"{{kwota}}","desc":"Kwota"},{"key":"{{waluta}}","desc":"PLN lub EUR"}]'::jsonb),

('payment_reminder',
 'Przypomnienie o płatności',
 '⏰ Przypomnienie o płatności — {{wyjazd}}',
 '<h2>Przypomnienie o płatności ⏰</h2><p>Cześć {{imie}},</p><p>Przypominamy o zbliżającym się terminie płatności dla <strong>{{dziecko}}</strong>.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p style="font-size:20px;font-weight:bold;color:#ea580c;">{{kwota}} {{waluta}}</p><p>Termin płatności: <strong>{{termin}}</strong></p><p>W razie pytań prosimy o kontakt.</p>',
 '[{"key":"{{imie}}","desc":"Imię rodzica"},{"key":"{{dziecko}}","desc":"Imię i nazwisko dziecka"},{"key":"{{wyjazd}}","desc":"Tytuł wyjazdu"},{"key":"{{rodzaj_platnosci}}","desc":"Np. Rata 1, Karnet"},{"key":"{{kwota}}","desc":"Kwota"},{"key":"{{waluta}}","desc":"PLN lub EUR"},{"key":"{{termin}}","desc":"Data terminu płatności"}]'::jsonb)

ON CONFLICT (id) DO NOTHING;
