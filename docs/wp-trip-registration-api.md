# BiegunSport — integracja formularza zapisów (WordPress)

Pełna dokumentacja dla developera WordPress integrującego formularz „Zapisz dziecko"
ze stroną BiegunSport.pl. Dokument jest samowystarczalny — nie wymaga dostępu
do aplikacji ani repo.

- Wersja: 2026-06-01
- Kontakt techniczny: Kamil Stepaniak <kamilstepaniak@gmail.com>
- Aplikacja produkcyjna: `https://bsapp.pro`

---

## 1. Jak to działa (z lotu ptaka)

1. W aplikacji BiegunSport admin tworzy wyjazd (obóz). Wyjazd ma unikalny UUID.
2. W WordPressie pod każdym wpisem obozu jest formularz „Zapisz dziecko".
3. Po wysłaniu formularza dane idą do publicznego API aplikacji
   (`https://bsapp.pro/api/public/trip-registrations-*`).
4. Aplikacja zapisuje zgłoszenie w kolejce **`pending`** — nic nie trafia
   automatycznie do CRM, kalendarza, kadry, finansów.
5. Admin BiegunSport otwiera panel, weryfikuje zgłoszenie i:
   - **Zatwierdza** → konto rodzica (magic link jeśli nowy), dziecko ląduje
     w CRM, zostaje zapisane na wyjazd, idzie standardowy mail rejestracyjny.
   - **Odrzuca** → status zmienia się na `rejected`. Rodzic nie dostaje
     żadnego maila.

WordPress **nie ma żadnego dostępu do bazy aplikacji**. Tylko jeden kierunek:
formularz → publiczny POST.

---

## 2. Dwie drogi integracji

| Wariant | Kto renderuje formularz | Klucz API | Style | Złożoność |
|---------|------------------------|-----------|-------|-----------|
| **A. Widget JS** (zalecane) | Aplikacja BiegunSport | nie wymagany | własne (neutralne) | minimalna |
| **B. Własny POST** | Ty (PHP/JS) | wymagany, server-side | jakie chcesz | większa |

Wybierz **A**, jeśli nie masz wymagań dot. wyglądu — to dwa wklejone wiersze
i działa. Wybierz **B**, jeśli formularz musi pasować pikselowo do reszty strony
albo masz custom UX (np. wieloetapowy wizard).

---

## 3. Wariant A — Widget JS

### 3.1. Kod do wklejenia w stronę WP

Każdy wpis obozu w WordPress dostaje (np. w bloku „HTML niestandardowy"
Gutenberga albo w edytorze HTML):

```html
<!-- Formularz zapisów BiegunSport — wyjazd <UUID> -->
<div data-bs-trip="<UUID>"></div>
<script src="https://bsapp.pro/embed/widget.js" async></script>
```

`<UUID>` to identyfikator konkretnego wyjazdu z aplikacji — admin BS przekazuje
go redaktorowi przy publikowaniu wpisu (albo jako custom field przy poście).

### 3.2. Co się dzieje po stronie rodzica

Widget:

1. Renderuje formularz w `<div data-bs-trip="...">` z polami:
   imię dziecka, nazwisko dziecka, data urodzenia, wzrost (cm),
   e-mail rodzica, telefon rodzica.
2. Po kliknięciu „Wyślij zgłoszenie" wysyła `POST` na
   `https://bsapp.pro/api/public/trip-registrations-widget`.
