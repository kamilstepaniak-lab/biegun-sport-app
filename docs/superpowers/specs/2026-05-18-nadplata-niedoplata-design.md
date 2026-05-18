# Nadpłata i niedopłata płatności — projekt

Data: 2026-05-18
Status: zatwierdzony do implementacji

## Problem

Gdy cena karnetu (lub raty) wyjazdu zmienia się po tym, jak uczestnik już
zapłacił, system nie pokazuje powstałej różnicy:

- Przy obniżce ceny uczestnik, który zapłacił starą (wyższą) cenę, ma
  **nadpłatę** — dziś niewidoczną (płatność zostaje `paid`, nadwyżka
  wpada do `amount_paid` bez śladu).
- Przy podwyżce ceny uczestnik, który zapłacił starą (niższą) cenę, ma
  **niedopłatę** — dziś płatność dalej wygląda na w pełni opłaconą.

To samo dotyczy ręcznej korekty kwoty pojedynczej płatności w
`/admin/payments` (gdy uczestnik wpłaci złą kwotę).

Cel: nadpłata i niedopłata mają być wyliczane i widoczne, a niedopłata
ma być aktywną pozycją „do dopłaty" w panelu rodzica.

## Decyzje (ustalone z właścicielem)

1. Zmiana ceny w edycji wyjazdu przelicza także płatności już opłacone —
   **z wyjątkiem** płatności zmienionych indywidualnie (zniżka procentowa
   lub ręczna korekta kwoty). Te pozostają nietknięte; korekta tylko ręczna.
2. Niedopłata u uczestnika, który „zapłacił", staje się **aktywna do
   dopłaty** — płatność wraca do stanu częściowo opłaconej, rodzic widzi
   kwotę do uregulowania.
3. Nadpłata/niedopłata widoczna dla admina na liście `/admin/payments`.
4. Brak nowego statusu w bazie i brak migracji — saldo wyliczane.

## Model

`saldo = amount_paid − amount`

- `saldo > 0` → **nadpłata** (uczestnik wpłacił za dużo)
- `saldo < 0` → **niedopłata** / „do dopłaty"
- `saldo = 0` → rozliczone

Kolumna generowana `amount_remaining = amount − COALESCE(amount_paid, 0)`
już istnieje (migracja `missing-columns-and-contracts.sql`) i może być
ujemna. Saldo to po prostu `−amount_remaining`. Nie dodajemy nic do
schematu bazy.

**Tolerancja groszowa `SALDO_EPSILON = 0.5`** — jedna stała używana
spójnie: saldo uznajemy za niezerowe gdy `|amount_remaining| > 0.5`.
Poniżej progu (np. reszta 0,30 zł) płatność jest rozliczona i nie
pokazujemy badge'a. `recomputePaymentStatus` porównuje kwoty wprost
(`amountPaid >= amount`) bez tolerancji — jest to spójne: reszta 0,30 zł
daje status `paid` i brak badge'a.

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

Logika **kaskadowa** (`if / else if / else` — warunki zależne, nie
niezależne):

- `amountPaid >= amount` → `paid` (obejmuje też nadpłatę)
- w przeciwnym razie, jeśli `amountPaid > 0` (czyli
  `0 < amountPaid < amount`) → `partially_paid_overdue` jeśli po
  terminie, inaczej `partially_paid`
- w przeciwnym razie (`amountPaid <= 0`) → `overdue` jeśli po terminie,
  inaczej `pending`

„Po terminie" = `dueDate !== null` i data `dueDate` jest wcześniejsza
niż dziś. `dueDate === null` → płatność nigdy nie jest „po terminie".

Funkcja nie zwraca `cancelled` — wywołujący NIE woła jej dla płatności
anulowanych (patrz Komponent 2 i 3).

### 2. Synchronizacja cennika — `syncTripPaymentsAfterPricingChange` (`trips.ts`)

Obecna flaga `isAmountLocked` zostaje rozdzielona na dwie kategorie:

- **Indywidualnie zmieniona**: `discount_percentage > 0` LUB
  `amount !== original_amount`. → Synchronizujemy tylko `template_id`,
  `due_date`, `payment_method`. Kwota i status **nietknięte**.
- **Pozostałe** (w tym opłacone bez indywidualnej zmiany): ustawiamy
  `amount` i `original_amount` na kwotę z szablonu, `amount_paid`
  zachowujemy, `status` przeliczamy przez `recomputePaymentStatus`,
  `paid_at` aktualizujemy tylko przy zmianie stanu: zerujemy na `null`
  gdy status przestaje być `paid`; gdy płatność pozostaje `paid` (np.
  przecena w dół) `paid_at` zostaje bez zmian. `currency` zmieniamy
  tylko gdy
  `amount_paid === 0` — przy istniejącej wpłacie zmiana waluty
  zafałszowałaby wpłaconą kwotę.

