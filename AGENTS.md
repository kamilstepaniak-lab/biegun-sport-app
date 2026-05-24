# AGENTS.md

Wskazówki dla Codex przy pracy nad projektem `biegun-sport-app`
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

### 2026-05-24

- `/parent/payments`: w tabeli płatności rodzica dodano przycisk `Przelew`,
  który otwiera aplę z danymi do przelewu i kopiowaniem odbiorcy, numeru konta,
  tytułu oraz kwoty.
- `/parent/payments`: apla `Przelew` pokazuje teraz wszystkie nieopłacone
  pozycje tej samej raty, np. osobno PLN i EUR z właściwymi kontami.
- `/parent/contracts`: ekran dokumentów dostał tę samą aplę wyboru dziecka
  (`ChildGuard`) co wyjazdy, płatności i kalendarz; rodzic może przełączać
  konkretne dziecko albo widok wszystkich dzieci.

### 2026-05-18 (Uczestnicy)

- Korekta układu karty uczestnika: bez powielania imienia i nazwiska,
  data urodzenia w formacie `d.MM.yyyy`, blok uwag rodzica pod zapisami i
  płatnościami, notatki admina poniżej płatności.
- `Zapisy i płatności` dostały paginację po 10 rekordów.
- `/admin/participants/[id]`: przełożony układ karty uczestnika na widok
  operacyjny z profilem dziecka, uwagami rodzica, zapisami/płatnościami oraz
  prawą kolumną kontaktu, grupy i notatek.
- Poprawione linki powrotu z karty uczestnika do `/admin/participants`.
- Płatności na karcie uczestnika pokazują właściwą walutę płatności.
- ESLint ignoruje lokalne katalogi narzędziowe (`.claude`, `.obsidian`,
  `.playwright-mcp`, `.worktrees`), żeby nie skanował wygenerowanych plików.

### 2026-05-18 (Finanse)

- Ekran `/admin/finance`: widok `admin_finance_summary` rozszerzony o kolumny
  `discount_pln` / `discount_eur` (zniżka = `original_amount - amount`) —
  migracja `admin-finance-summary-view.sql` do ręcznego uruchomienia.
- `% opłacenia` liczone kwotowo (`zebrano / do zapłaty`) zamiast z liczby rat.
- Karty podsumowania EUR (Zebrano / Brakuje) + karta „Udzielone zniżki".
- Kolumna „Zniżki" w tabeli (PLN i EUR) oraz eksport zestawienia do CSV.

### 2026-05-18

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