3. Pokazuje komunikat (zielony „Zgłoszenie przyjęte..." albo czerwony błąd).
4. Po sukcesie czyści pola.

### 3.3. Bezpieczeństwo wariantu A

Widget endpoint **nie wymaga klucza API** (klucz w przeglądarce zawsze
byłby do podkradnięcia). Zamiast tego:

- **Whitelista domen**: aplikacja akceptuje `POST` tylko z `Origin`
  na liście (env `WIDGET_ALLOWED_ORIGINS` w Vercel). Brak na liście → `403 origin_not_allowed`.
- **Flaga na wyjeździe**: admin musi w aplikacji zaznaczyć „Przyjmuj zgłoszenia z formularza WP".
  Bez tego nawet z dobrej domeny → `403 registrations_closed`.
- **Dedup**: ten sam wyjazd + email + imię + nazwisko + data urodzenia w stanie
  `pending` blokowany przez unique index — drugie kliknięcie zwraca ten sam
  request, nie tworzy duplikatu.
- **Moderacja**: wszystko ląduje jako `pending`. Bez kliknięcia admina nic
  nie trafia do CRM ani na mail.

Co musi zrobić właściciel aplikacji raz dla nowej domeny WP:

```
Vercel → Project Settings → Environment Variables
WIDGET_ALLOWED_ORIGINS = https://biegunsport.pl,https://www.biegunsport.pl
```

Można też wpisać wildcard subdomeny: `*.biegunsport.pl`.

### 3.4. Co konfiguruje deweloper WP

Po stronie WordPress:

1. Dodaj custom field do wpisów obozu, np. `bs_trip_id` (UUID).
2. W template wpisu wpleć blok HTML z widgetem, podstawiając UUID z custom field:
   ```php
   <?php $bs_uuid = get_field('bs_trip_id'); if ($bs_uuid): ?>
     <div data-bs-trip="<?php echo esc_attr($bs_uuid); ?>"></div>
     <script src="https://bsapp.pro/embed/widget.js" async></script>
   <?php endif; ?>
   ```
3. Pokaż formularz tylko gdy UUID jest uzupełniony (jak wyżej).
   Aplikacja i tak odrzuci `404 trip_not_found` dla nieistniejących UUID,
   ale lepsza UX gdy formularz w ogóle się nie pojawia.

Dla każdego nowego obozu jedyna czynność redaktora WP: wkleić UUID w custom field.

---

## 4. Wariant B — Własny POST z kluczem API

Dla pełnej kontroli nad HTML/CSS/UX. Klucz API musi siedzieć
**wyłącznie po stronie serwera WP** (np. `wp-config.php`, opcja motywu,
Code Snippets) — nigdy w plikach JS dostarczanych do przeglądarki.

### 4.1. Endpoint

```
POST https://bsapp.pro/api/public/trip-registrations
Headers:
  Content-Type: application/json
  x-api-key: <WP_INTAKE_API_KEY>
```

Klucz `WP_INTAKE_API_KEY` dostarcza admin BiegunSport (jeden klucz dla całej
strony WP, można rotować w razie potrzeby).

### 4.2. Body (JSON)

```json
{
  "trip_id": "550e8400-e29b-41d4-a716-446655440000",
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

### 4.3. Walidacja po stronie aplikacji

| Pole | Reguła |
|------|--------|
| `trip_id` | UUID v4 |
| `child.first_name`, `child.last_name` | string, 2-50 znaków, trimmed |
| `child.birth_date` | string `YYYY-MM-DD` |
| `child.height_cm` | integer 50-250 lub `null`/pominięte |
| `parent.email` | poprawny email, max 120 znaków |
| `parent.phone` | string, 6-30 znaków, trimmed |

Walidacja schematem Zod po stronie serwera. Naruszenie → `400 validation_failed`
z polem `details` (lista konkretnych błędów).

### 4.4. Odpowiedzi

| Kod | Body | Znaczenie |
|-----|------|-----------|
| `201` | `{ "id": "uuid", "status": "pending" }` | Przyjęte, czeka na moderację |
| `200` | `{ "id": "uuid", "status": "pending", "deduped": true }` | Identyczne `pending` już istniało |
| `400` | `{ "error": "invalid_json" }` | Body nie jest poprawnym JSON |
| `400` | `{ "error": "validation_failed", "details": [...] }` | Naruszenie schematu |
| `401` | `{ "error": "unauthorized" }` | Brak / zły `x-api-key` |
| `403` | `{ "error": "registrations_closed" }` | Wyjazd nie przyjmuje zgłoszeń |
| `404` | `{ "error": "trip_not_found" }` | UUID nie istnieje w bazie |
| `500` | `{ "error": "db_error" }` | Błąd po stronie aplikacji — retry |

### 4.5. Przykład PHP (WordPress)

```php
function bs_submit_trip_registration($payload) {
  $key = defined('BS_INTAKE_API_KEY') ? BS_INTAKE_API_KEY : '';
  if (!$key) return new WP_Error('config', 'Brak klucza API');

  $res = wp_remote_post('https://bsapp.pro/api/public/trip-registrations', [
    'headers' => [
      'Content-Type' => 'application/json',
      'x-api-key'    => $key,
    ],
    'body'    => wp_json_encode($payload),
    'timeout' => 15,
  ]);

  if (is_wp_error($res)) return $res;
  $code = wp_remote_retrieve_response_code($res);
  $body = json_decode(wp_remote_retrieve_body($res), true);

  if ($code === 201 || $code === 200) return ['ok' => true, 'data' => $body];
  return ['ok' => false, 'code' => $code, 'data' => $body];
}
```

Klucz w `wp-config.php`:

```php
define('BS_INTAKE_API_KEY', 'wklej-klucz-od-admina-bs');
```

### 4.6. Idempotencja

Dla tego samego `trip_id` + `parent.email` + `child.first_name` +
`child.last_name` + `child.birth_date` w stanie `pending` aplikacja zwraca
ten sam `id` z polem `deduped: true` zamiast tworzyć duplikat. Traktuj
zwrot `200 + deduped` jak sukces — pokaż rodzicowi „zgłoszenie już zostało
przyjęte, czekaj na potwierdzenie".

Po zatwierdzeniu albo odrzuceniu wpisu blokada znika — kolejne identyczne
zgłoszenie ponownie utworzy `pending`.

---

## 5. Pola formularza — wytyczne UX

| Pole | Typ HTML | Walidacja klienta | Uwagi |
|------|----------|------------------|-------|
| Imię dziecka | `text` | `required minlength=2 maxlength=50` | Tylko imię, bez nazwiska |
| Nazwisko dziecka | `text` | `required minlength=2 maxlength=50` | |
| Data urodzenia | `date` | `required` | Format ISO `YYYY-MM-DD` (Date picker) |
| Wzrost (cm) | `number` | `required min=50 max=250 step=1` | Do oszacowania rozmiarów odzieży |
| Email rodzica | `email` | `required maxlength=120 autocomplete=email` | Konto rodzica będzie założone na ten adres |
| Telefon rodzica | `tel` | `required minlength=6 maxlength=30 autocomplete=tel` | Format dowolny, sugestia `+48...` |

Dodatkowo:

- Przycisk submit z trzema stanami: domyślny → „Wysyłam..." (disabled) → po sukcesie reset.
- Komunikat sukcesu (zielona ramka): „Zgłoszenie przyjęte. Po zatwierdzeniu
  przez admina otrzymasz mail z potwierdzeniem."
- Komunikat błędu (czerwona ramka): treść zależna od kodu (patrz tabela 4.4).
- Stopka RODO: „Wysyłając formularz akceptujesz, że BiegunSport będzie
  kontaktował się z tobą w sprawie tego zgłoszenia."

Widget z wariantu A robi to wszystko sam. Wariant B — zaimplementuj sobie.

---

## 6. Mapowanie błędów na komunikaty dla rodzica

| Kod / `error` | Co pokazać rodzicowi |
|--------------|----------------------|
| `201` / `200 deduped` | „Zgłoszenie przyjęte. Po zatwierdzeniu przez admina otrzymasz mail z potwierdzeniem." |
| `403 registrations_closed` | „Zapisy na ten wyjazd są obecnie zamknięte." |
| `403 origin_not_allowed` (tylko wariant A) | „Formularz nie jest skonfigurowany dla tej domeny. Skontaktuj się z administratorem." |
| `404 trip_not_found` | „Nie znaleziono wyjazdu. Skontaktuj się z administratorem." |
| `400 validation_failed` | „Sprawdź poprawność danych w formularzu." + opcjonalnie pokaż błędy z `details` |
| `400 invalid_json` | „Coś poszło nie tak. Spróbuj ponownie." (nie powinno się zdarzyć przy poprawnym kliencie) |
| `401 unauthorized` (tylko wariant B) | „Konfiguracja serwera niepoprawna. Skontaktuj się z administratorem." (zaloguj po stronie WP) |
| `500 db_error` lub timeout | „Wystąpił błąd zapisu. Spróbuj ponownie za chwilę." |
| brak połączenia / network error | „Brak połączenia z serwerem. Spróbuj ponownie." |

---

## 7. Co się dzieje po zatwierdzeniu (informacyjnie)

Po kliknięciu „Zatwierdź" w panelu admina:

1. Sprawdzenie czy konto rodzica z tym e-mailem już istnieje.
   - Nie istnieje → tworzone w stanie „zaproszony", rodzic dostaje
     **magic link** do ustawienia hasła.
2. Tworzony rekord dziecka w bazie uczestników, grupa „Bez kategorii".
3. Tworzony rekord zapisu na wyjazd (jak gdyby zapisał admin z panelu).
4. Wysyłany **standardowy mail rejestracyjny** z systemowego szablonu BS.
5. Status requesta zmienia się na `approved`, zapisuje się `processed_by` + `processed_at`.

Te kroki dzieją się synchronicznie po stronie aplikacji — nie wymagają nic
od WordPressa.

---

## 8. Limity, retry, monitoring

- **Limit body**: 1 MB (wystarczy z zapasem).
- **Timeout**: domyślny Vercel, ok. 10 s. W praktyce odpowiedź < 1 s.
- **Retry**: jeśli dostaniesz `500` lub network error — można powtórzyć ten sam
  request. Idempotencja chroni przed duplikatami.
- **Rate limit**: brak twardego limitu. Przy realnym ataku admin może wyłączyć
  flagę `registration_form_enabled` na wyjeździe w sekundę.
- **Logi**: aplikacja loguje błędy do Vercel Runtime Logs (admin BS ma do nich
  dostęp). Po stronie WP zaloguj odpowiedzi `4xx/5xx` żeby ułatwić diagnostykę.

---

## 9. Smoke test po wdrożeniu

Najszybszy sprawdzian, że integracja działa, bez tworzenia formularza:

### Wariant A (widget)

Otwórz stronę WP z wklejonym snippetem. W konsoli przeglądarki nie powinno być
błędów CORS. Wypełnij i wyślij — sukces zielony.

### Wariant B (direct POST)

```bash
curl -i -X POST https://bsapp.pro/api/public/trip-registrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WP_INTAKE_API_KEY" \
  -d '{
    "trip_id": "<UUID-WYJAZDU>",
    "child":  { "first_name": "Test", "last_name": "Smoke",
                "birth_date": "2015-06-01", "height_cm": 140 },
    "parent": { "email": "twoj+smoke@example.com", "phone": "+48500600700" }
  }'
