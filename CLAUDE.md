# CLAUDE.md

Wskazówki dla Claude przy pracy nad projektem `biegun-sport-app`
(Next.js App Router + Supabase + Vercel).

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

Stack: Tailwind v4 (config w CSS, `src/app/globals.css`) + shadcn/ui (Radix)
+ lucide-react. Brak pliku `tailwind.config` — tokeny są w `@theme` i `:root`.

### Zasady nadrzędne

1. **Jeden spójny język wizualny** dla panelu admina i rodzica — te same
   tokeny, komponenty, radius, nagłówki. Różnią się treścią i nawigacją,
   nie wyglądem.
2. **Komponenty zawsze z `src/components/ui`** (button, card, dialog, table,
   badge, input, select...). Najpierw szukaj istniejącego — nowy twórz tylko
   gdy naprawdę brak. **Zero inline ad-hoc styli** powielających to, co już
   jest w ui.
3. **Tylko jasny motyw.** Dark mode ignorujemy — nie dodawaj wariantów
   `dark:`, nie testuj dark. (Definicja `.dark` w globals.css jest martwa.)
4. **Oba urządzenia krytyczne.** Każdy ekran musi wyglądać dobrze na telefonie
   i na desktopie — sprawdzaj obie szerokości zanim powiesz „gotowe". To PWA
   (safe-area), panel rodzica używany głównie na telefonie.

### Kolory

- **Kolor wiodący (brand): niebieski `#2563eb`** (= `blue-600`). Tokeny shadcn
  `--primary` i `--ring` są przepisane na ten niebieski w globals.css, więc
  `bg-primary` i domyślny `Button` są już niebieskie. Dla statycznego brandu
  możesz używać `blue-600` zamiennie.
- **Neutralne: slate.** Tekst główny `#0f172a` (slate-900), tekst pomocniczy
  `#475569` (slate-600), wyciszony `#94a3b8`, linie/obramowania `#e2e8f0`,
  tło sekcji `#f8fafc`. Zmienne `--admin-*` w globals.css.
- **Statusy** (ujednolicony standard — używaj konsekwentnie):
  - sukces / opłacone → **emerald** (`bg-emerald-100` / `text-emerald-700`)
  - ostrzeżenie / do dopłaty → **amber** (`bg-amber-100` / `text-amber-700`)
  - błąd / po terminie → **red** (`bg-red-100` / `text-red-700`)
  - info / akcja → **blue** (`bg-blue-600` / `text-blue-700`)
  - Stare `green-*` zostało zmigrowane na `emerald-*` w całym `src/` —
    nie dokładaj nowych `green`.

### Layout i nagłówki

- **`.page-header` to kanon na każdej podstronie** (admin i rodzic): tytuł
  + krótki opis + akcje. W `.admin-shell` ma jasny gradient z grafiką gór
  (`/parent-hero-mountains.svg`). Nie wymyślaj alternatywnych nagłówków.
- Radius: karty `14px` (`rounded-2xl` w admin-shell), mniejsze elementy `10px`.
  Cienie subtelne (`shadow-sm` = ledwie widoczny). Trzymaj się skali z globals.

### Ton tekstów UI

- **Admin = rzeczowo i krótko**, język produktowy, bez lania wody.
- **Rodzic = ciepło i przyjaźnie**, zachęcająco, zgodnie z Tone of Voice
  BiegunSport. Puste stany i komunikaty mają wspierać, nie tylko informować.
- Zawsze polski. Bez emoji (chyba że wprost poproszę).

## Notatki z sesji

**Zawsze na końcu każdej sesji/zadania** (nie tylko przy push/deploy) dopisz
poniżej krótką notatkę z najważniejszymi zmianami wprowadzonymi w danej sesji
— bez proszenia przez użytkownika. Nagłówek z datą, najnowsze wpisy na górze.
Jeśli w danym dniu istnieje już nagłówek tego samego tematu, dopisz do niego
nowe punkty. Nowy temat = nowy nagłówek (mogą być różne tematy z tą samą datą).
Notatka ma być zwięzła (punkty, pliki, intencja zmiany).

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
- Odłożone do zrobienia z testem na żywo: podwójny redirect ChildUrlSync +
  ChildGuard (#13) — celowa defensywa, refaktor wymaga przeklikania wyboru
  dziecka, by nie wprowadzić regresji.
- Do decyzji biznesowej: badge „Zapisy zamknięte" po `declaration_deadline`
  (#4) — dziś deadline nie blokuje potwierdzania, więc badge kłamałby; wymaga
  decyzji czy blokować spóźnione deklaracje.
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
