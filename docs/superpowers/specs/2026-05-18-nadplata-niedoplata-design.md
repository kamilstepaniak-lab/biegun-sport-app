# Nadpłata, niedopłata i nadrzędność cennika — projekt

Data: 2026-05-18
Status: zatwierdzony do implementacji

## Problem

Po potwierdzeniu udziału przez rodzica uczestnik dostaje rekordy
płatności wynikające z cennika wyjazdu. Później cena może się zmienić —
i system musi to czytelnie odzwierciedlić:

- **Opcja 1 — zmiana cennika wyjazdu.** Admin edytuje ceny w formularzu
  wyjazdu. Nowe ceny muszą zaktualizować się u wszystkich uczestników:
  potwierdzonych (mają rekordy płatności) i niepotwierdzonych (jeszcze
  ich nie mają — patrz niżej).
- **Opcja 2 — zmiana indywidualna.** Admin edytuje cenę pojedynczej
  płatności albo nadaje zniżkę. To musi być widoczne dla rodzica.

W obu przypadkach, gdy nowa cena rozjedzie się z tym, co uczestnik już
wpłacił, powstaje **nadpłata** lub **niedopłata** — dziś niewidoczna.

## Decyzje (ustalone z właścicielem)

### D1. Cennik jest nadrzędny — twardy reset

Zmiana cennika w edycji wyjazdu ustawia nową cenę u **każdego**
potwierdzonego uczestnika — **bez wyjątków**, także u osób z
indywidualną zniżką lub ręczną korektą, także u tych, którzy już
zapłacili.

Konkretnie dla każdej pasującej płatności: `amount` i `original_amount`
ustawiane na kwotę z szablonu cennika, `discount_percentage` zerowane.
Dotychczasowa wpłata (`amount_paid`) zostaje nietknięta.

Przykład: karnet z ceną bazową 400 zł, uczestnik miał 40 zł zniżki
(do zapłaty 360 zł) i zapłacił 360 zł. Admin zmienia cennik na 500 zł →
płatność uczestnika: `amount = 500`, `amount_paid = 360` →
**niedopłata 140 zł**. Rodzic widzi „500 zł, zapłacone 360 zł".
Następnie admin **ręcznie** koryguje cenę tej osobie pod zniżkę
(opcja 2). Przywracanie zniżek po zmianie cennika to świadomy, ręczny
krok — system go nie automatyzuje.

### D2. Niepotwierdzeni nie mają rekordów płatności

Rekordy w tabeli `payments` powstają dopiero przy potwierdzeniu udziału
(`createPaymentsForRegistration`). Uczestnik niepotwierdzony widzi
bezpośrednio cennik wyjazdu (`trip_payment_templates`). Zmiana cennika
aktualizuje go automatycznie — nie wymaga żadnej logiki per-uczestnik.

### D3. Zmiana indywidualna jest widoczna dla rodzica

Ręczna korekta kwoty (`updatePaymentAmount`) i nadanie zniżki
(`applyDiscount`) przeliczają status płatności, więc rodzic od razu
widzi efekt — w tym niedopłatę jako aktywną pozycję „do dopłaty".

### D4. Niedopłata jest aktywna „do dopłaty"

Niedopłata u uczestnika, który „zapłacił", staje się aktywną pozycją —
płatność wraca do statusu częściowo opłaconej, rodzic widzi kwotę do
uregulowania.

### D5. Brak nowego statusu i brak migracji

Saldo jest wyliczane z istniejących kolumn. Enum `PaymentStatus` bez
zmian, schemat bazy bez zmian.

## Model

`saldo = amount_paid − amount`

- `saldo > 0` → **nadpłata** (uczestnik wpłacił za dużo)
- `saldo < 0` → **niedopłata** / „do dopłaty"
- `saldo = 0` → rozliczone

Kolumna generowana `amount_remaining = amount − COALESCE(amount_paid, 0)`
już istnieje (migracja `missing-columns-and-contracts.sql`) i może być
ujemna. Saldo to `−amount_remaining`. Nie dodajemy nic do schematu bazy.

