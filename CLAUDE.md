# CLAUDE.md

Wskazówki dla Claude przy pracy nad projektem `biegun-sport-app`
(Next.js App Router + Supabase + Vercel).

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
- Aby zmiany trafiły na produkcję: scal gałąź do `main` przez pull request —
  Vercel sam zbuduje produkcję.
- Jeśli zmiany wymagają migracji bazy — migracja musi być uruchomiona, zanim
  produkcja zostanie zbudowana.

## Notatki z sesji

Za każdym razem, gdy użytkownik prosi o wdrożenie / push na Vercel, dopisz
poniżej krótką notatkę z najważniejszymi zmianami wprowadzonymi w danej sesji
(nagłówek z datą, najnowsze wpisy na górze).

### 2026-05-18

- Zapisani: `router.refresh()` po zmianie statusu (pojedynczo/masowo) i notatki
  — uczestnik teraz natychmiast trafia do właściwej sekcji bez manualnego F5.
- Zapisani: eksport Excel respektuje aktywne filtry (grupa/wyszukiwarka).
- Wzór umowy: uzupełniona lista placeholderów w edytorze (brakowało 6 z 15).
- Umowy: poprawiony mylący komunikat empty state.

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
