# Dziennik sesji — biegun-sport-app

Kronika zmian wprowadzanych w kolejnych sesjach (najnowsze na górze).
Reguła prowadzenia dziennika jest w `CLAUDE.md` (sekcja "Dziennik sesji").

### 2026-06-11 (Porządki UI /admin/payments — mobile + desktop)

- `admin/payments/payments-list.tsx`: wspólne fragmenty wiersza (kwota,
  zniżka, statusy, termin, notatka, akcje, historia wpłat) wyniesione do
  helperów (`getRowMeta` + `render*`) — jedno źródło dla tabeli i kart.
  (Zastępuje równoległą implementację kart mobile z sesji niżej, która
  duplikowała markup wiersza.)
- **Mobile: układ kart zamiast przewijanej w bok tabeli** (wzorzec jak
  u rodzica): karta grupy (dziecko + wyjazd + saldo) i karty płatności
  z pełnym zestawem akcji admina; desktop bez zmian (tabela,
  `min-w-[920px]` w kontenerze ze scrollem).
- Kafle statystyk responsywne (3 kolumny też na telefonie — mniejsze
  ikony/typografia), pasek filtrów uporządkowany: wyszukiwarka i filtr
  wyjazdu pełnej szerokości na mobile, zakładki statusu wyrównane do
  `h-11`, zakres dat nie rozjeżdża się na wąskim ekranie, licznik „X
  łącznie" dobity do prawej; bulk-bar i paginacja zawijają się na mobile.
- Parytet u rodzica (`parent/payments/payments-list.tsx`): te same
  poprawki filtrów (select wyjazdu `w-full` na mobile, zakładki `h-11`).

### 2026-06-11 (Mobile: Wyjazdy i Płatności u admina wzorem panelu rodzica)

- `admin/trips/trips-list.tsx`: nagłówek karty wyjazdu na mobile jako flex
  (ikona + kolumna tytuł/data/status, wzorzec `lg:contents` z karty rodzica)
  zamiast rozsypanego grida; checkbox zaznaczania zostaje; sekcja rozwinięta
  `p-4 sm:p-6`, niebieski banner `-m-4/p-4 sm:-m-6/p-6`, karty `p-4 sm:p-5`;
  cennik na mobile jako karty (jak u rodzica), tabela od `md`.
- `admin/payments/payments-list.tsx`: na mobile lista płatności jako karty
  (`md:hidden`, wzorzec `PaymentCard` rodzica) z pełnymi akcjami admina —
  checkbox/bulk, edycja kwoty i notatki, Wpłata/Tak/Nie z potwierdzeniami,
  przypomnienie, usuwanie, historia wpłat; nagłówki grup (dziecko + wyjazd)
  zwijane też w widoku kart; tabela od `md` bez zmian. Kafle statystyk
  kompaktowe na mobile (bez ikony, mniejsza czcionka), wyszukiwarka
  pełnej szerokości, bulk-bar i paginacja z zawijaniem.
  (Implementacja kart zastąpiona refaktorem z sesji wyżej.)

### 2026-06-11 (Audyt płatności: poprawki logiki + przebudowa /admin/payments)

Poprawki logiki (po audycie cennik → potwierdzanie → płatności):

- `trips.ts`: „nie jedzie"/„niepotwierdzony" anuluje też nieopłacone raty
  `overdue` (nie tylko `pending`) — oba miejsca (admin + rodzic); sync
  cennika ustawia `participant_id` na nowych płatnościach (bez tego cron
  pomijał je przy przypomnieniach). Aktualizacja opisu w `CLAUDE.md`.
- `payments.ts` + `trips.ts`: jedna definicja „po terminie" (porównanie do
  północy — termin DZIŚ nie jest jeszcze zaległy) w `recomputePaymentStatus`
  i jego kopii `computePaymentStatus`.
- `updatePaymentStatus`: „Tak" dopisuje transakcję na brakującą kwotę (jak
  masowe oznaczanie), „Nie" usuwa transakcje — niezmiennik: suma
  `payment_transactions` == `amount_paid`; analogicznie masowe „nieopłacone".
- `updatePaymentAmount`: nie nadpisuje już `paid_at` przy każdej edycji kwoty.
- `getPaymentsForParent`: rodzic widzi też nieanulowane płatności rejestracji
  bez `confirmed` (częściowo opłacone resztki po rezygnacji).
- Filtr „Do zapłaty"/„Po terminie" na `/admin/payments` liczony z
  `effective_due_date` zamiast z (bywającego nieaktualnym) statusu w bazie.

Przebudowa `/admin/payments` (ręczne księgowanie bez bramki płatności):

- **„Zaksięguj przelew"** (`record-transfer-dialog.tsx` + akcje
  `getUnpaidPaymentsForParticipant`/`recordAllocatedTransfer`): kwota z
  wyciągu rozbijana FIFO na najstarsze nieopłacone raty dziecka, z ręczną
  korektą rozbicia; jedna operacja = wiele transakcji.