```

Oczekiwane: `HTTP/2 201` + JSON z `id` i `status: "pending"`. Admin BS
zobaczy wpis w `/admin/registrations` w sekcji „Oczekujące".

---

## 10. FAQ

**Q: Czy mogę pobierać z aplikacji aktualną cenę / daty wyjazdu?**
A: Obecnie nie. Endpoint `GET` na trip jest zaplanowany, ale jeszcze
nieaktywny. Cenę i daty wpisujesz ręcznie we wpisie WP. Jak będzie potrzeba —
dorobimy `GET /api/public/trips/<uuid>` zwracający `{title, dates, price, is_open}`.

**Q: Czy formularz może mieć więcej pól (np. uwagi, alergie)?**
A: Tak, ale wymaga rozszerzenia schematu po stronie aplikacji. Daj znać —
dorzucimy `child.notes` lub `child.allergies` jako opcjonalne.

**Q: Czy mogę pokazać liczbę wolnych miejsc?**
A: Nie z bieżącego endpointu. Wymaga rozszerzenia o `GET /api/public/trips/<uuid>`
z liczbą zatwierdzonych zapisów.

**Q: Co jeśli rodzic poda inny mail niż ten, na którym ma już konto?**
A: Aplikacja założy drugie konto na nowym mailu. Admin BS może to wykryć
w `/admin/participants` po nazwisku dziecka i ręcznie scalić — to procedura
admina, nie problem WP.

**Q: Co po wyłączeniu zapisów na wyjeździe?**
A: Aplikacja zwraca `403 registrations_closed`. Pokaż rodzicowi czytelny
komunikat. Jeśli chcesz, możesz dodatkowo ukryć przycisk „Zapisz dziecko"
przy wpisie — ale aplikacja jest źródłem prawdy.

**Q: Czy klucz API mogę commitować do repo WP?**
A: Nie. Trzymaj w `wp-config.php` (poza repo) albo w opcji motywu.
W razie wycieku — poproś admina BS o rotację.

---

## 11. Checklist wdrożenia (deweloper WP)

- [ ] Dostałem od admina BS:
  - [ ] adres aplikacji: `https://bsapp.pro`
  - [ ] (wariant B) klucz `WP_INTAKE_API_KEY`
  - [ ] potwierdzenie, że domena WP jest na `WIDGET_ALLOWED_ORIGINS` (wariant A)
