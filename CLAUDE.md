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

Pełne zasady wyglądu są w osobnym pliku **[`design.md`](design.md)**.
**Przed każdym zadaniem dotyczącym UI / wyglądu czytaj `design.md`** —
tam są: stack, zasady nadrzędne, kolory, statusy, layout/nagłówki i ton
tekstów UI. Nie powielaj tych zasad tutaj.

## Notatki z sesji

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

**Zawsze na końcu każdej sesji/zadania** (nie tylko przy push/deploy) dopisz
poniżej krótką notatkę z najważniejszymi zmianami wprowadzonymi w danej sesji
— bez proszenia przez użytkownika. Nagłówek z datą, najnowsze wpisy na górze.
Jeśli w danym dniu istnieje już nagłówek tego samego tematu, dopisz do niego
nowe punkty. Nowy temat = nowy nagłówek (mogą być różne tematy z tą samą datą).
Notatka ma być zwięzła (punkty, pliki, intencja zmiany).

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
