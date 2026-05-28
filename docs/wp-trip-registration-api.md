# WP -> aplikacja: API zgloszen na wyjazd

Kontrakt dla developera WordPress: jak wyslac zgloszenie dziecka z formularza
"Zapisz dziecko" do aplikacji BiegunSport.

Sa DWIE drogi integracji — wybierz jedna:

- **A) Widget JS (zalecane, najprostsze)** — wklejasz gotowy snippet w strone WP.
  Aplikacja sama renderuje formularz, sama wysyla zgloszenie. Zero kodu po stronie WP.
- **B) Wlasny formularz + bezposredni POST** — robisz wlasny HTML i sam wysylasz
  request do endpointu. Wymaga klucza API trzymanego po stronie serwera WP (PHP).

---

## A) Widget JS

W panelu admina na karcie wyjazdu (sekcja "Zapisy zewnetrzne (WordPress)") jest
gotowy snippet do skopiowania:

```html
<div data-bs-trip="UUID-WYJAZDU"></div>
<script src="https://<app-domena>/embed/widget.js" async></script>
```

Wklej w "HTML niestandardowy" w Gutenbergu albo w edytorze HTML wpisu wyjazdu.
Widget sam wyrenderuje formularz, sam wysle zgloszenie, sam pokaze komunikat.

Wymagania konfiguracji (admin aplikacji ustawia w Vercel ENV):

- `WIDGET_ALLOWED_ORIGINS` — lista domen z prawem korzystania z widgetu, po przecinku.
  Np. `https://biegunsport.pl,https://www.biegunsport.pl`.
  Mozna uzyc wildcard subdomeny: `*.biegunsport.pl`.
  Bez tego widget zwraca `origin_not_allowed`.

Klucz API NIE jest tu potrzebny — endpoint widgetu chroni Origin + flaga
`registration_form_enabled` na wyjezdzie + moderacja admina.

Endpoint pod spodem: `POST /api/public/trip-registrations-widget`.
Schemat body identyczny jak w wariancie B.

---

## B) Wlasny POST z kluczem API

## Endpoint

`POST https://<app-domain>/api/public/trip-registrations`

## Naglowki

- `Content-Type: application/json`
- `x-api-key: <WP_INTAKE_API_KEY>` — sekret ustalony z adminem aplikacji

## Body (JSON)

```json
{
  "trip_id": "UUID wyjazdu z aplikacji (custom field przy wpisie WP)",
  "child": {
    "first_name": "Jan",
    "last_name":  "Kowalski",
    "birth_date": "2015-06-01",
    "height_cm":  140
  },
  "parent": {
    "email": "rodzic@example.com",
    "phone": "+48500600700"
  }
}
```

### Walidacja

- `trip_id` — UUID
- `child.first_name`, `child.last_name` — 2-50 znakow
- `child.birth_date` — format `YYYY-MM-DD`
- `child.height_cm` — liczba 50-250 lub `null`/pominiete
- `parent.email` — poprawny email, max 120 znakow
- `parent.phone` — 6-30 znakow

## Odpowiedzi

| Kod | Body | Znaczenie |
|-----|------|-----------|
| 201 | `{ "id": "...", "status": "pending" }` | Przyjete, oczekuje moderacji |
| 200 | `{ "id": "...", "status": "pending", "deduped": true }` | Identyczne pending juz istnialo |
| 400 | `{ "error": "validation_failed", "details": [...] }` | Bledne body |
| 401 | `{ "error": "unauthorized" }` | Brak/zly klucz API |
| 403 | `{ "error": "registrations_closed" }` | Wyjazd nie przyjmuje zgloszen |
| 404 | `{ "error": "trip_not_found" }` | Nie ma wyjazdu o tym UUID |
| 500 | `{ "error": "db_error" }` | Blad po stronie serwera — sprobuj ponownie |

## Zachowanie

- Endpoint NIGDY nie tworzy konta rodzica ani uczestnika bezposrednio.
- Wpis ladunie w kolejce `trip_registration_requests` (status `pending`).
- Admin moderuje w `/admin/registrations`.
- Po zatwierdzeniu:
  - rodzic dostaje mail rejestracyjny (standardowy szablon aplikacji),
  - jesli rodzic nie mial konta — dostaje takze magic link do ustawienia hasla,
  - dziecko trafia do CRM jako "Bez kategorii" i zostaje zapisane na wyjazd.

## Konfiguracja po stronie WordPress

1. Przy kazdym wpisie wyjazdu trzymaj custom field `bs_trip_id` z UUID skopiowanym
   z karty wyjazdu w aplikacji (sekcja "Zapisy zewnetrzne (WordPress)").
2. Formularz "Zapisz dziecko" wysyla POST z body jak wyzej (UUID = wartosc tego custom field).
3. Klucz API trzymany w konfiguracji WP (np. opcja motywu / wp-config), nigdy w kodzie
   widocznym dla przegladarki.
4. Przycisk "Zapisz dziecko" pokazuj tylko wtedy, gdy redaktor uzupelnil UUID.
   Aplikacja i tak odrzuca zgloszenia bez wlaczonej flagi `registration_form_enabled`,
   ale to dodatkowe zabezpieczenie po stronie strony.

## Idempotencja

Dla tego samego `trip_id` + `parent.email` + `child.first_name` + `child.last_name` +
`child.birth_date` w stanie `pending` aplikacja zwroci ten sam `id` zamiast tworzyc duplikat.
Po zatwierdzeniu/odrzuceniu blokada znika — kolejne zgloszenie z tymi samymi danymi
trafi jako nowy wiersz.