- [ ] Dodałem custom field `bs_trip_id` do typu wpisu „Obóz" (UUID).
- [ ] W template wpisu wpięty snippet widgetu (wariant A) albo własny formularz
      z handlerem PHP (wariant B).
- [ ] Smoke test z prawdziwego wpisu — sukces zielony.
- [ ] Smoke test z błędem (np. wyłączone zapisy) — sensowny komunikat.
- [ ] Rodzic pokazany w `/admin/registrations` po stronie admina BS.
- [ ] Po zatwierdzeniu przez admina test-rodzic dostaje mail (rejestracja
      + ewentualnie magic link).

---

## 12. Kontrakt techniczny w skrócie (cheat sheet)

```
POST https://bsapp.pro/api/public/trip-registrations-widget
  (wariant A — widget, bez klucza, wymaga Origin z whitelisty)

POST https://bsapp.pro/api/public/trip-registrations
  (wariant B — własny POST, z naglowkiem x-api-key)

Body JSON:
{
  "trip_id": "<UUID>",
  "child":  { "first_name", "last_name", "birth_date", "height_cm?" },
  "parent": { "email", "phone" }
}

201 → przyjete
200 deduped → przyjete wczesniej, ten sam id
400 / 401 / 403 / 404 → blad walidacji/uprawnien
500 → retry
```

Koniec. Pytania techniczne — kontakt do admina BS.
