# Wpłaty, zniżka, nadpłata i niedopłata — projekt

Data: 2026-05-18
Status: zatwierdzony do implementacji

## Problem

Po potwierdzeniu udziału uczestnik dostaje rekordy płatności wynikające
z cennika wyjazdu. W praktyce wpłata rodzica często nie zgadza się z
ceną cennikową (np. wpłata 322 zł przy cenie 400 zł). Dziś panel
`/admin/payments` pozwala tylko przełączyć płatność „opłacona /
nieopłacona" — nie ma rejestrowania faktycznej kwoty wpłaty, więc admin
nie ma jak poprawnie odzwierciedlić wpłaty częściowej ani zniżki.

Cel: admin rejestruje realną kwotę wpłaty; przy wpłacie mniejszej niż
należna jednym kliknięciem decyduje, czy to **zniżka** (płatność
zamknięta), czy **niedopłata** (brakująca kwota dalej do uregulowania).
Nadpłata i niedopłata mają być wyliczane i widoczne.

## Stan obecny (z eksploracji kodu)

- `/admin/payments` (`payments-list.tsx`): admin może przełączać status
  (`updatePaymentStatus` → `paid` ustawia `amount_paid = amount`,
  `pending` zeruje), edytować kwotę należną (tryb `zł` →
  `updatePaymentAmount`; tryb `%` → `applyDiscount`), edytować notatkę,
  usuwać płatności. **Brak rejestrowania wpłat częściowych.**
- `addPaymentTransaction` i `markPaymentAsPaid` istnieją w
  `payments.ts`, ale **żaden UI ich nie wywołuje**.
- Tabela `payment_transactions` przechowuje historię wpłat; strona
  `/admin/payments/history` ją pokazuje.
- Kolumna generowana `amount_remaining = amount − COALESCE(amount_paid,0)`
  już istnieje i może być ujemna.

## Decyzje (ustalone z właścicielem)

### D1. Rejestrowanie wpłaty z checkboxem „zniżka"

Admin w `/admin/payments` rejestruje wpłatę: podaje kwotę z banku,
metodę i datę. Wpłata trafia do `payment_transactions` (historia
zachowana) i powiększa `amount_paid`.

Gdy suma wpłat jest **mniejsza** niż kwota należna (`amount`), w
formularzu wpłaty dostępny jest checkbox **„zniżka"**:

- **zaznaczony** → kwota należna `amount` zostaje obniżona do sumy
  wpłat (`amount := amount_paid`); płatność staje się `paid`. Cena
  cennikowa zostaje w `original_amount`, więc różnica
  (`original_amount − amount`) pokazuje się jako zniżka.
- **niezaznaczony** → `amount` bez zmian; płatność = `partially_paid`
  (lub `partially_paid_overdue`); widoczna niedopłata „brak X zł".

