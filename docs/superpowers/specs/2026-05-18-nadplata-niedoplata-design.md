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

Enum `PaymentStatus` bez zmian: `pending | partially_paid | paid |
overdue | partially_paid_overdue | cancelled`.

- niedopłata = istniejący `partially_paid` / `partially_paid_overdue`
- nadpłata = `paid` z ujemnym `amount_remaining`

## Komponenty

### 1. `recomputePaymentStatus(amount, amountPaid, dueDate)`

Nowa, czysta funkcja w `src/lib/actions/payments.ts` — jedno źródło
prawdy dla statusu płatności:

- `amountPaid >= amount` → `paid` (obejmuje też nadpłatę)
- `amountPaid > 0` → `partially_paid_overdue` jeśli po terminie, inaczej
  `partially_paid`
- `amountPaid <= 0` → `overdue` jeśli po terminie, inaczej `pending`

„Po terminie" = `dueDate` istnieje i `dueDate < dziś`. Funkcja nie
dotyka statusu `cancelled` — wywołujący nie woła jej dla anulowanych.

### 2. Synchronizacja cennika — `syncTripPaymentsAfterPricingChange` (`trips.ts`)

Obecna flaga `isAmountLocked` zostaje rozdzielona na dwie kategorie:

- **Indywidualnie zmieniona**: `discount_percentage > 0` LUB
  `amount !== original_amount`. → Synchronizujemy tylko `template_id`,
  `due_date`, `payment_method`. Kwota i status **nietknięte**.
- **Pozostałe** (w tym opłacone bez indywidualnej zmiany): ustawiamy
  `amount` i `original_amount` na kwotę z szablonu, `amount_paid`
  zachowujemy, `status` przeliczamy przez `recomputePaymentStatus`,
  `paid_at` ustawiamy zgodnie z nowym statusem (`null` gdy status
  przestaje być `paid`). `currency` zmieniamy tylko gdy
  `amount_paid === 0` — przy istniejącej wpłacie zmiana waluty
  zafałszowałaby wpłaconą kwotę.

Pozostała logika bez zmian: dopinanie szablonów, tworzenie brakujących
płatności (z poszanowaniem trwale anulowanych), anulowanie płatności bez
pasującego szablonu.

### 3. `updatePaymentAmount` (`payments.ts`)

Po zapisaniu nowej kwoty funkcja pobiera `amount_paid` i `due_date`
płatności i przelicza `status` przez `recomputePaymentStatus`
(aktualizuje też `paid_at`). Dzięki temu ręczna korekta opłaconej
płatności tworzy nadpłatę (status zostaje `paid`) lub niedopłatę
(status wraca do `partially_paid` → „do dopłaty"). Płatność po ręcznej
korekcie ma `amount !== original_amount`, więc jest dalej chroniona
przed edycją cennika.

### 4. Panel admina `/admin/payments` (`payments-list.tsx`)

Przy komórce statusu dodajemy mały wskaźnik salda, liczony z
`amount_remaining` wiersza:

- `amount_remaining < −0.5` → zielony badge „Nadpłata X zł"
- `amount_remaining > 0.5` przy statusie częściowym → „Do dopłaty X zł"
  (jawna kwota pod statusem)

Kwota X to `Math.abs(amount_remaining)`. Bez nowych kolumn tabeli —
wskaźnik mieści się w istniejącej kolumnie statusu.

### 5. Panel rodzica

Bez zmian w kodzie. Niedopłata jako `partially_paid` jest już
renderowana jako aktywna płatność do uregulowania (filtr parent
payments: `status !== 'paid' && status !== 'cancelled'`). Nadpłata
pozostaje `paid` — rodzic widzi płatność jako opłaconą, bez salda
ujemnego. Krok: tylko weryfikacja zachowania.

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
