-- Migracja: przepisanie szablonów płatności na style oparte na <span>
-- Uruchom w Supabase SQL Editor.
--
-- Powód: edytor TipTap przechowuje kolor i rozmiar tekstu jako znacznik
-- inline (<span style="...">). Style umieszczone na <p>/<h2> były usuwane
-- przy pierwszym zapisie szablonu w panelu. Po tej migracji kolory są
-- zapisane w formie, którą edytor zachowuje bez utraty.

UPDATE email_templates
SET body_html = '<h2>Płatność potwierdzona ✅</h2><p>Cześć {{imie}},</p><p>Płatność dla <strong>{{dziecko}}</strong> została zarejestrowana w systemie.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p><span style="font-size: 20px; color: #16a34a"><strong>{{kwota}} {{waluta}} — opłacone</strong></span></p><p>Dziękujemy!</p>',
    updated_at = NOW()
WHERE id = 'payment_confirmed';

UPDATE email_templates
SET body_html = '<h2>Przypomnienie o płatności ⏰</h2><p>Cześć {{imie}},</p><p>Przypominamy o zbliżającym się terminie płatności dla <strong>{{dziecko}}</strong>.</p><p><strong>{{wyjazd}}</strong> · {{rodzaj_platnosci}}</p><p><span style="font-size: 20px; color: #ea580c"><strong>{{kwota}} {{waluta}}</strong></span></p><p>Termin płatności: <strong>{{termin}}</strong></p><p>W razie pytań prosimy o kontakt.</p>',
    updated_at = NOW()
WHERE id = 'payment_reminder';
