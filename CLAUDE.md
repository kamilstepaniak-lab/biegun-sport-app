# CLAUDE.md

Wskazówki dla Claude przy pracy nad projektem `biegun-sport-app`
(Next.js App Router + Supabase + Vercel).

## Czym jest aplikacja

Panel do obsługi obozów/wyjazdów sportowych BiegunSport. Dwie role
(`profiles.role`):

- **Rodzic** (`/parent/*`) — przegląda wyjazdy, potwierdza udział dziecka
  („jedzie / nie jedzie"), widzi płatności i terminy, podpisuje umowy,
  czyta wiadomości od organizatora, zarządza danymi dzieci i profilem.
- **Admin** (`/admin/*`) — tworzy/edytuje wyjazdy i ich cenniki, zarządza
  uczestnikami i grupami, rozlicza płatności (wpłaty, zniżki, finanse),
  generuje umowy (PDF), wysyła wiadomości i maile, importuje dane.

Wyjazdy są dodatkowo wystawiane na firmową stronę WWW (WordPress), skąd
spływają zgłoszenia zapisu — patrz „Architektura docelowa".

Bezpieczeństwo: Supabase Auth + **RLS**. Rola pochodzi WYŁĄCZNIE z
`app_metadata` (JWT), nigdy z danych edytowalnych przez użytkownika
(migracja `fix-rls-role-escalation.sql`). Auth czytany przez
`getAuthUser` (`lib/actions/auth-helpers.ts`, owinięty w `cache()`).

## Model domenowy

Encje i relacje (typy: `src/types/database.ts`):

- **Profile** — konto (rodzic/admin) + dane do umowy (adres, PESEL, telefony).
- **Participant** — dziecko; `parent_id` → Profile; notatki rodzica
  (zdrowie/jedzenie/nocleg), `birth_date` (rocznik liczy się w cennikach).
- **Group** — grupa treningowa (Beeski, ProKids, SemiPRO, Hero, Pro…);
  `ParticipantGroup` = przypisanie dziecko ↔ grupa.
- **Trip** — wyjazd; `status` (draft/published/cancelled/completed),
  `category` (summer/winter/family_camp), `attendance_type`
  (mandatory/optional), terminy wyjazd/powrót + przystanki, konta bankowe.
  `TripGroup` = które grupy dotyczy wyjazd. UWAGA: `attendance_type` to
  TYLKO etykieta/UX — nie zmienia logiki potwierdzania ani naliczania.
- **TripPaymentTemplate** — cennik wyjazdu: raty / karnet (season_pass) /
  pozycje ręczne, kwota+waluta (PLN/EUR), termin (data / X dni od
  potwierdzenia / „w terminie raty 1"), ograniczenie rocznikiem.
- **TripRegistration** — udział dziecka w wyjeździe; `participation_status`
  (unconfirmed/confirmed/not_going/other), `confirmed_at` (od niego liczone
  terminy płatności).
- **TripRegistrationRequest** — zgłoszenie zapisu z formularza WWW (WordPress);
  admin akceptuje → tworzy Participant/Registration.
- **Payment** — należność per rejestracja (lub ręczna per uczestnik);
  `status`, `amount`/`amount_paid`/`amount_remaining`, `discount_*`,
  `parent_visible`. **PaymentTransaction** = pojedyncza wpłata.
  Status liczy jedno źródło prawdy: `recomputePaymentStatus`.
  TRIGGER NALICZANIA: płatności powstają z szablonów cennika dopiero gdy
  udział = `confirmed` („jedzie") — `createPaymentsForRegistration`, wołane
  tą samą logiką po stronie rodzica i admina (`trips.ts`), idempotentnie
  (tylko jeśli jeszcze nie ma). `not_going`/`unconfirmed` anuluje pozycje
  nieopłacone (`pending`/`overdue`); częściowo opłacone zostają do ręcznego
  rozliczenia; `other` (sama wiadomość do admina) NIE tworzy płatności.
- **TripContractTemplate / TripContract** — wzór umowy wyjazdu i wygenerowane
  umowy (PDF na żądanie, `/api/contracts/[id]/pdf`).
- Wspierające: **Message/MessageRead** (wiadomości + odczyty),
  **email_templates / system_email_queue / email_logs** (maile),
  **global_documents**, **activity_logs**, **app_settings**.

## Mapa kodu

- `src/app/(auth)/` — login, rejestracja, reset/forgot hasła.
- `src/app/(protected)/admin/` i `.../parent/` — ekrany obu paneli
  (po jednym folderze na podstronę; komponenty obok w `page.tsx`/`*-view.tsx`).
- `src/app/api/public/` — endpointy dla strony WWW (feed wyjazdów,
  przyjmowanie zgłoszeń, widget). `src/app/api/cron/` — kolejka maili,
  przypomnienia o płatnościach. `src/app/api/contracts/` — PDF umów.
- `src/lib/actions/` — server actions, podzielone domenowo (`trips.ts`,
  `payments.ts`, `registrations.ts`, `participants.ts`, `contracts.ts`,
  `messages.ts`, `dashboard.ts`, `auth*.ts`…). **Logika biznesowa mieszka tu**,
  nie w komponentach.
- `src/components/` — `admin/`, `parent/`, `shared/` (wspólne: `panel.tsx`,
  `sidebar.tsx`, `page-header.tsx`, `pricing-table.tsx`, `payment-due.tsx`,
  `sanitized-html.tsx`), `ui/` (shadcn).
- `src/lib/` — pomocnicze źródła prawdy: `group-icons.tsx`, `group-colors.ts`,
  `camp-visual.ts`, `payment-due.ts`, `trip-datetime.ts`, `email.ts`,
  `contract-pdf.tsx`. `src/lib/validations/` — schematy walidacji.
- `supabase/migrations/` — migracje `.sql` (uruchamiane RĘCZNIE).
- `src/types/database.ts` — typy encji (źródło prawdy o modelu).

Zanim dodasz nowy plik/komponent, sprawdź `shared/` i `lib/` — wiele
wzorców (karty, ikony grup, terminy płatności) już istnieje i jest
współdzielonych między adminem a rodzicem.

## Decyzje produktowe / kierunek

- **Fokus rozwoju:** płatności/finanse oraz komunikacja (maile,
  powiadomienia, wiadomości do rodziców). Tu spodziewaj się rozbudowy.
- **Role:** tylko `parent` i `admin`. NIE projektuj pod dodatkowe role
  (instruktor/kadra) — to nie jest planowane; nie dodawaj abstrakcji „na
  zapas" pod role.
- **Umowy:** klik-akceptacja w aplikacji (`accepted_at`) to model docelowy —
  wystarczająca, bez planów na e-podpis. Nie rozbudowuj ścieżki podpisu.

## Architektura docelowa — NIE przebudowuj

- **Wyjazdy są (i będą) połączone ze stroną internetową firmy.** Aplikacja
  tworzy/wystawia pod wyjazdy formularze zapisów zintegrowane z firmową stroną
  WWW (WordPress) — to docelowy, świadomy kierunek, nie tymczasowe rozwiązanie.
  Ślady w kodzie: `wordpress-section.tsx` w formularzu wyjazdu, integracja
  rejestracji WP (`wp-registration-integration`).
- **Nie refaktoruj ani nie usuwaj tej integracji** „bo wygląda na zbędną".
  Wyjazd ↔ strona WWW ↔ formularz zapisu to fundament architektury. Zanim
  ruszysz cokolwiek w warstwie wyjazdów/rejestracji/WordPress, załóż, że to
  celowe i zapytaj, jeśli zmiana mogłaby zerwać to powiązanie.

## Parytet admin ↔ rodzic

Bliźniacze ekrany (kalendarz, płatności, karty wyjazdu, nagłówki) muszą
wyglądać i działać spójnie. Zmiana wzorca wizualnego po jednej stronie =
wdróż ją na bliźniaczym ekranie w tej samej turze. Wspólne komponenty
(`shared/`) są źródłem prawdy — zmieniaj tam, nie kopiuj.

## Sposób pracy

- Pracuj **bezpośrednio na gałęzi `main`** — nie twórz nowych branchy.
  Nowy branch utwórz tylko gdy użytkownik wyraźnie o to poprosi na początku
  danego czatu.
- Na końcu każdego zadania w czacie **zapytaj użytkownika, czy zrobić push
  na `main` / wdrożenie na Vercel** — nie pushuj bez potwierdzenia.
- **Pytania zawsze zadawaj przez klikanie** (narzędzie AskUserQuestion) —
  nie zadawaj pytań w zwykłym tekście. Użytkownik ma wybierać z opcji.

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

## Design system (źródło prawdy o wyglądzie)

Pełne zasady wyglądu są w osobnym pliku **[`design.md`](design.md)**.
**Przed każdym zadaniem dotyczącym UI / wyglądu czytaj `design.md`** —
tam są: stack, zasady nadrzędne, kolory, statusy, layout/nagłówki i ton
tekstów UI. Nie powielaj tych zasad tutaj.

## Definicja ukończenia (sprawdź przed zakończeniem zadania)

- `npx tsc --noEmit` czysty dla dotkniętych plików (istniejące błędy
  niezwiązane — odnotuj, nie udawaj że ich nie ma).
- Logika biznesowa w `src/lib/actions/`, nie w komponentach; użyte
  istniejące wzorce z `shared/` i `lib/` zamiast nowych duplikatów.
- Zmiana UI wdrożona na obu bliźniaczych ekranach (parytet admin ↔ rodzic),
  zgodna z `design.md`.
- Jeśli doszła kolumna/tabela → migracja `.sql` + wyraźne ostrzeżenie dla
  użytkownika o ręcznym uruchomieniu.
- Wpis do `CHANGELOG-sesje.md` (patrz niżej).
- Pytanie o push/deploy zadane przez AskUserQuestion (nie pushuj sam).

## Dziennik sesji

Kronika zmian jest w osobnym pliku **[`CHANGELOG-sesje.md`](CHANGELOG-sesje.md)**
(wyniesiona z CLAUDE.md, żeby reguły się nie rozmywały).

**Zawsze na końcu każdej sesji/zadania** (nie tylko przy push/deploy) dopisz
do `CHANGELOG-sesje.md` krótką notatkę z najważniejszymi zmianami — bez
proszenia przez użytkownika. Nagłówek z datą, najnowsze wpisy na górze.
Jeśli w danym dniu istnieje już nagłówek tego samego tematu, dopisz do niego
nowe punkty. Nowy temat = nowy nagłówek (mogą być różne tematy z tą samą datą).
Notatka ma być zwięzła (punkty, pliki, intencja zmiany).