**Tolerancja groszowa `SALDO_EPSILON = 0.5`** — jedna stała używana
spójnie: saldo uznajemy za niezerowe gdy `|amount_remaining| > 0.5`.
Poniżej progu (np. reszta 0,30 zł) płatność jest rozliczona i nie
pokazujemy badge'a. `recomputePaymentStatus` porównuje kwoty wprost
(`amountPaid >= amount`) bez tolerancji — spójne: reszta 0,30 zł daje
status `paid` i brak badge'a.

Enum `PaymentStatus` bez zmian: `pending | partially_paid | paid |
overdue | partially_paid_overdue | cancelled`.

- niedopłata = istniejący `partially_paid` / `partially_paid_overdue`
- nadpłata = `paid` z ujemnym `amount_remaining`

## Komponenty

### 1. `recomputePaymentStatus(amount, amountPaid, dueDate)`

Nowa, czysta funkcja w `src/lib/actions/payments.ts` — jedno źródło
prawdy dla statusu płatności.

Sygnatura:
`recomputePaymentStatus(amount: number, amountPaid: number, dueDate: string | null): PaymentStatus`

Logika **kaskadowa** (`if / else if / else` — warunki zależne):

- `amountPaid >= amount` → `paid` (obejmuje też nadpłatę)
- w przeciwnym razie, jeśli `amountPaid > 0` (czyli
  `0 < amountPaid < amount`) → `partially_paid_overdue` jeśli po
  terminie, inaczej `partially_paid`
- w przeciwnym razie (`amountPaid <= 0`) → `overdue` jeśli po terminie,
  inaczej `pending`

„Po terminie" = `dueDate !== null` i data `dueDate` wcześniejsza niż
dziś. `dueDate === null` → płatność nigdy nie jest „po terminie".

Funkcja nie zwraca `cancelled` — wywołujący NIE woła jej dla płatności
anulowanych.

### 2. Synchronizacja cennika — `syncTripPaymentsAfterPricingChange` (`trips.ts`)

Uruchamiana wyłącznie gdy cennik faktycznie się zmienił (flaga
`pricingChanged` z `paymentTemplatesEqual` — już zaimplementowana).

Dla każdego uczestnika `active` + `participation_status = 'confirmed'`,
dla każdego pasującego (rocznikowo) szablonu:

- **Płatność pasująca istnieje** → twardy reset zgodnie z D1:
  - `amount` = `template.amount`
  - `original_amount` = `template.amount`
  - `discount_percentage` = `0`
  - `currency` = `template.currency` — **tylko gdy `amount_paid === 0`**;
    przy istniejącej wpłacie walutę zostawiamy (zmiana zafałszowałaby
    wpłaconą kwotę)
  - `due_date` = `template.due_date`, `template_id` = `template.id`,
    `payment_method` = `template.payment_method`
  - `amount_paid` — **bez zmian**
  - `status` — przeliczony przez `recomputePaymentStatus(amount,
    amount_paid, due_date)`
  - `paid_at` — zerowany na `null` gdy status przestaje być `paid`;
    gdy płatność pozostaje `paid` (przecena w dół) `paid_at` zostaje
    bez zmian
- **Brak pasującej płatności** → utwórz nową (`pending`), z
  poszanowaniem trwale anulowanych: jeśli dla danego
  `(payment_type, installment_number)` istnieje już płatność
  `cancelled`, nowej NIE tworzymy.
- **Płatność bez pasującego szablonu** → anuluj, jeśli ma status
  oczekujący (`pending`, `overdue`, `partially_paid`,
  `partially_paid_overdue`).

**Brak wyjątku „indywidualnie zmieniona".** To świadoma zmiana wobec
dotychczasowego `isAmountLocked` (który chronił płatności opłacone i ze
zniżką). Zgodnie z D1 cennik nadpisuje wszystko; przywracanie zniżek to
osobny ręczny krok admina przez Komponent 3.

Płatności `cancelled` nie są dotykane (nie trafiają do
`recomputePaymentStatus`).

### 3. Zmiana indywidualna — `updatePaymentAmount` i `applyDiscount` (`payments.ts`)