**Świadoma zmiana semantyki:** dotychczasowa flaga `isAmountLocked`
blokowała przed przeliczeniem także zwykłe płatności opłacone (`paid`,
bez zniżki). Nowa logika je przelicza — to celowa zmiana, nie regresja.
Lockowane pozostają wyłącznie płatności indywidualnie zmienione
(zniżka procentowa lub ręczna korekta kwoty).

Pozostała logika bez zmian: dopinanie szablonów, tworzenie brakujących
płatności (z poszanowaniem trwale anulowanych), anulowanie płatności bez
pasującego szablonu. Płatności `cancelled` nie są dotykane.

### 3. `updatePaymentAmount` (`payments.ts`)

Funkcja zmienia **wyłącznie** kolumnę `amount` — `original_amount`
pozostaje **nietknięty**. To kluczowe: dzięki `amount !== original_amount`
płatność jest dalej rozpoznawana jako „indywidualnie zmieniona" i
chroniona przed edycją cennika (Komponent 2).

Po zapisaniu nowej kwoty funkcja pobiera `amount_paid`, `due_date` i
`status` płatności i przelicza `status` przez `recomputePaymentStatus`
(aktualizuje też `paid_at` — `null` gdy status przestaje być `paid`).
Dzięki temu ręczna korekta opłaconej płatności tworzy nadpłatę (status
zostaje `paid`) lub niedopłatę (status wraca do `partially_paid` → „do
dopłaty").

**Płatność `cancelled`:** jeśli korygowana płatność ma status
`cancelled`, funkcja zmienia tylko `amount` i **pomija** przeliczanie
statusu (nie wywołuje `recomputePaymentStatus`) — anulowana płatność
pozostaje anulowana.

### 4. Panel admina `/admin/payments` (`payments-list.tsx`)

Przy komórce statusu dodajemy mały wskaźnik salda, liczony z
`amount_remaining` wiersza, z progiem `SALDO_EPSILON = 0.5`:

- `amount_remaining < −SALDO_EPSILON` → zielony badge (wariant
  emerald, spójny z badge'em statusu `paid`) „Nadpłata X waluta"
- `amount_remaining > SALDO_EPSILON` przy statusie częściowym
  (`partially_paid` / `partially_paid_overdue`) → badge ostrzegawczy
  (wariant amber) „Do dopłaty X waluta", jawna kwota pod statusem

Kwota X to `Math.abs(amount_remaining)`. Jednostka to `row.currency`
(PLN/EUR) — nie zaszywać „zł" na sztywno, bo płatności mogą być w EUR.
Bez nowych kolumn tabeli — wskaźnik mieści się w istniejącej kolumnie
statusu.

### 5. Panel rodzica

Bez zmian w kodzie. Niedopłata jako `partially_paid` jest już
renderowana jako aktywna płatność do uregulowania (filtr parent
payments: `status !== 'paid' && status !== 'cancelled'`). Nadpłata
pozostaje `paid` — rodzic widzi płatność jako opłaconą, bez salda
ujemnego.

Krok = weryfikacja zachowania panelu rodzica:
- jeśli panel pokazuje kwotę do zapłaty z `amount_remaining` —
  niedopłata wyświetli poprawną resztę (wartość dodatnia);
- przy nadpłacie (`paid`, `amount_remaining` ujemne) panel nie może
  pokazać kwoty ujemnej — należy potwierdzić, że nadpłacona płatność
  renderuje się po prostu jako opłacona.
Jeśli weryfikacja wykryje, że któreś z tych założeń nie jest spełnione,
zakres się rozszerza o drobną poprawkę renderowania w panelu rodzica.

## Przypadki brzegowe

- Przecena opłaconego karnetu **w górę** → `partially_paid` (lub
  `partially_paid_overdue`), `paid_at` wyczyszczone, rodzic widzi „do
  dopłaty".
- Przecena **w dół** → status zostaje `paid`, `amount_remaining`
  ujemne → nadpłata, badge u admina.
- Po przecenie `amount_paid === amount` → `paid`, saldo zero.
- Historia wpłat (`payment_transactions`) nietknięta — saldo jest
  pochodną `amount`/`amount_paid`, niczego nie kasujemy ani nie
  modyfikujemy w transakcjach.
- Płatność `cancelled` — `recomputePaymentStatus` nie jest dla niej
  wywoływana; synchronizacja cennika jej nie dotyka.

## Poza zakresem (YAGNI)

- Nowy status `overpaid` w enumie bazy.
- Podsumowanie nadpłat/niedopłat w statystykach `/admin/payments`.
- Saldo na karcie uczestnika `/admin/participants`.
- Rejestr zwrotów / kredytów jako osobna tabela.
- Pokazywanie nadpłaty w panelu rodzica.

## Brak migracji bazy

Cała zmiana mieści się w logice serwera i UI. Nie wymaga uruchamiania
żadnej migracji SQL.
