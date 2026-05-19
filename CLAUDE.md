# CLAUDE.md

Wskazówki dla Claude przy pracy nad projektem `biegun-sport-app`
(Next.js App Router + Supabase + Vercel).

## Sposób pracy

- Pracuj **bezpośrednio na gałęzi `main`** — nie twórz nowych branchy.
  Nowy branch utwórz tylko gdy użytkownik wyraźnie o to poprosi na początku
  danego czatu.
- Na końcu każdego zadania w czacie **zapytaj użytkownika, czy zrobić push
  na `main` / wdrożenie na Vercel** — nie pushuj bez potwierdzenia.

## Baza danych i migracje

- Migracje to zwykłe pliki `.sql` w `supabase/migrations/`.
- **Nie są uruchamiane automatycznie** — każdą nową migrację użytkownik musi
  ręcznie wykonać na bazie Supabase.
- Po dodaniu kolumny lub tabeli, od której zależy kod (np. nowe pole w
  INSERT/UPDATE), zawsze **wyraźnie ostrzeż użytkownika**, że musi uruchomić
  migrację — inaczej powiązana funkcja przestanie działać do czasu jej wykonania.

## Wdrożenie (Vercel)

- Projekt ma integrację Vercel ↔ GitHub.
- Push dowolnej gałęzi → automatyczny **deployment preview** (nie trzeba
  niczego deployować ręcznie).
- **Produkcja wdrażana jest wyłącznie z gałęzi `main`.**
- Pracujemy bezpośrednio na `main` — push na `main` = automatyczny build
  produkcji. Pushuj dopiero po potwierdzeniu przez użytkownika.
- Jeśli zmiany wymagają migracji bazy — migracja musi być uruchomiona, zanim
  produkcja zostanie zbudowana.

## Notatki z sesji

Za każdym razem, gdy użytkownik prosi o wdrożenie / push na Vercel, dopisz
poniżej krótką notatkę z najważniejszymi zmianami wprowadzonymi w danej sesji
(nagłówek z datą, najnowsze wpisy na górze).

### 2026-05-19 (Szablony e-maili)

- `/admin/settings/email-templates`: naprawiony krytyczny błąd escapowania
  `{{szczegoly_wyjazdu}}` w `email.ts` (`RAW_HTML_KEYS`) — maile registration /
  trip_info renderowały surowy HTML zamiast tabel.
- Edytor TipTap rozbudowany o `TextStyleKit` (kolor tekstu, rozmiar),
  podkreślenie, link — zapis nie gubi już formatowania. Nowa zależność
  `@tiptap/extension-text-style`.
- Migracja `email-templates-span-styles.sql` — przepisuje szablony płatności
  na style `<span>` (do ręcznego uruchomienia na Supabase).
- Walidacja pustego tematu/treści, data ostatniej zmiany, poprawiony
  „Przywróć zapisaną", przycisk „Wyślij test do siebie".
- Podgląd z dwoma trybami: „Szablon roboczy" i „Z przykładowymi danymi"
  (renderowany jak prawdziwy mail w sandboxowanym iframe) — akcja
  `previewEmailTemplate` + `renderSampleEmail`.
- Pod każdym szablonem opis „kiedy wychodzi" (trigger wysyłki).

### 2026-05-18 (Umowy / PDF)

- `/admin/contracts`: generowanie umów do PDF serwerowo (`@react-pdf/renderer`,
  font DejaVu Sans w `public/fonts/`). Nowy endpoint `/api/contracts/[id]/pdf`
  — PDF powstaje na żądanie, nic nie jest zapisywane. Usunięty martwy print-CSS.
- Kolumny „Podgląd" + „Pobierz" połączone w jedną „Akcje".
- Archiwizacja umów: `deleteContractsAdmin` archiwizuje podpisane
  (`archived_at`), usuwa tylko oczekujące. Listy filtrują `archived_at IS NULL`.
  Migracja `contract-archived-at.sql` (do ręcznego uruchomienia na Supabase).
- Auto-aktualizacja: niepodpisane umowy regenerują `contract_text` po zmianie
  wzoru / cennika / danych wyjazdu (`regenerateUnsignedContractsForTrip`).
- Naprawa masowego pobierania (stagger) i filtra dokumentów dynamicznych.

### 2026-05-18 (Logowanie)