Obie funkcje po zmianie kwoty przeliczają `status` przez
`recomputePaymentStatus` (na podstawie `amount_paid` i `due_date`
płatności) i aktualizują `paid_at` (`null` gdy status przestaje być
`paid`).

- `updatePaymentAmount` — zmienia **wyłącznie** `amount`;
  `original_amount` pozostaje nietknięty (kolumna „Zniżka" w panelu
  admina liczy się jako `original_amount − amount`).
- `applyDiscount` — bez zmian w obliczaniu (`amount =
  original_amount × (1 − %/100)`), dochodzi tylko przeliczenie statusu.

Dzięki temu ręczna korekta opłaconej płatności tworzy nadpłatę (status
zostaje `paid`) lub niedopłatę (status wraca do `partially_paid` → „do
dopłaty").

**Płatność `cancelled`:** obie funkcje, jeśli płatność ma status
`cancelled`, zmieniają tylko kwotę i **pomijają** przeliczanie statusu —
anulowana płatność pozostaje anulowana.

### 4. Panel admina `/admin/payments` (`payments-list.tsx`)

Przy komórce statusu mały wskaźnik salda, liczony z `amount_remaining`
wiersza, z progiem `SALDO_EPSILON = 0.5`:

- `amount_remaining < −SALDO_EPSILON` → zielony badge (wariant emerald,
  spójny z badge'em statusu `paid`) „Nadpłata X waluta"
- `amount_remaining > SALDO_EPSILON` przy statusie częściowym
  (`partially_paid` / `partially_paid_overdue`) → badge ostrzegawczy
  (wariant amber) „Do dopłaty X waluta"

Kwota X = `Math.abs(amount_remaining)`. Jednostka = `row.currency`
(PLN/EUR) — nie zaszywać „zł". Bez nowych kolumn tabeli — wskaźnik
mieści się w istniejącej kolumnie statusu.

### 5. Panel rodzica

Bez zmian w kodzie. Niedopłata jako `partially_paid` jest już
renderowana jako aktywna płatność do uregulowania (filtr parent
payments: `status !== 'paid' && status !== 'cancelled'`). Nadpłata
pozostaje `paid` — rodzic widzi płatność jako opłaconą.

Krok = weryfikacja zachowania panelu rodzica:
- jeśli panel pokazuje kwotę do zapłaty z `amount_remaining` —
  niedopłata wyświetli poprawną resztę (wartość dodatnia);
- przy nadpłacie (`paid`, `amount_remaining` ujemne) panel nie może
  pokazać kwoty ujemnej — potwierdzić, że nadpłacona płatność renderuje
  się po prostu jako opłacona.
Jeśli weryfikacja wykryje, że założenie nie jest spełnione, zakres się
rozszerza o drobną poprawkę renderowania w panelu rodzica.

## Przypadki brzegowe

- Przecena opłaconego karnetu **w górę** (lub reset zniżki) →
  `partially_paid` / `partially_paid_overdue`, `paid_at` wyczyszczone,
  rodzic widzi „do dopłaty".
- Przecena **w dół** → status zostaje `paid`, `amount_remaining`
  ujemne → nadpłata, badge u admina.
- Po przecenie `amount_paid === amount` → `paid`, saldo zero.
- Uczestnik ze zniżką, który zapłacił → po zmianie cennika dostaje
  niedopłatę równą zniżce; admin koryguje ręcznie (Komponent 3).
- Historia wpłat (`payment_transactions`) nietknięta — saldo to
  pochodna `amount`/`amount_paid`, transakcji nie modyfikujemy.
- Płatność `cancelled` — nie dotykana przez synchronizację ani przez
  przeliczanie statusu.

## Poza zakresem (YAGNI)

- Nowy status `overpaid` w enumie bazy.
- Automatyczne przywracanie zniżek po zmianie cennika.
- Podsumowanie nadpłat/niedopłat w statystykach `/admin/payments`.
- Saldo na karcie uczestnika `/admin/participants`.
- Rejestr zwrotów / kredytów jako osobna tabela.
- Pokazywanie nadpłaty w panelu rodzica.

## Brak migracji bazy

Cała zmiana mieści się w logice serwera i UI. Nie wymaga uruchamiania
żadnej migracji SQL.