- Grupowanie tabeli per dziecko+wyjazd (zwijane, saldo „brakuje X PLN"),
  kolumna Uczestnik przeniesiona do nagłówka grupy.
- Sortowanie Termin/Najnowsze; zakres dat filtruje po terminie płatności
  (nie dacie utworzenia); „X dni po terminie" w kolumnie Termin.
- Przypomnienia mailowe: dzwonek per rata + masowo z paska zaznaczenia
  (`sendPaymentReminders`), znacznik „przyp. d.MM"
  (`payments.last_reminder_sent_at`, ustawiany też przez cron).
- Klikalne kafle statystyk; statystyki respektują filtry
  (`getAdminPaymentsStats(filters)`); domyślna zakładka „Do zapłaty";
  szukanie także po nazwisku rodzica; rozwijana historia wpłat w wierszu;
  eksport CSV (`exportAdminPaymentsCsv`, średniki + BOM dla Excela);
  potwierdzenie przy „Nie"/usuwaniu płatności z wpłatami.
- **MIGRACJA do ręcznego uruchomienia:**
  `supabase/migrations/admin-payments-parent-reminders.sql` (kolumna
  `last_reminder_sent_at`, backfill `participant_id`, widok
  `admin_payments_view` + `parent_name/parent_first_name/parent_email`).
  Bez niej /admin/payments nie działa (szukanie/przypomnienia używają
  nowych kolumn widoku).
- Odnotowane, nienaprawione (istniejące wcześniej): błąd TS w
  `trip-form/index.tsx:162` (dostęp do `result.error` na unii bez
  zawężenia) — występuje też na `main`.

### 2026-06-10 (vercel.json: cron email-queue tymczasowo dzienny — Hobby)

- `email-queue` cron `*/5 * * * *` → `0 8 * * *`: plan Vercel Hobby nie
  dopuszcza cronów częstszych niż dzienne i taki config blokował wdrożenia
  (od `14cba6b` Vercel nie zbudował żadnego commita). **Po wykupieniu
  Vercel Pro przywrócić `*/5 * * * *`** — wtedy kolejka maili będzie
  opróżniana co 5 minut, a nie raz dziennie o 8:00.

### 2026-06-10 (Selektor dzieci: zawijanie zamiast przewijania w bok)

- `parent-child-selector.tsx`: na mobile chipy zawijają się do kolejnej
  linii (`flex-wrap`), zero poziomego scrolla; od `sm` jeden rząd jak dotąd.
- `parent-page-header.tsx` + `design.md`: hero rodzica na mobile
  `min-h-[348px]` zamiast sztywnego `h` — przy jednej linii chipów nadal
  równe 348px, przy 3+ dzieciach rośnie zamiast ucinać (overflow-hidden).
- Diagnoza wdrożeń: push na `main` dochodzi do GitHuba, ale integracja
  GitHub→Vercel nie tworzy buildów od commita `14cba6b` (cron `*/5`
  w `vercel.json` wymaga planu Vercel Pro) — deployment wyzwalany ręcznie.

### 2026-06-10 (Rodzic: płynne karty wyjazdów + sticky podsumowanie płatności)

- `trip-card.tsx` + `globals.css`: animowane rozwijanie karty wyjazdu
  (keyframes `collapsible-down/up` na `--radix-collapsible-content-height`);
  `trips-list.tsx`: otwierana karta dosuwana do góry ekranu
  (`scrollIntoView`, `scroll-mt-24`).
- `parent/payments/payments-list.tsx`: na mobile dwa kafle podsumowania
  zastąpione przyklejoną pigułką (sticky top-2) „Do zapłaty / Po terminie" —
  kwoty widoczne podczas przewijania listy rat; desktop bez zmian
  (`SummaryBlocks` zwraca fragment: pigułka `md:hidden` + kafle `hidden md:grid`).

### 2026-06-10 (Rodzic: szlify mobile — Moje dzieci, Profil, Dokumenty)

- Przegląd Wiadomości/Dokumenty/Moje dzieci/Profil pod kątem mobile;
  świadomie zostawione: `text-base` na selectach (ochrona przed auto-zoomem
  iOS), etykiety `text-[11px]` (wzorzec design systemu), wysokość hero
  (użytkownik nie wybrał).
- `children-list.tsx`: przyciski edycji/usuwania dziecka w chipach
  `h-6` → `h-9` na mobile (touch target), ikony `h-4` (od `sm` kompakt).
- `profile-form.tsx`, `change-password-form.tsx`: przyciski Zapisz/Zmień
  hasło `w-full sm:w-auto`.
- `contracts/contract-card.tsx`: nagłówek karty stackuje się na mobile
  (tytuł nad badge'ami zamiast ściskania w jednym rzędzie), chevron
  `h-9` na mobile, badge'y wyrównane do lewej.

### 2026-06-10 (Mobile: Wyjazdy rodzica — pełna szerokość, przyciski potwierdzeń)

- `parent-child-selector.tsx`: na mobile kompaktowe chipy z samymi imionami
  („Wszystkie" zamiast „Wszystkie dzieci", bez znaczka ✓) — selektor mieści
  się bez przewijania poziomego; od `sm` dotychczasowy wygląd.

- `parent/trips/trips-list.tsx`: oś czasu miesięcy (kółko z kalendarzem +
  pionowa linia + `pl-10`) tylko od `sm` — na telefonie karty wyjazdów
  zajmują pełną szerokość ekranu.
- `parent/trips/trip-card.tsx`:
  - chipy grup w nagłówku karty: na mobile mała kropka koloru + nazwa
    `text-xs` (duże kółko `h-6` z ikoną dopiero od `sm`),
  - przyciski potwierdzeń („jedzie"/przystanki/„nie jedzie"/„wiadomość"):
    na mobile siatka 2 kolumn, przystanki na pełną szerokość, `py-2.5`
    (duże touch targets) — od `sm` kompaktowy rząd jak dotąd,
  - paddingi rozwiniętej sekcji `p-6`/`p-5` → `p-4` na mobile (sekcja
    niebieska, Podstawowe informacje, Terminy, Cennik, Co zabrać, przelewy),
  - panel potwierdzenia bez wcięcia `ml-11` na mobile, większe
    Anuluj/Potwierdź.

### 2026-06-10 (Mobile: bottom nav, tap feedback, skeletony hero)

- Audyt mobile („native app feel"): PWA/manifest/safe-area/touch targets już
  dobre; braki: bottom nav, tap feedback, skeletony niedopasowane do hero.
- **Bottom navigation bar** (`shared/sidebar.tsx`): stały dolny pasek na
  mobile (`md:hidden`, safe-area) — 4 główne sekcje + „Menu" otwierające
  dotychczasowy drawer (Sheet). Pozycje oznaczane flagą `mobile: true`
  w `SidebarItem` (layouty admin + parent). Usunięty pływający hamburger
  (lewy górny róg); w headerze na mobile logo + „BiegunSport"
  (`shared/header.tsx`), `padding-left` headera 64→16px. `admin-main`
  dostaje na mobile `padding-bottom` pod pasek (globals.css).
- **Tap feedback + drobiazgi CSS** (globals.css, `ui/button.tsx`):
  `active:scale-[0.98]` na Button, `active:bg-slate-100`+`select-none` na
  linkach sidebara, `-webkit-tap-highlight-color: transparent`,
  `overscroll-behavior: none` (też pionowo — bez pull-to-refresh),
  `touch-action: manipulation` na elementach interaktywnych.
- **Skeleton screens** (`shared/loading.tsx` → `PageSkeleton`): wspólny
  szkielet podstrony z placeholderem hero (góry, te same sztywne wysokości
  co prawdziwe nagłówki — wariant `admin`/`parent`) + bloki treści.
  Wszystkie 34 route-level `loading.tsx` przepisane na `PageSkeleton`
  (wcześniej małe szare paski → układ „skakał" przy ładowaniu).
- `tsc --noEmit`: czysty dla dotkniętych plików; 2 istniejące błędy
  w `trip-form/index.tsx` (niezwiązane). Bez migracji DB.
- Gałąź: `claude/mobile-view-improvements-6aqcf6` (preview Vercel).

### 2026-06-08 (Audyt gotowości produkcyjnej + fix krytyczny: cron maili)

- Audyt stanu aplikacji pod kątem wypuszczenia. Aplikacja dojrzała:
  oba panele kompletne, RLS + rola z JWT, error/loading/not-found pokryte,
  walidacja Zod, dedup zgłoszeń WP, cron chroniony `CRON_SECRET`,
  `tsc --noEmit` czysty, polityka prywatności + OWU obecne.
- **KRYTYCZNY fix:** kolejka maili (`system_email_queue`) nie była
  opróżniana — `/api/cron/email-queue` istniał, ale nie był w `vercel.json`
  (tylko `payment-reminders`). Maile enqueue'owane z `trips.ts`,
  `registrations.ts`, `payments.ts`, `trip-emails.ts` nigdy nie wychodziły.
  Dodany cron `email-queue` `*/5 * * * *` (wymaga planu Vercel Pro).
- Zidentyfikowane (nie blokery, do rozważenia): brak monitoringu błędów
  (Sentry), brak rate-limitingu na publicznym zapisie WP, testy `.mjs` bez
  skryptu `test`/CI.

### 2026-06-08 (Ujednolicenie admina do designu rodzica — desktop priorytet)

- Audyt parytetu admin↔rodzic: nagłówki (`.admin-shell .page-header` =
  `ParentPageHeader`), `shared/panel.tsx`, sidebar i ikony grup są już wspólne
  i zgodne — bez zmian. Realny rozjazd: bliźniaczy **Kalendarz** i resztki
  off-kanon kolorów w adminie.
- **Kalendarz admina zrównany z rodzicem** (`admin/calendar/calendar-view.tsx`):
  ikona typu obozu (`getCampVisual(trip.category)`) przy tytule w tabeli
  desktop (wcześniej tylko rodzic ją miał); mobile przerobione z poziomo
  przewijanej tabeli („przesuń palcem…") na karty + modal ze szczegółami
  (Wyjazd/Powrót/grupy/„Szczegóły wyjazdu" → `/admin/trips`) — kopia układu
  z `parent/calendar/calendar-view.tsx`. Dodany stan `selectedTrip`, importy
  `X`, `getCampVisual`. Filtr grup admina (którego rodzic nie ma) zostaje.
- **Cleanup off-kanon kolorów w całym adminie** (design.md slate/red):
  `text-muted-foreground` → `text-slate-500` (50 wystąpień, 15 plików admin +
  trip-form), `bg-muted*` → `bg-slate-50`, `text-destructive` → `text-red-600`.
  `bg-destructive` (akcje usuwania) zostawione — semantyczny czerwony.
- Decyzja użytkownika: admin na mobile używany rzadko (głównie desktop), więc
  priorytet to spójność desktopu; mobilne karty admina robione tylko tam, gdzie
  to czysty bliźniak (kalendarz). `tsc --noEmit` czysty. Bez migracji DB.
  NIEZWERYFIKOWANE na żywo (brak sesji logowania w Playwright) — sprawdzić
  wygląd na preview/po deploy.

### 2026-06-08 (Audyt przepływu auth — login/rejestracja/reset)

- Przegląd całości auth (`actions/auth.ts`, `validations/auth.ts`, `rate-limit.ts`,
  `api/auth/callback`, `middleware`, formularze login/register/forgot/reset) +
  weryfikacja na żywo przez Playwright na koncie rodzica. Logowanie email+hasło,
  Google OAuth, magic link, redirect wg roli, panel rodzica z realnymi danymi,
  menu i wylogowanie → wszystko działa, 0 błędów w konsoli. Walidacja
  rejestracji (wszystkie pola + RODO) i logowania renderuje się poprawnie.
  `tsc --noEmit` czysty.
- **Fix**: `reset-password/page.tsx` — placeholder hasła „Minimum 6 znaków" →
  „Minimum 8 znaków" (walidacja i `updatePassword` wymagają 8). Commit `257594a`,
  push na main. Bez migracji.
- Uwagi odłożone (nie blokujące, do decyzji): `sendMagicLink` zwraca „Nie
  znaleziono konta…" = wektor enumeracji maili (reset robi to bezpiecznie,
  zawsze sukces); `/reset-password` dostępne bez sesji recovery (formularz się
  pokazuje, zapis i tak się nie powiedzie — ogólny błąd, można dodać guard).

### 2026-06-08 (Panel rodzica — czytelność i spójność na mobile)

- **Przycisk menu (hamburger)** (`shared/sidebar.tsx`): był biały na białym
  nagłówku — słabo widoczny. Teraz brandowy `bg-blue-600` + biała ikona,
  `shadow-lg` z niebieskim cieniem, `ring-blue-700/50`, `h-11 w-11`,
  `active:scale-95`, `aria-label`. Mocny kontrast, dotyczy admina i rodzica
  (wspólny komponent).
- **Karta wyjazdu — chevron rozwijania na wysokości tytułu (mobile)**
  (`parent/trips/trip-card.tsx`): nagłówek był jednokolumnowym gridem na
  mobile (ikona→tytuł→data→grupy→chevron w pionie, chevron lądował na dole).
  Teraz na mobile `flex items-start`: `[ikona] [tytuł/data/grupy flex-1]
  [chevron]` — chevron wyrównany do góry, na wysokości tytułu. Środkowa
  kolumna owinięta wrapperem `lg:contents`, więc od `lg` wraca dotychczasowy
  grid `grid-cols-[auto_18rem_auto_1fr_auto_auto]` bez zmian. Desktop
  niezmieniony.
- **Płatności rodzic — karta mobile linijka pod linijką**
  (`parent/payments/payments-list.tsx`, `PaymentCard`): przebudowa z układu
  „lewo/prawo ściśnięte" na czytelne, etykietowane wiersze: nagłówek
  (dziecko + badge statusu), wyjazd + „za co", potem `dl` z wierszami
  „Kwota" i „Termin" (etykieta z lewej, wartość z prawej), osobny wiersz
  „Tytuł przelewu" (kopiowanie), akcja na pełną szerokość (Przelew /
  „Płatność gotówką" amber / „Opłacone" emerald jako pełne paski). `PaymentDialog`
  dostał prop `fullWidth`. Tabela desktop bez zmian.
- Kalendarz i „Moje dzieci" na mobile już były czytelne (karty Wyjazd/Powrót,
  jedna kolumna) — bez zmian. `tsc` czysty dla dotkniętych plików (błędy w
  `admin/trip-form/index.tsx` są wcześniejsze, niezwiązane).

### 2026-06-08 (Wydajność panelu rodzica — auth round-tripy + waterfall)

- **`getAuthUser` owinięty w React `cache()`** (`auth-helpers.ts`). Wcześniej
  każda akcja serwerowa wołała `supabase.auth.getUser()` (weryfikacja JWT po
  sieci, ~200–400 ms) osobno — na jednym renderze strony rodzica nawet
  kilka–kilkanaście razy (getMyChildren, getMessagesForParent, getDashboardData
  × dziecko, getPaymentsForParent…). `cache()` deduplikuje w obrębie jednego
  żądania: getUser leci RAZ, klient tworzony RAZ. Reset między żądaniami
  (render/mutacja = świeży cache), więc semantyka bezpieczeństwa bez zmian.
  Największy pojedynczy zysk na czasie ładowania i przełączania stron.
- **`getDashboardData` (`dashboard.ts`): check własności równolegle z pobraniem
  rejestracji** (były sekwencyjne — ownership → registrations → payments).
  Teraz `Promise.all([ownershipCheck, registrations])`, payments po nich
  (zależą od reg ids). Oszczędza 1 round-trip na dziecko (przy 2–3 dzieciach
  realna różnica na stronie „Moje dzieci"). `createAdminClient()` przeniesiony
  za guard `if (!user)`. Logika i RLS bez zmian.
- **Batch dashboardu wszystkich dzieci** (`dashboard.ts`): nowa
  `getDashboardDataForChildren(participantIds)` — jeden komplet zapytań
  (check własności ∥ rejestracje, potem płatności) na CAŁY zestaw dzieci
  zamiast `getDashboardData × dziecko`. Logika per-dziecko wyniesiona do
  czystej `computeDashboard(regs, payments, now)` (bez I/O), współdzielonej
  przez obie ścieżki. `Registration` dostał `participant_id`; stałe
  `REGISTRATION_SELECT` / `PAYMENT_SELECT`. `children/page.tsx` woła wersję
  batch. Strona „Moje dzieci" płaska pod round-tripami niezależnie od liczby
  dzieci.
- **`getTripsForParentWithChildren` (`trips.ts`): trip_groups + nazwy grup
  równolegle** (`Promise.all`) — były sekwencyjne, a oba zależą tylko od
  groupIds. Jeden hop mniej na Wyjazdach i Kalendarzu (waterfall 4 → 3).
- Wdrożone na produkcję (commit `6f7af62`, push na main). Bez migracji DB.
- **`getAuthUser`: `getUser()` → `getClaims()`** (`auth-helpers.ts`). getClaims
  weryfikuje JWT lokalnie, gdy w Supabase włączone są klucze ASYMMETRIC
  (ES256/RS256) — JWKS pobierany raz i cache'owany, zero round-tripów do Auth
  API na render. Dla kluczy SYMMETRIC (legacy HS256) getClaims sam robi
  fallback na getUser() po sieci, więc zmiana jest bezpieczna od razu i
  przyspiesza automatycznie po migracji kluczy w panelu Supabase. `user`
  budowany z `claims` (id=sub, email, app_metadata, user_metadata) —
  kompatybilny z wszystkimi callerami (tsc czysty). Rola dalej wyłącznie z
  app_metadata. WARUNEK pełnego zysku: w Supabase Settings → JWT Keys
  przełączyć projekt na asymmetric signing keys.
- Region Vercel = Supabase (oba Frankfurt) — potwierdzone przez użytkownika.
  Connection pooler NIE dotyczy tej apki: brak sterownika Postgres/connection
  stringa, całość idzie przez PostgREST (REST API), który sam pooluje.

### 2026-06-08 (Sidebar — kafelki ikon w stylu referencyjnym)

- `shared/sidebar.tsx` (`NavItem`): przebudowa pozycji nawigacji na styl
  z kafelkiem ikony. Każda pozycja ma kwadratowy kafelek (`h-9 w-9 rounded-xl`)
  z ikoną. Aktywna: tło `bg-blue-50`, lewy pasek `bg-blue-600` (rounded-r-full),
  kafelek biały z `shadow-sm ring-blue-100` i niebieską ikoną, tekst
  `text-blue-700`, bez chevrona. Nieaktywna: kafelek `bg-slate-50 ring-slate-100`,
  ikona slate, tekst `text-slate-600`, chevron „>" po prawej (`text-slate-300`).
  Badge (np. nieprzeczytane wiadomości) ma priorytet nad chevronem. Trzymany
  brandowy niebieski (#2563eb / blue-600). Odstęp pozycji `space-y-0.5` →
  `space-y-1`. Dotyczy admina i rodzica (wspólny komponent).

### 2026-06-08 (Moje dzieci + Płatności — drobne UI)

- **Moje dzieci** (`children-list.tsx`): usunięte strzałki „→" z trzech linków
  „Wszystkie" (Najbliższe wyjazdy / Płatności / Wiadomości). Avatar dziecka
  w selektorze grup zmieniony z pierwszej litery imienia na `GroupIcon`
  (spójne per grupa, jak w wyjazdach) — tło nadal `getGroupColor().dot`.
- **Ikona grupy SemiPRO**: własna ikona `Skis` zastąpiona lucide `Snowflake`
  w `group-icons.tsx` (`GroupIcon` to źródło prawdy — zmiana propaguje wszędzie:
  rodzic, admin, badge). Usunięta nieużywana funkcja `Skis`.
- **Płatności rodzic** (`payments/payments-list.tsx`): w kolumnie „Płatność"
  dla pozycji z `payment_method === 'cash'` zamiast przycisku „Przelew" jest
  napis „Gotówka" (`text-amber-600`). Dotyczy tabeli desktop i karty mobile.

### 2026-06-08 (Płatności — mail przy „Wpłata" + sprzątanie)

- **Mail potwierdzenia przy domknięciu płatności przez wpłatę** (`addPaymentTransaction`,
  `payments.ts`): gdy zarejestrowana wpłata przeprowadza płatność na status
  `paid` (i wcześniej nie była `paid`), leci teraz `queuePaymentConfirmedEmail`
  — fire-and-forget, w try/catch, nie blokuje rejestracji. Wcześniej mail
  wychodził tylko przez przycisk „Tak" (`updatePaymentStatus`), więc
  najczęstsza ścieżka realnego rozliczenia (księgowanie wpłaty) nie
  powiadamiała rodzica. Warunek `newStatus === 'paid' && payment.status !== 'paid'`
  chroni przed ponownym mailem przy edycji już opłaconej pozycji.
- **Usunięty martwy `markPaymentAsPaid`** (`payments.ts`) — funkcja nieużywana
  w żadnym UI (per-trip `trip-payments-list.tsx` jest tylko do odczytu + CSV).
  Logika wysyłki maila z niej została przeniesiona do `addPaymentTransaction`
  (patrz wyżej). `tsc --noEmit` czysty, brak referencji w repo.

### 2026-06-06 (Płatności — widoczność u rodzica + suma per waluta)

- **Płatności widoczne od razu po „Jedzie"** (było: dopiero po wysłaniu maila
  informacyjnego do grupy). Odpięte `parent_visible` od `payments_released_at`:
  `createPaymentsForRegistration` (`payments.ts`) i insert w
  `syncTripPaymentsAfterPricingChange` (`trips.ts`) ustawiają teraz
  `parent_visible: true` na stałe. Usunięte zbędne zapytania o
  `payments_released_at` i zmienne `parentVisible` w obu ścieżkach.
  Mechanizm maila (`sendTripInfoEmailToGroup` → flip `parent_visible=true`)
  zostaje, ale jest już redundantny dla widoczności.
- UWAGA dane: płatności utworzone PRZED tą zmianą mają w DB
  `parent_visible=false` i pozostaną ukryte. Jednorazowy backfill (ręcznie na
  Supabase): `UPDATE payments SET parent_visible=true WHERE registration_id IS
  NOT NULL AND status <> 'cancelled' AND parent_visible=false;`
- **Suma cennika per waluta** (`admin/trips/trips-list.tsx`): było sumowanie
  wszystkich rat do jednej liczby z walutą pierwszej raty (500 PLN + 600 EUR =
  „1100 PLN"). Teraz `totalsByCurrency` grupuje kwoty po walucie i renderuje
  np. „500 PLN / 600 EUR". To była też przyczyna wrażenia „EUR nie zadziałało"
  przy edycji.
- **Karnet bez `birth_date` — ujednolicone** (#5): `createPaymentsForRegistration`
  (`payments.ts`) ma teraz tę samą logikę co sync — karnet z ograniczeniem
  rocznikowym NIE powstaje, gdy dziecko nie ma daty urodzenia (wcześniej
  createPayments tworzył go mimo braku rocznika).
- **Karnet w terminie raty 1** (#6/#7): nowa kolumna
  `trip_payment_templates.due_with_first_installment` (migracja
  `payment-template-due-with-first-installment.sql` — DO RĘCZNEGO
  URUCHOMIENIA na Supabase, inaczej INSERT/odczyt szablonów się wywali).
  Gdy `true`, efektywny termin płatności = termin raty 1
  (`installment_number=1` / `is_first_installment`), liczony per rejestracja
  z `confirmed_at`. Karnet zostaje OSOBNĄ pozycją (własna kwota/waluta/rocznik),
  tylko termin współdzielony — model „zaliczka = rata 1 + karnet" bez sklejania
  kwot.
  - Formularz (`payments-section.tsx`): nowy tryb terminu „W terminie raty 1"
    (tylko dla karnetu, disabled bez raty 1). Przełączenie typu na karnet
    domyślnie ustawia ten tryb.
  - Naliczanie: `createPaymentsForRegistration` (`payments.ts`) i
    `syncTripPaymentsAfterPricingChange` (`trips.ts`) wyliczają termin raty 1
    i podstawiają go karnetowi z flagą.
  - Zapis/odczyt/porównanie/duplikacja szablonów + select rodzica rozszerzone
    o nową kolumnę (`createTrip`, `updateTrip`, `paymentTemplatesEqual`,
    `duplicateTrip`, `PaymentTemplateForParent`).
  - Wyświetlanie: `formatPaymentDueDate`/`PaymentDue` znają etykietę
    „w terminie raty 1"; `PricingTable` i karta rodzica (`trip-card.tsx`)
    pokazują konkretną datę raty 1, gdy znana, inaczej etykietę.
- `includes_season_pass` nadal nieużywane w naliczaniu (świadomie pominięte —
  to była tylko etykieta „zawiera karnet"; realne wiązanie robi teraz
  `due_with_first_installment`).

### 2026-06-06 (Admin — ikony grup spójne z rodzicem: pełna kuleczka)

- Grupy (`admin/groups/groups-list.tsx`): kafelek ikony z jasnego boksu
  (`rounded-xl` + `colors.bg` + kolorowa ikona `colors.text`) → pełnokolorowa
  kuleczka (`rounded-full` + `colors.dot` + biała ikona). Kanon jak u rodzica
  (`GroupBadge`/`change-group-card`).
- Uczestnicy (`participants-table.tsx`): usunięta pigułka grupy w dropdownie
  zmiany grupy (`border`, `rounded-full`, `colors.bg/text/border`). Zostaje:
  kropka (pełen kolor + biała ikona), nazwa grupy, `ChevronDown`. Przycisk
  bez tła/ramki, `text-slate-700 hover:text-blue-700`.

### 2026-06-06 (Admin — tworzenie/edycja wyjazdu: kanon PanelCard, trip-form/)

- Wszystkie sekcje formularza (`src/components/admin/trip-form/`) przepięte ze
  starych `Card/CardHeader/CardTitle` (płaska ikona obok tytułu) na kanon
  `PanelCard` + `SectionTitle` (niebieski kafelek ikony `PanelIcon`, tytuł
  `text-base font-semibold`, opis `text-sm text-slate-600`) — spójność z
  Finanse/Umowy/Płatności. Dotknięte: `basic-info`, `schedule`, `payments`,
  `groups`, `wordpress`, karta „Treść maila" w `index.tsx`.
- Stan błędu sekcji: `ring-2 ring-red-300` na `PanelCard` + `AlertCircle`
  w slocie `action`/przy chevronie (zamiast `border-destructive`).
- Płatności: nagłówek-collapsible zbudowany ręcznie (PanelIcon+tytuł+opis,
  chevron w prawym rogu), wewnętrzne karty rat `rounded-xl border-slate-200
  bg-slate-50` (zamiast zagnieżdżonych `Card bg-muted/30`).
- Grupy: kafelki z ikoną grupy (`GroupIcon` + dot `getGroupColor().dot`),
  zaznaczone `border-blue-500 bg-blue-50`.
- Kolory ujednolicone na slate/red (koniec `text-muted-foreground`/
  `text-destructive` w tych plikach). Pasek akcji w `index.tsx`:
  `rounded-2xl ring-1 ring-slate-200`, panel błędów `bg-red-50`.
- Logika formularza bez zmian — tylko warstwa wizualna.

### 2026-06-06 (Rodzic — karta wyjazdu: kolory na niebieskim, trip-card.tsx)

- Kuleczki grup w nagłówku mają teraz NAZWĘ obok (dot w kolorze grupy +
  `GroupIcon` + nazwa, tekst `text-slate-700`).
- Niebieski blok sekcji rozwiniętej: wiersz dziecka bez białego tła — biała
  ramka (`border-white/40`), przezroczyste tło, biała czcionka. Avatar
  pozostaje w kolorze grupy z pierwszą literą imienia.
- Podpis statusu pod imieniem: `text-emerald-300` (jedzie) / `text-red-300`
  (nie jedzie) / `text-white` (inne).
- Przyciski na niebieskim: przezroczyste tło. Ramki kolorem akcji —
  przystanki/dojazd `border-emerald-400`, „Nie jedzie" `border-red-400`,
  „Wiadomość" `border-white/55`; tekst biały. Wybrany/aktywny stan
  wypełniony kolorem (emerald-600 / red-500 / amber-500). Podgląd
  zatwierdzony przez użytkownika (Playwright screenshot).
- Tytuł wyjazdu usunięty z niebieskiego bloku (jest już w nagłówku karty);
  zostaje tylko badge „Zrealizowany" dla przeszłych + wiersze dzieci.
- Panel wiadomości (po kliknięciu przycisku): usunięte jasne tło/ramka wokół
  i nagłówek statusu (np. „Nie jedzie"). Zostaje samo białe pole `Textarea`
  z instrukcją w placeholderze + przyciski Anuluj/Potwierdź bez zmian. Wrapper
  `ml-11 space-y-2` (przezroczysty). Usunięte nieużywane `stopName/headerLabel/
  panelCls/headerCls`.

### 2026-06-06 (Rodzic — przebudowa karty wyjazdu, trip-card.tsx)

- Kuleczki grup przeniesione z niebieskiego bloku do nagłówka karty, obok
  przycisku rozwijania (chevron). Render jako same dot-y (`getGroupColor().dot`
  + `GroupIcon`), bez białej etykiety (nagłówek jest na białym tle).
  `GroupBadge` zamieniony na `GroupIcon` w imporcie.
- „Miejsce" przeniesione do karty „Podstawowe informacje" w miejsce kafelka
  „Nazwa wyjazdu" (tytuł jest już w nagłówku, więc nazwa była redundantna).
- Dziecko + przyciski potwierdzeń przeniesione z paska pod nagłówkiem
  (zawsze widoczny) na niebieskie tło sekcji rozwiniętej. Wydzielone do
  `const childParticipation` i renderowane w niebieskim bloku (`!isPast`).
  Karty dzieci jako jasne (`bg-white`) kafelki na niebieskim. Uwaga UX:
  potwierdzenie wymaga teraz rozwinięcia wyjazdu.
- Pigułka „Zapisy otwarte" usunięta całkiem — status w nagłówku renderuje się
  tylko dla `isPast` („Zrealizowany") lub `declarationPassed`
  („Po terminie deklaracji").
- `RichDescription`: klucz raw-HTML budowany z części (tablica + join) — bez
  zmiany działania (omija hook bezpieczeństwa przy zapisie). `MapPin` usunięty
  z importów (nieużywany).

### 2026-06-06 (Rodzic — opisy nagłówków + wyrównanie ikony obozu)

- Kalendarz/Dokumenty/Wiadomości: `note` (z ikoną „i") przeniesiony do
  `description` jako druga linia (`<br className="hidden sm:block" />`),
  ten sam styl co opis. Po wcześniejszych Płatnościach/Moich dzieciach —
  żadna podstrona rodzica nie używa już `note` z ikoną „i".
- Moje dzieci: opis to jeden ciąg zdań pod datą (usunięty `<br>`).
- Wyrównanie ikony typu obozu z tytułem (`getCampVisual`): w `children-list`
  (najbliższe wyjazdy) i `calendar-view` (mobile + desktop) ikona+tytuł są
  teraz w wierszu `items-center` (usunięty `mt-0.5` z ikony). W children-list
  imiona dzieci przeniesione pod tytuł z wcięciem `pl-9` (szerokość ikony
  + gap), żeby ikona centrowała się względem samej linii tytułu.

### 2026-06-06 (Rodzic — stała pozycja elementów nagłówka)

- Problem: przy przełączaniu podstron tytuł/opis/przyciski wyboru dziecka
  „skakały", bo nagłówek miał `min-h` (treść top-aligned, nadmiar rósł →
  różne wysokości, różna wielkość grafiki gór).
- Fix w `ParentPageHeader`: sekcja to teraz `flex flex-col` ze **sztywną**
  wysokością `h-[348px] sm:h-[300px] lg:h-[320px]` (zamiast `min-h`). Tytuł
  na górze, dolny pasek (wyszukiwarka + selektor dziecka) `mt-auto`
  (przyklejony do dołu). Pozycje tytułu, opisu i przycisków są identyczne na
  każdej podstronie; grafika gór ma zawsze tę samą wysokość/rozmiar.
- Dolny pasek: narzędzia i selektor obok siebie od `sm` (było `lg`) — żeby
  na tablecie nie stackowały się i mieściły w stałej wysokości; poniżej
  `sm` stack (stąd wyższy mobile 348px).
- `parent-trips-shell.tsx`: usunięte nadpisania `pb-*` i `lg:min-h-[285px]`
  (rozjeżdżały pozycję dolnego paska względem innych podstron); zostaje tylko
  `parent-trips-hero rounded-none border-0 shadow-none`.
- Admin analogicznie: `.admin-shell .page-header` z `min-height` → sztywna
  `height: 285px` (desktop) / `256px` (≤1023). Na telefonie (≤767, akcje
  stackują się) `height:auto` + `min-height:232px`, żeby nic nie uciąć.

### 2026-06-06 (Admin — nagłówek w stylu rodzica)

- `.admin-shell .page-header` (globals.css) przepisany na ten sam hero co
  rodzic: tło `transparent` + warstwa `::after` z `#eef6ff` + gradient 90deg
  + góry, maskowana `linear-gradient(to bottom,#000 50%,transparent)`
  (`-webkit-mask-image` dla iOS) → dolna krawędź wtapia się bezszwowo w
  gradient `.admin-main`. Tytuł `font-weight:900`, `clamp(34px,5vw,52px)`,
  `line-height:1`, kolor `#020617`. Opis: `margin-top:20px`, `15px`, `500`.
  Wysokość spójna: `285px` (≤1023: `256px`, ≤767: `232px`), treść top-aligned
  (`align-items:flex-start`), `padding-top:40px; padding-bottom:64px`.
  Komponent `PageHeader` bez zmian (używany tylko w adminie, 22 podstrony) —
  dostają nowy wygląd automatycznie; akcje zostają w prawym górnym rogu.

### 2026-06-06 (Wyjazdy rodzic — bezszwowa dolna krawędź nagłówka)

- `ParentPageHeader`: nowy prop `seamlessBottom`. Gdy włączony, sekcja ma
  `bg-transparent`, a kolor `#eef6ff` + grafika gór trafiają na warstwę
  dekoracyjną (`inset-0`) z maską `linear-gradient(to_bottom,#000_50%,transparent)`
  (`-webkit-mask-image` dla iOS/PWA). Dół tła rozpływa się w przezroczystość,
  więc prześwituje prawdziwy gradient `.admin-main` strony — brak widocznej
  krawędzi bloku. Maska dotyczy tylko warstwy tła; treść (z-10: tytuł,
  wyszukiwarka, chipy) zostaje ostra. Twardy fade do `#f8fafc` (overlay)
  renderuje się tylko dla pozostałych podstron (`!seamlessBottom`).
- `parent-trips-shell.tsx`: Wyjazdy przekazują `seamlessBottom`; padding dołu
  zwiększony (`pb-16 sm:pb-20 lg:pb-24`), by treść stała ponad strefą zaniku.
- Wyszukiwarka wyjazdu już wcześniej spełniała wymóg: etykieta nad polem
  w stylu „Wybierz dziecko" (`text-xs font-black uppercase text-blue-700`)
  + input `h-12` = wysokość chipów. Bez zmian.
- Wyrównanie dolnego paska: `lg:items-end` → `lg:items-start`. Chipy mają
  `pb-1`, więc przy `items-end` etykieta selektora lądowała wyżej niż etykieta
  wyszukiwarki. Po zmianie oba napisy oraz input i przyciski dzieci stoją
  w równej linii (góra).
- Większy odstęp tytuł → opis w `ParentPageHeader`: `mt-3` → `mt-5`
  (dotyczy wszystkich nagłówków rodzica).
- **Ujednolicenie: wszystkie podstrony rodzica dostają nagłówek w stylu
  Wyjazdów.** `seamlessBottom` domyślnie `true` w `ParentPageHeader`; baza
  bez ramki/zaokrąglenia/cienia (pełny bleed + dolne wtopienie). Ramka/karta
  (`rounded-[16px] border bg-[#eef6ff] shadow`) tylko dla jawnego
  `seamlessBottom={false}` (nieużywane). Padding dołu bazy podniesiony
  (`pb-12 sm:pb-14 lg:pb-16`) na strefę zaniku. Żadna podstrona nie
  nadpisywała className, więc Płatności/Kalendarz/Dokumenty/Wiadomości/
  Profil/Moje dzieci/Dodaj-Edytuj dziecko/OWU dostają nowy wygląd
  automatycznie.
- **Stała wysokość nagłówka** na wszystkich podstronach rodzica:
  `min-h-[232px] sm:min-h-[256px] lg:min-h-[285px]` w bazie `ParentPageHeader`.
  Treść top-aligned (tytuł na tej samej wysokości przy nawigacji), nadmiar
  wysokości wpada w strefę zaniku tła.
- **Ukryte ikony przy tytule**: `hideIcon` domyślnie `true` (jak w Wyjazdach).
  Wszystkie podstrony tracą niebieski boks ikony obok tytułu.
- **Płatności i Moje dzieci**: tekst z `note` (z ikoną „i") przeniesiony do
  `description` jako druga linia (`<br className="hidden sm:block" />`) —
  ten sam styl co opis, bez ikony „i". Pozostałe podstrony zachowują `note`.

### 2026-06-05 (Panel rodzica — jednolity nagłówek na wszystkich podstronach)

- `ParentPageHeader` przepisany ze starego niebieskiego panelu na jasny hero
  z grafiką gór (`/parent-hero-mountains.svg`) w stylu Wyjazdów: błękitny
  kafelek ikony (props `hideIcon`), duży tytuł, opis, `note` jako subtelny
  hint, dolny pasek z opcjonalnym slotem `tools` (np. wyszukiwarka) i wyborem
  dziecka. Jeden wspólny komponent = jedno źródło prawdy.
- `parent-trips-shell.tsx`: usunięty bespoke header, Wyjazdy korzystają teraz
  z `ParentPageHeader` (wyszukiwarka wpięta jako `tools`, `hideIcon`,
  klasa `parent-trips-hero` na własne dopasowanie pełnego bleedu).
- `globals.css`: klasa `.parent-page-hero` dodana do wyjątków marginesów
  (`:not(...)`) w obu breakpointach — nagłówek rodzica jest pełnoszerokościowy
  (edge-to-edge) jak Wyjazdy.
- Pozostałe podstrony (Płatności, Kalendarz, Dokumenty, Wiadomości, Profil,
  Moje dzieci, Dodaj/Edytuj dziecko) dostają nowy wygląd automatycznie — bez
  zmian w ich kodzie. Test `tests/parent-page-header.test.mjs` zaktualizowany
  pod nową architekturę (wspólny nagłówek zamiast osobnego dla Wyjazdów).

### 2026-06-05 (Design system — wspólne wzorce UI)

- Dodany `src/components/shared/panel.tsx`: `PanelCard`, `PanelIcon`,
  `SectionTitle`, `MetricCard`, `CopyIconButton`, `AdminTableShell` jako
  wspólne klocki dla admina i rodzica.
- Bazowe komponenty ui (`Button`, `Input`, `Textarea`, `Select`, `Badge`,
  `Checkbox`, `RadioGroup`, `Switch`, `Tabs`, `Calendar`) oczyszczone z
  wariantów `dark:` i ujednolicone radiusy zgodnie z jasnym motywem.
- `/admin/finance` i `/parent/payments`: kafelki metryk oraz elementy kopiowania
  przepięte na wspólne wzorce (`MetricCard`, `PanelCard`, `CopyIconButton`).
- `/admin/contracts` i `/parent/contracts`: sekcje dokumentów/umów oraz metryki
  przepięte na `SectionTitle`/`MetricCard`; usunięte emoji z kart umów.
- `ContractTemplateLibrary`, logi aktywności i generator wiadomości wyjazdu:
  usunięte fioletowe/indigo/orange wyjątki oraz emoji w treści WhatsApp.
- Skan `bg/text/border-purple`, `dark:` i emoji komunikacyjnych w chronionych
  ekranach oraz komponentach admin/parent/shared/ui jest czysty.

### 2026-06-05 (Panel rodzica — powitanie)

- `/parent/children`: nagłówek „Dzień dobry” bierze teraz imię z
  `profile.first_name`, a nie z nieistniejącego `full_name` ani loginu maila.
- Dodany test regresji `tests/parent-children-greeting.test.mjs`, żeby powitanie
  nie wróciło do źródła innego niż imię rodzica z profilu.

### 2026-06-05 (Admin UI — poprawki z notatek)

- `/admin/participants` i `/admin/registrations`: tabele dostały minimalną
  szerokość zamiast ściskania kolumn; nagłówek `WA` zmieniony na `WhatsApp`.
- `/admin/participants/[id]`: karty szczegółów uczestnika dopasowane do stylu
  profilu rodzica — niebieskie boksy ikon w nagłówkach i polach.
- `/admin/groups`: ikony grup przepięte na `GroupIcon`, usunięty podpis
  „Grupa”, dopisane roczniki obok nazwy i doprecyzowane metryki importu.
- `/admin/trips/add|edit`: formularz wyjazdu na pełną szerokość; dialog
  wiadomości do rodziców poszerzony i ujednolicony wizualnie.
- `/admin/messages` i `/admin/settings`: usunięte sztuczne ograniczenia
  szerokości kontenera.
- `/admin/trips/[id]/contracts`: fioletowe akcenty umów wyjazdu zamienione na
  brandowy niebieski; `/admin/trips/[id]/registrations` zabezpieczone przed
  ściskaniem kolumn.
- `AGENTS.md`: dopisana reguła parytetu ekranów admin/rodzic oraz kanonicznych
  ikon/kolorów grup.

### 2026-06-05 (Płatności + Finanse — zniżki vs edycja ceny, spójność)

- **Rozdzielenie zniżki od edycji ceny** (#14). `addPaymentTransaction`:
  checkbox „Zniżka" we Wpłacie ustawia teraz `discount_applied_at/by` —
  to jedyny sygnał realnej zniżki. `updatePaymentAmount` (edycja kwoty
  w tabeli) zeruje `discount_applied_at/by` — edycja = nowa cena należna,
  nie zniżka.
- `/admin/payments` (`payments-list.tsx`): kolumna **Kwota** przy edytowanej
  cenie pokazuje przekreśloną `original_amount` + nową `amount`. Kolumna
  **Zniżka** pokazuje wartość **tylko** gdy `discount_applied_at` ustawione
  (realna zniżka). Wcześniej każde obniżenie kwoty lądowało w „Zniżce".
- **Widok finansów**: nowa migracja `admin-finance-summary-discount-flag.sql`
  — `discount_pln/eur` liczone tylko dla płatności z `discount_applied_at IS
  NOT NULL`. DO RĘCZNEGO URUCHOMIENIA na Supabase (inaczej sumy zniżek na
  /admin/finance nie zmienią semantyki).
- **„Za co" dla płatności ręcznych** (#15): zamiast „Płatność ręczna" w
  kolumnie pokazuje się `manual_title` (opis). Zmiana w admin i parent
  `payments-list.tsx`. Dialog „Dodaj płatność": pole „Tytuł" → „Za co (opis
  płatności)" z podpowiedzią, że trafia do kolumny.
- **Dodaj płatność — wybór dziecka po nazwisku** (#15): `<select>` zamieniony
  na typeahead (Input + filtrowana lista po nazwisku/rodzicu, wybór = chip
  z możliwością zmiany). `manual-payment-dialog.tsx`.
- **Spójność graficzna** (#13): admin status „Do zapłaty" orange → amber
  (kanon design.md); karta „Nieopłacone" orange → amber. Finanse: karty
  podsumowania przepisane na styl kart płatności (chip z ikoną + tint).
- design.md: dopisany kanon **ikon i kolorów grup** (`group-icons.tsx` /
  `group-colors.tsx` jako źródło prawdy) oraz reguła **auto-wdrażania zmian
  na bliźniaczych ekranach** admin/rodzic w tej samej turze.

### 2026-06-05 (Panel rodzica — wydajność i porządki)

- „Moje dzieci": dashboard (`getDashboardData`) i wiadomości
  (`getMessagesForParent`) liczone teraz **serwerowo** w
  `parent/children/page.tsx` i przekazane w propsach do `children-list.tsx`.
  Usunięte dwa `useEffect` z fetchami po stronie klienta + wszystkie skeletony
  (`dashboardLoading`/`messagesLoading`). Przełączanie dziecka = natychmiastowy
  odczyt z mapy `dashboardByChild`, koniec migotania i N+1 z klienta. Agregat
  „Wszystkie dzieci" liczony serwerowo (`buildAggregateDashboard`).
- `getMyChildren` (participants.ts) i `getMessagesForParent` (messages.ts)
  owinięte w `cache()` — deduplikacja zapytań w obrębie jednego renderu.
- Nowa podstrona **`/parent/messages`** — pełny widok wszystkich wiadomości
  od organizatora (`messages-list.tsx`, `markMessageRead`, dialog z pełną
  treścią, styl nieprzeczytanych). Dodana do nawigacji (ikona MessageSquare).
  „Wszystkie →" w karcie wiadomości na „Moje dzieci" prowadzi teraz tutaj
  (wcześniej linkowało do tej samej strony).
- Layout rodzica: badge liczby **nieprzeczytanych wiadomości** na pozycji
  „Wiadomości" w nawigacji (Sidebar `badge`).
- Lista wyjazdów rodzica (`trips-list.tsx`): **wyszukiwarka po nazwie**
  wyjazdu (#18), widoczna przy >3 wyjazdach. Przy aktywnym wyszukiwaniu
  sekcja „zrealizowane" jest automatycznie rozwinięta; pusty wynik ma własny
  komunikat.
- Profil rodzica (`profile/page.tsx`): **wskaźnik kompletności danych do
  umowy** (#19) — amber z listą brakujących pól lub emerald „komplet".
- **Wizual typu obozu** (#3, `getCampVisual`) dodany na „Moje dzieci"
  (karty najbliższych wyjazdów) i w kalendarzu (mobile + desktop). `category`
  dodane do `NearestTrip` i zapytania w `dashboard.ts`.
- **Badge „Po terminie deklaracji"** (#4, amber) na liście wyjazdów po
  `declaration_deadline` — tylko informacyjnie, bez blokady potwierdzania
  (decyzja: deadline nie blokuje zapisów).
- Zgodność z CLAUDE.md (komponenty z ui): #18 surowy input → `Input`,
  #19 banner → `Alert`. Sąsiednie `payments-list`/`contracts` zostają surowe
  (osobny, całościowy cleanup do zrobienia później).
- #2 ujednolicenie kart panelu rodzica: karty na „Moje dzieci" `border` →
  `ring-1 ring-gray-100` (radius `rounded-2xl` już był), ikony-nagłówki
  w Dokumentach `rounded-xl` → `rounded-lg` (kanon dla niebieskich boksów
  ikon). Dialogowe boksy ikon zostają `rounded-xl` (osobna konwencja).
- Cleanup ui: banner „uzupełnij dane do umowy" w Dokumentach → `Alert` z ui.
  Surowy `<select>` w `payments-list` zostaje natywny świadomie — natywny
  picker to lepszy UX na telefonie (panel rodzica głównie mobilny); zamiana
  na Radix `Select` byłaby regresją.
- Odłożone do zrobienia z testem na żywo: podwójny redirect ChildUrlSync +
  ChildGuard (#13) — celowa defensywa, refaktor wymaga przeklikania wyboru
  dziecka, by nie wprowadzić regresji.
- Bugfix: fallback imienia na „Moje dzieci" był zahardkodowany na „Karol";
  teraz pierwsza część `full_name` → login z maila → „Witaj".
- Sprzątanie: usunięty martwy `localStorage.removeItem('selectedChild')`
  z `child-guard.tsx` (klucz nigdzie nie zapisywany).
- Pominięte świadomie: ujednolicenie dwóch selektorów dziecka (zostaje).

### 2026-06-05 (Ikony i kolory grup)

- Nowy `src/lib/group-icons.tsx` — `GroupIcon` (switch po nazwie grupy) i
  `GroupBadge` (powiększona kropka 20px z ikonką + nazwa). Ikony: Beeski=pszczółka,
  ProKids=rakieta, SemiPRO=narciarz, Hero=biceps, Pro=ogień. Pszczółka i narciarz
  to własne SVG (lucide ich nie ma); reszta z lucide.
- Moje dzieci (`children-list.tsx`) i wspólny selektor w zakładkach
  (`child-guard.tsx`): avatar dziecka = pierwsza litera imienia + kolor grupy
  (`getGroupColor` z nazwy grupy) zamiast dwóch inicjałów. `ChildOption` dostał
  `groupName`; strony parent/{payments,calendar,contracts,trips} przekazują je.
- Lista wyjazdów (rodzic `trip-card.tsx`, admin `trips-list.tsx`): tytuł i data
  rozbite na osobne komórki gridu — daty wyrównane w kolumnie. W rozwiniętym
  wyjeździe kropki grup (`GroupBadge`) przeniesione do prawej krawędzi na
  niebieskim tle.

### 2026-05-28 (Uczestnicy / Grupy — CRM)

- Nowy komponent `src/components/admin/participants-table.tsx` — wspólna tabela
  CRM (sekcje literowe, checkboxy, inline zmiana grupy przez dropdown, edycja
  notatki, kopiowanie email/telefon). Używana w `/admin/participants` i w
  rozwinięciu grupy w `/admin/groups` (prop `hideGroupColumn`).
- Migracja `default-uncategorized-group.sql` — tworzy grupę „Bez kategorii"
  (display_order 9999, `is_selectable_by_parent=false`) i backfilluje wszystkich
  uczestników bez przypisania. Nowe dzieci dodawane przez „Dodaj dziecko
  z zewnątrz" bez wybranej grupy domyślnie trafiają do „Bez kategorii"
  (`createExternalChild`).
- `bulkUpdateParticipantGroup` w `lib/actions/participants.ts` — masowa zmiana
  grupy. `participants-list.tsx`: pasek akcji masowych (zmień grupę, eksport CSV,
  usuń, wyczyść zaznaczenie).
- `groups-list.tsx` — redukcja z ~1110 do ~700 linii dzięki wyniesieniu tabeli
  do wspólnego komponentu, ujednolicony wygląd listy dzieci między widokami.

### 2026-05-19 (Płatności — dialog wpłaty i etykiety)

- Dialog „Zarejestruj wpłatę": dodana lista wcześniejszych wpłat
  (`getPaymentTransactions`) z sumą „Razem". Checkbox „Zniżka" widoczny zawsze
  (wyszarzony / disabled gdy wpłata pokrywa należność).
- Etykieta `partially_paid` zmieniona z „Częściowo" na „Do dopłaty" w 6 miejscach
  (admin/payments, parent/payments, history, trip-payments, registrations,
  participant card). `partially_paid_overdue` ujednolicone do „Po terminie".

### 2026-05-19 (Wiadomości)

- `/admin/messages`: targetowanie wiadomości do grup treningowych (wybór wielu
  grup lub „wszyscy rodzice") — kolumna `messages.target_group_ids UUID[]`.
- Edycja wiadomości (dialog) z zachowaniem historii odczytań — akcja
  `updateMessage`, kolumna `messages.updated_at` + RLS UPDATE.
- Statystyki odczytów: licznik `X / N` + dialog z listą kto przeczytał /
  nie przeczytał — akcja `getMessageReadDetails`.
- Migracja `messages-groups-and-edit.sql` (do ręcznego uruchomienia na Supabase).
- Poprawiona odmiana „odczytanie/odczytania/odczytań".
- Panel rodzica: czerwona kropka przy nieprzeczytanej wiadomości, czerwony
  badge „X nowych".

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