- Strona `/login`: obsługa parametru `?error=auth_failed`. Callback OAuth/magic
  link redirectował z tym parametrem, ale strona go ignorowała — użytkownik po
  nieudanym logowaniu Google widział pusty formularz bez komunikatu.
  `page.tsx` odczytuje `searchParams` i przekazuje `initialError` do `LoginForm`.

### 2026-05-18 (Finanse)

- Ekran `/admin/finance`: widok `admin_finance_summary` rozszerzony o kolumny
  `discount_pln` / `discount_eur` (zniżka = `original_amount - amount`) —
  migracja `admin-finance-summary-view.sql` do ręcznego uruchomienia.
- `% opłacenia` liczone kwotowo (`zebrano / do zapłaty`) zamiast z liczby rat.
- Karty podsumowania EUR (Zebrano / Brakuje) + karta „Udzielone zniżki".
- Kolumna „Zniżki" w tabeli (PLN i EUR) oraz eksport zestawienia do CSV.

### 2026-05-18

- Zapisani: `router.refresh()` po zmianie statusu (pojedynczo/masowo) i notatki
  — uczestnik teraz natychmiast trafia do właściwej sekcji bez manualnego F5.
- Zapisani: eksport Excel respektuje aktywne filtry (grupa/wyszukiwarka).
- Wzór umowy: uzupełniona lista placeholderów w edytorze (brakowało 6 z 15).
- Umowy: poprawiony mylący komunikat empty state.
- Admin/Rodzic widok wyjazdu: kolejność boksów zgodna z formularzem tworzenia;
  Co zabrać + Dodatkowe informacje bezpośrednio pod opisem; usunięta redundantna
  sekcja „Grupy" z rozwinięcia (widoczne pod tytułem).
- Formularz tworzenia wyjazdu: Co zabrać + Dodatkowe informacje pod opisem
  (EmailContentFields w BasicInfoSection).
- Płatności: rejestrowanie realnych wpłat w `/admin/payments` (dialog
  `RecordPaymentDialog`) z checkboxem „zniżka" — zaznaczony zamyka płatność
  jako opłaconą mimo niższej kwoty, niezaznaczony zostawia niedopłatę.
- Nowa funkcja `recomputePaymentStatus` — jedno źródło prawdy dla statusu;
  `updatePaymentAmount` i `updatePaymentStatus` przez nią przeliczają status.
- Edycja cennika wyjazdu = twardy reset cen u wszystkich potwierdzonych
  uczestników (synchronizacja rusza tylko przy realnej zmianie cennika,
  trwale anulowane płatności nie są odtwarzane).
- `/admin/payments`: badge „Nadpłata" / „Do dopłaty" przy statusie; usunięty
  tryb procentowy edycji kwoty (akcja `applyDiscount` skasowana).
- Naprawa terminu płatności dla reguły „X dni od potwierdzenia": `updateTrip`
  liczy teraz `due_date` przez `resolveEffectiveDueDate` z `confirmed_at`
  (wcześniej nadpisywał nullem). Ekran `/admin/payments` pokazuje termin też
  dla starych płatności z pustym `due_date`.
- Widok `admin_payments_view` rozszerzony o `confirmed_at`,
  `due_days_from_confirmation`, `effective_due_date` — migracja
  `admin-payments-view-due-date.sql` (do ręcznego uruchomienia na Supabase).
- Nowy kafelek „Po terminie" w panelu admina; filtr „Po terminie" używa
  `effective_due_date`. Rodzic: porównanie terminu do północy, etykieta
  filtra „Filtruj wg. wyjazdu".

### 2026-05-17

- Poprawki płatności wyjazdu: statystyki liczone osobno per waluta (PLN/EUR),
  licznik „po terminie" liczony z `due_date`, ochrona kwot płatności
  opłaconych / ze zniżką przy edycji cennika wyjazdu.
- `/admin/payments`: nowa kolumna „Zniżka" + edycja kwoty kwotowo i procentowo.
- Hardening listy wyjazdów: `SanitizedHtml` zamiast `dangerouslySetInnerHTML`,
  `TripBlock` wyniesiony na poziom modułu, masowe operacje równolegle.
- Usunięta podstrona „Karta wyjazdu" (`/admin/trips/[id]`).
- Nowe pole wyjazdu `attendance_type` (obowiązkowy / dla chętnych) —
  migracja `trip-attendance-type.sql`.
- Import wyjazdów z pliku CSV (upload w aplikacji) zamiast tabeli
  `trips_import_buffer` — migracja `drop-trips-import-buffer.sql`.