Checkbox jest nieaktywny/ukryty, gdy wpłata pokrywa lub przekracza
kwotę należną (nie ma czego „rabatować").

### D2. Edycja kwoty należnej

Admin może wprost edytować kwotę należną (`updatePaymentAmount`) — gdy z
góry ustala inną cenę. Po edycji status jest przeliczany.

### D3. Usunięcie trybu procentowego

Tryb `%` w edytorze kwoty (`applyDiscount`) zostaje usunięty z UI —
zastępuje go checkbox „zniżka" przy wpłacie. Mechanizm procentowy nie
jest już potrzebny.

### D4. Cennik nadrzędny

Zmiana cennika w edycji wyjazdu ustawia nową cenę u **każdego**
potwierdzonego uczestnika (`amount` i `original_amount` = kwota z
szablonu). Dotychczasowa wpłata (`amount_paid`) zostaje. Indywidualne
zniżki przepadają — admin w razie potrzeby nadaje je ponownie. To
świadoma decyzja.

### D5. Niepotwierdzeni nie mają rekordów płatności

Rekordy `payments` powstają przy potwierdzeniu udziału. Niepotwierdzony
uczestnik widzi cennik wyjazdu — zmiana cennika działa u niego
automatycznie, bez logiki per-uczestnik.

### D6. Niedopłata aktywna „do dopłaty"

Niedopłata to status `partially_paid` / `partially_paid_overdue` —
rodzic widzi ją jako aktywną pozycję do uregulowania.

### D7. Brak nowego statusu i brak migracji

Saldo wyliczane z istniejących kolumn. Enum `PaymentStatus` i schemat
bazy bez zmian.

## Model

`saldo = amount_paid − amount`

- `saldo > 0` → **nadpłata**
- `saldo < 0` → **niedopłata** / „do dopłaty"
- `saldo = 0` → rozliczone

Saldo = `−amount_remaining` (kolumna generowana). Bez zmian w schemacie.

**Tolerancja groszowa `SALDO_EPSILON = 0.5`** — saldo uznajemy za
niezerowe gdy `|amount_remaining| > 0.5`. `recomputePaymentStatus`
porównuje kwoty wprost, bez tolerancji (reszta 0,30 zł → `paid`, brak
badge'a — spójne).

Enum `PaymentStatus` bez zmian: `pending | partially_paid | paid |
overdue | partially_paid_overdue | cancelled`.

- niedopłata = `partially_paid` / `partially_paid_overdue`
- nadpłata = `paid` z ujemnym `amount_remaining`

## Komponenty

### 1. `recomputePaymentStatus(amount, amountPaid, dueDate)`

Czysta funkcja w `src/lib/actions/payments.ts` — jedno źródło prawdy
dla statusu.

Sygnatura:
`recomputePaymentStatus(amount: number, amountPaid: number, dueDate: string | null): PaymentStatus`

Logika kaskadowa (`if / else if / else`):

- `amountPaid >= amount` → `paid` (obejmuje nadpłatę)
- inaczej, jeśli `amountPaid > 0` → `partially_paid_overdue` jeśli po
  terminie, inaczej `partially_paid`
- inaczej (`amountPaid <= 0`) → `overdue` jeśli po terminie, inaczej
  `pending`

„Po terminie" = `dueDate !== null` i data wcześniejsza niż dziś.
`dueDate === null` → nigdy „po terminie".

Funkcja nie zwraca `cancelled` — nie jest wołana dla płatności
anulowanych.

### 2. Rejestrowanie wpłaty + checkbox „zniżka" (`payments.ts` + `payments-list.tsx`)

**Server action.** Rozszerzenie istniejącej `addPaymentTransaction` o
opcjonalny parametr `closeAsDiscount: boolean` (domyślnie `false`):

1. Wstawia rekord do `payment_transactions` (jak dziś).
2. Liczy `newAmountPaid = amount_paid + kwota wpłaty` (suma wszystkich
   wpłat).
3. Jeśli `closeAsDiscount === true` **i** `newAmountPaid < amount`:
   ustawia `amount := newAmountPaid` (obniżenie kwoty należnej do
   pełnej sumy wpłat). `original_amount` bez zmian.
4. Status przeliczany przez `recomputePaymentStatus` na podstawie
   finalnych `amount` i `newAmountPaid`. `paid_at`: gdy status =
   `paid` — ustawiane na **datę wpłaty z formularza**; gdy nie —
   zerowane.
5. Walidacja: kwota wpłaty > 0; `closeAsDiscount` ignorowane gdy wpłata
   pokrywa należność (`newAmountPaid >= amount`) lub gdy płatność jest
   już `paid` (wtedy checkbox jest no-op). Płatność `cancelled` —
   rejestrowanie wpłaty niedozwolone (zwróć błąd, komunikat w toaście).

**UI.** W `/admin/payments` przy każdym wierszu wejście „Zarejestruj
wpłatę" otwierające mały formularz: kwota, metoda (gotówka/przelew),
data, oraz checkbox „zniżka — zamknij płatność mimo niższej kwoty"
widoczny tylko gdy wpisana kwota < kwota pozostała do zapłaty.

### 3. Pozostałe akcje statusu (`payments.ts`)

- **`updatePaymentAmount`** — zmienia wyłącznie `amount`
  (`original_amount` nietknięty). Po zmianie przelicza `status` przez
  `recomputePaymentStatus` i aktualizuje `paid_at`. Płatność
  `cancelled` — zmiana tylko `amount`, bez przeliczania statusu.
- **`updatePaymentStatus`** (przełącznik „opłacone/nieopłacone" w UI) —
  zachowuje obecne działanie (`paid` → `amount_paid := amount`;
  `pending` → `amount_paid := 0`; `cancelled` → bez zmian kwot), ale
  wynikowy `status` wyprowadza przez `recomputePaymentStatus` zamiast
  ustawiać go na sztywno. Dzięki temu `recomputePaymentStatus`
  pozostaje jedynym źródłem prawdy dla statusu.
- **`applyDiscount`** — akcja **usuwana** (po zdjęciu trybu `%` z UI nie
  ma wywołującego; D3).
- **`markPaymentAsPaid`** — poza zakresem; pozostaje nietknięta (już
  dziś nieużywana przez żaden UI).

### 4. Synchronizacja cennika — `syncTripPaymentsAfterPricingChange` (`trips.ts`)

Uruchamiana tylko gdy cennik faktycznie się zmienił (flaga
`pricingChanged` — już zaimplementowana).

Dla każdego uczestnika `active` + `participation_status = 'confirmed'`,
dla każdego pasującego (rocznikowo) szablonu:

- **Płatność istnieje** → `amount` i `original_amount` = kwota z
  szablonu; `currency` = waluta szablonu tylko gdy `amount_paid === 0`
  (inaczej walutę zostawiamy); `due_date`, `template_id`,
  `payment_method` z szablonu; `amount_paid` bez zmian; `status`
  przeliczony przez `recomputePaymentStatus`; `paid_at` zerowane gdy
  status przestaje być `paid`, zachowane gdy pozostaje `paid`.
  Uwaga: gdy szablon zmienił walutę, a płatność ma już wpłatę
  (`amount_paid > 0`), zostaje stara waluta przy nowej kwocie — admin
  poprawia walutę ręcznie. Świadomy kompromis.
- **Brak płatności** → utwórz nową (`pending`), z poszanowaniem trwale
  anulowanych: jeśli dla `(payment_type, installment_number)` istnieje
  płatność `cancelled`, nowej nie tworzymy.
- **Płatność bez szablonu** → anuluj, jeśli ma status oczekujący.

Brak wyjątku dla płatności indywidualnie zmienionych — zgodnie z D4
cennik nadpisuje wszystko. Płatności `cancelled` nietykane.

### 5. Panel admina `/admin/payments` (`payments-list.tsx`)

- Wskaźnik salda przy statusie, z progiem `SALDO_EPSILON = 0.5`,
  pomijany dla płatności `cancelled`:
  - `amount_remaining < −SALDO_EPSILON` i `status !== 'cancelled'` →
    zielony badge (emerald) „Nadpłata X waluta"
  - `amount_remaining > SALDO_EPSILON` przy statusie częściowym
    (`partially_paid` / `partially_paid_overdue`) → badge amber
    „Do dopłaty X waluta"
  - kwota X = `Math.abs(amount_remaining)`, jednostka = `row.currency`
- Kolumna „Zniżka" zostaje — pokazuje `original_amount − amount`
  (różnica dodatnia = zniżka). Liczona jak dziś.
- Edytor kwoty: usunięty przełącznik `zł / %` — zostaje samo pole
  kwoty (tryb `zł`).
- Nowe wejście „Zarejestruj wpłatę" (Komponent 2).

### 6. Panel rodzica — bez zmian (zweryfikowane)

Kod panelu rodzica (`parent/payments/payments-list.tsx`) został
sprawdzony — żadna zmiana nie jest potrzebna:

- Płatność `paid` pokazuje `payment.amount` (kwota dodatnia). Nadpłata
  (`paid`, `amount_remaining` ujemne) renderuje się więc po prostu jako
  opłacona — bez kwoty ujemnej.
- Płatność niezapłacona pokazuje `remaining = amount − amount_paid`
  (dodatnie). Niedopłata jako `partially_paid` /
  `partially_paid_overdue` wyświetla poprawną resztę „do dopłaty" i
  trafia do podsumowań „Do zapłaty" / „Zaległość".

Komponent jest zatem czysto weryfikacyjny, bez pracy implementacyjnej.

## Przypadki brzegowe

- Wpłata 322 przy należnych 400, „zniżka" zaznaczona → `amount = 322`,
  `paid`, kolumna „Zniżka" pokazuje 78.
- Wpłata 322 przy należnych 400, „zniżka" niezaznaczona →
  `partially_paid`, „brak 78 zł".
- Wpłata większa niż należność → `paid`, `amount_remaining` ujemne →
  badge „Nadpłata".
- Kolejna wpłata po częściowej → `amount_paid` się sumuje, status
  przeliczany.
- Zmiana cennika po wpłacie → `amount`/`original_amount` reset do nowej
  ceny, status przeliczony; ewentualną zniżkę admin nadaje ponownie.
- Płatność `cancelled` — nie przyjmuje wpłat, nie jest synchronizowana,
  nie trafia do `recomputePaymentStatus`.
- Historia `payment_transactions` nigdy nie jest modyfikowana wstecz.

## Poza zakresem (YAGNI)

- Nowy status `overpaid` w enumie bazy.
- Tryb procentowy zniżki — akcja `applyDiscount` usuwana w całości.
- Automatyczne przywracanie zniżek po zmianie cennika.
- Podsumowanie nadpłat/niedopłat w statystykach.
- Saldo na karcie uczestnika.
- Rejestr zwrotów / kredytów.
- Pokazywanie nadpłaty w panelu rodzica.

## Brak migracji bazy

Cała zmiana mieści się w logice serwera i UI. Żadna migracja SQL nie
jest wymagana. Kolumna `discount_percentage` pozostaje w bazie (bez
migracji), ale przestaje być używana po usunięciu trybu `%`.
