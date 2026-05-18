# Wpłaty, zniżka, nadpłata i niedopłata — plan implementacji

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umożliwić adminowi rejestrowanie realnych wpłat z checkboxem „zniżka" oraz uczynić nadpłatę i niedopłatę widoczną w panelu.

**Architecture:** Jedna czysta funkcja `recomputePaymentStatus` jest jedynym źródłem prawdy dla statusu płatności; wszystkie akcje serwerowe (`addPaymentTransaction`, `updatePaymentAmount`, `updatePaymentStatus`, synchronizacja cennika) ją wywołują. Saldo (nadpłata/niedopłata) jest wyliczane z istniejącej kolumny generowanej `amount_remaining` — bez zmian w schemacie bazy.

**Tech Stack:** Next.js App Router (Server Actions), Supabase, TypeScript, React, Tailwind, Radix UI, sonner (toasty).

**Spec:** `docs/superpowers/specs/2026-05-18-nadplata-niedoplata-design.md`

**Brak frameworka testowego.** Projekt nie ma test-runnera. Weryfikacja każdego zadania: `npx tsc --noEmit` (typy) + `npm run lint` (lint). Weryfikacja funkcjonalna: ręczny checklist w przeglądarce (Chunk 4).

**Brak migracji bazy.** Żadne zadanie nie wymaga uruchamiania SQL na Supabase.

**Stan wyjściowy:** plik `src/lib/actions/trips.ts` ma już niezacommitowane zmiany z tej samej funkcji (flaga `pricingChanged` + ochrona trwale anulowanych płatności w `syncTripPaymentsAfterPricingChange`). Zadanie 7 commituje je i rozbudowuje.

---

## File Structure

- `src/lib/actions/payments.ts` — dodanie `recomputePaymentStatus`; modyfikacja `addPaymentTransaction`, `updatePaymentAmount`, `updatePaymentStatus`; usunięcie `applyDiscount`.
- `src/lib/actions/trips.ts` — modyfikacja `syncTripPaymentsAfterPricingChange` (twardy reset + przeliczanie statusu).
- `src/components/admin/record-payment-dialog.tsx` — NOWY komponent: dialog rejestrowania wpłaty z checkboxem „zniżka".
- `src/app/(protected)/admin/payments/payments-list.tsx` — usunięcie trybu `%`, podpięcie dialogu wpłaty, badge salda.

---

## Chunk 1: Logika statusu i akcje serwerowe

### Task 1: Funkcja `recomputePaymentStatus`

**Files:**
- Modify: `src/lib/actions/payments.ts`

- [ ] **Step 1: Dodaj funkcję `recomputePaymentStatus`**

Wstaw na końcu pliku `src/lib/actions/payments.ts` (po ostatniej akcji, przed końcem pliku) nową funkcję modułową. NIE eksportuj jej jako server action — to czysta funkcja pomocnicza, więc nie dawaj `'use server'`-owego eksportu z `async` jeśli nie musi być async (ma być synchroniczna):

```typescript
// Jedyne źródło prawdy dla statusu płatności. Wyliczany ze stosunku
// kwoty wpłaconej do należnej oraz terminu. NIE zwraca 'cancelled' —
// nie wolno jej wołać dla płatności anulowanych.
function recomputePaymentStatus(
  amount: number,
  amountPaid: number,
  dueDate: string | null,
): PaymentStatus {
  const isOverdue = dueDate !== null && new Date(dueDate) < new Date();
  if (amountPaid >= amount) return 'paid';
  if (amountPaid > 0) return isOverdue ? 'partially_paid_overdue' : 'partially_paid';
  return isOverdue ? 'overdue' : 'pending';
}
```

- [ ] **Step 2: Dodaj `PaymentStatus` do importu typów**

W `src/lib/actions/payments.ts` linia 6 ma:
```typescript
import type { Payment, PaymentWithDetails, PaymentTransaction, AdminPaymentRow } from '@/types';
```
Zmień na:
```typescript
import type { Payment, PaymentWithDetails, PaymentTransaction, AdminPaymentRow, PaymentStatus } from '@/types';
```

- [ ] **Step 3: Weryfikacja typów**

Run: `npx tsc --noEmit`
Expected: brak błędów. (TS może ostrzec, że `recomputePaymentStatus` jest nieużywana — to OK, użyją jej kolejne zadania. Jeśli lint traktuje to jako błąd, przejdź od razu do Task 2 i zweryfikuj łącznie.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/payments.ts
git commit -m "feat: funkcja recomputePaymentStatus — jedno źródło prawdy dla statusu płatności"
```

---

### Task 2: Rozszerzenie `addPaymentTransaction` o checkbox „zniżka"

**Files:**
- Modify: `src/lib/actions/payments.ts` (funkcja `addPaymentTransaction`, ok. linie 275-361)

- [ ] **Step 1: Dodaj parametr `closeAsDiscount`**

Sygnatura `addPaymentTransaction` ma obecnie parametry `paymentId, amount, currency, transactionDate, paymentMethod, notes?`. Dodaj na końcu opcjonalny `closeAsDiscount: boolean = false`:

```typescript
export async function addPaymentTransaction(
  paymentId: string,
  amount: number,
  currency: 'PLN' | 'EUR',
  transactionDate: string,
  paymentMethod: 'cash' | 'transfer',
  notes?: string,
  closeAsDiscount: boolean = false,
) {
```

- [ ] **Step 2: Walidacja kwoty i statusu `cancelled`**

Tuż po pobraniu płatności (`if (paymentError || !payment) { return ... }`), dodaj:

```typescript
  if (amount <= 0) {
    return { error: 'Kwota wpłaty musi być większa od zera' };
  }
  if (payment.status === 'cancelled') {
    return { error: 'Nie można rejestrować wpłaty dla anulowanej płatności' };
  }
```

- [ ] **Step 3: Zastąp blok wyliczania statusu**

Obecny fragment (ok. linie 317-337) wygląda tak:

```typescript
  // Zaktualizuj amount_paid
  const newAmountPaid = (payment.amount_paid || 0) + amount;
  let newStatus = payment.status;

  if (newAmountPaid >= payment.amount) {
    newStatus = 'paid';
  } else if (newAmountPaid > 0) {
    const isOverdue = payment.due_date && new Date(payment.due_date) < new Date();
    newStatus = isOverdue ? 'partially_paid_overdue' : 'partially_paid';
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      payment_method_used: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
```

Zamień na:

```typescript
  // Zaktualizuj amount_paid
  const newAmountPaid = (payment.amount_paid || 0) + amount;

  // Checkbox „zniżka": gdy wpłata nie pokrywa należności, obniżamy kwotę
  // należną do sumy wpłat — płatność zostaje zamknięta jako opłacona.
  // original_amount (cena cennikowa) zostaje, więc widać wielkość zniżki.
  const newAmount =
    closeAsDiscount && newAmountPaid < payment.amount ? newAmountPaid : payment.amount;

  const newStatus = recomputePaymentStatus(newAmount, newAmountPaid, payment.due_date);

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      amount: newAmount,
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date(transactionDate).toISOString() : null,
      payment_method_used: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);
```

Uwaga: `payment` jest pobierany przez `select('*')`, więc `payment.due_date` i `payment.amount` są dostępne.

- [ ] **Step 4: Weryfikacja typów i lintu**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/payments.ts
git commit -m "feat: addPaymentTransaction — opcja zniżki zamykającej płatność"
```

---

### Task 3: `updatePaymentAmount` i `updatePaymentStatus` — przeliczanie statusu

**Files:**
- Modify: `src/lib/actions/payments.ts` (funkcje `updatePaymentAmount` ok. 951-981, `updatePaymentStatus` ok. 843-949)

- [ ] **Step 1: `updatePaymentAmount` — przeliczanie statusu**

Obecna funkcja (ok. 951-981) robi tylko `update({ amount: newAmount, updated_at })`. Zamień blok pobrania/aktualizacji tak, by przeliczał status. Cała funkcja po zmianie:

```typescript
export async function updatePaymentAmount(paymentId: string, newAmount: number) {
  const supabase = await createClient();

  const { error: authError } = await requireAdmin(supabase);
  if (authError) return { error: authError };

  if (newAmount < 0) {
    return { error: 'Kwota nie może być ujemna' };
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('amount_paid, due_date, status')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    return { error: 'Nie znaleziono płatności' };
  }

  const updateData: Record<string, unknown> = {
    amount: newAmount,
    updated_at: new Date().toISOString(),
  };

  // Płatność anulowana — zmieniamy tylko kwotę, statusu nie ruszamy.
  if (payment.status !== 'cancelled') {
    const newStatus = recomputePaymentStatus(newAmount, payment.amount_paid || 0, payment.due_date);
    updateData.status = newStatus;
    updateData.paid_at = newStatus === 'paid' ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (error) {
    console.error('Update payment amount error:', error);
    return { error: `Nie udało się zaktualizować kwoty: ${error.message}` };
  }

  revalidateTag('payments');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/trips');
  revalidatePath('/parent/payments');

  return { success: true };
}
```

- [ ] **Step 2: `updatePaymentStatus` — status wyprowadzany z `recomputePaymentStatus`**

W `updatePaymentStatus` linia ~855 pobiera `select('amount, status, amount_paid')`. Dodaj `due_date`:

```typescript
  const { data: payment } = await supabase
    .from('payments')
    .select('amount, status, amount_paid, due_date')
    .eq('id', paymentId)
    .single();
```

Następnie zamień blok budowania `updateData` (ok. linie 866-878):

```typescript
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'paid') {
    updateData.amount_paid = payment.amount;
    updateData.paid_at = new Date().toISOString();
    updateData.marked_by = user.id;
  } else if (status === 'pending') {
    updateData.amount_paid = 0;
    updateData.paid_at = null;
  }
```

na:

```typescript
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status === 'cancelled') {
    // Anulowanie — status ustawiany wprost, kwot nie ruszamy.
    updateData.status = 'cancelled';
  } else {
    // 'paid' → traktujemy jak pełną wpłatę; 'pending' → zerujemy wpłatę.
    // Wynikowy status zawsze przez recomputePaymentStatus (jedno źródło prawdy).
    const newAmountPaid = status === 'paid' ? payment.amount : 0;
    const computed = recomputePaymentStatus(payment.amount, newAmountPaid, payment.due_date);
    updateData.amount_paid = newAmountPaid;
    updateData.status = computed;
    updateData.paid_at = computed === 'paid' ? new Date().toISOString() : null;
    if (status === 'paid') updateData.marked_by = user.id;
  }
```

Uwaga: blok audit logu i e-maila (ok. linie 890-941) zostaje bez zmian — opiera się na parametrze wejściowym `status`, nie na `updateData.status`. To akceptowalne: e-mail wysyła się gdy admin kliknął „opłacone".

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/payments.ts
git commit -m "feat: updatePaymentAmount i updatePaymentStatus przeliczają status przez recomputePaymentStatus"
```

---

### Task 4: Usunięcie akcji `applyDiscount`

**Files:**
- Modify: `src/lib/actions/payments.ts` (funkcja `applyDiscount` ok. 473-517)

- [ ] **Step 1: Sprawdź, kto wywołuje `applyDiscount`**

Run: `grep -rn "applyDiscount" src --include="*.ts" --include="*.tsx"`
Expected: wystąpienia tylko w `payments.ts` (definicja) i `payments-list.tsx` (import + użycie). Użycie w UI usuwa Task 8 — dlatego TEN task wykonaj DOPIERO po Task 8, albo usuń import w `payments-list.tsx` tu i teraz, jeśli Task 8 jeszcze nie był robiony.

- [ ] **Step 2: Usuń funkcję `applyDiscount`**

Usuń całą funkcję `export async function applyDiscount(...) { ... }` z `src/lib/actions/payments.ts` (ok. linie 473-517).

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit`
Expected: brak błędów. Jeśli pojawi się błąd „applyDiscount is not exported / used" w `payments-list.tsx` — oznacza, że Task 8 nie został jeszcze wykonany. W takim wypadku wykonaj najpierw Task 8, potem wróć tutaj.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/payments.ts
git commit -m "refactor: usunięcie nieużywanej akcji applyDiscount (tryb procentowy zniżki)"
```

---

## Chunk 2: Synchronizacja cennika

### Task 5: Twardy reset cen w `syncTripPaymentsAfterPricingChange`

**Files:**
- Modify: `src/lib/actions/trips.ts` (funkcja `syncTripPaymentsAfterPricingChange`)

Kontekst: funkcja istnieje już w `trips.ts` (dodana wcześniej, niezacommitowana). Zawiera obecnie logikę `isAmountLocked`, która chroni płatności opłacone/ze zniżką. Zgodnie ze spec D4 ta ochrona znika — cennik nadpisuje wszystko.

- [ ] **Step 1: Dodaj lokalną funkcję statusu na początku `trips.ts`**

`recomputePaymentStatus` w `payments.ts` jest funkcją modułową (nieeksportowaną). Aby uniknąć eksportowania jej jako server action z pliku `'use server'`, zduplikuj tę samą czystą logikę jako prywatną funkcję w `trips.ts`. Dodaj tuż przed `syncTripPaymentsAfterPricingChange`:

```typescript
// Lokalna kopia logiki statusu (recomputePaymentStatus z payments.ts).
// Powielona świadomie: pliki 'use server' nie powinny eksportować
// synchronicznych helperów. Obie kopie muszą pozostać identyczne.
function computePaymentStatus(
  amount: number,
  amountPaid: number,
  dueDate: string | null,
): 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'partially_paid_overdue' {
  const isOverdue = dueDate !== null && new Date(dueDate) < new Date();
  if (amountPaid >= amount) return 'paid';
  if (amountPaid > 0) return isOverdue ? 'partially_paid_overdue' : 'partially_paid';
  return isOverdue ? 'overdue' : 'pending';
}
```

- [ ] **Step 2: Zastąp gałąź `if (match)` twardym resetem**

W pętli `for (const template of applicableTemplates)` obecna gałąź `if (match) { ... }` rozróżnia `isAmountLocked`. Zastąp CAŁĄ gałąź `if (match)` (od `if (match) {` do jej zamykającego `}` przed `else`) tym:

```typescript
      if (match) {
        // D4: cennik jest nadrzędny — twardy reset ceny u każdego
        // potwierdzonego uczestnika, bez wyjątków. Wpłata zostaje.
        // Walutę zmieniamy tylko gdy nie ma jeszcze żadnej wpłaty.
        const newStatus = computePaymentStatus(
          template.amount,
          match.amount_paid ?? 0,
          template.due_date,
        );
        const update: Record<string, unknown> = {
          amount: template.amount,
          original_amount: template.amount,
          discount_percentage: 0,
          due_date: template.due_date,
          template_id: template.id,
          payment_method: template.payment_method,
          status: newStatus,
          paid_at: newStatus === 'paid' ? (match.status === 'paid' ? undefined : new Date().toISOString()) : null,
        };
        if ((match.amount_paid ?? 0) === 0) {
          update.currency = template.currency;
        }
        // Usuń klucze undefined (gdy paid_at ma zostać bez zmian).
        Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

        await supabaseAdmin
          .from('payments')
          .update(update)
          .eq('id', match.id);
      } else {
```

Uwaga: pole `match` musi udostępniać `amount_paid` i `status`. Sprawdź zapytanie pobierające `existing` / `existingPayments` — jeśli `select` nie zawiera `amount_paid` lub `status`, dodaj je. (Obecny `select` to `'id, payment_type, installment_number, status, amount, original_amount, amount_paid, discount_percentage'` — zawiera oba, więc zmiana nie jest potrzebna.)

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów. Jeśli TS zgłosi nieużywane pole z dawnej logiki `isAmountLocked` — usuń martwy kod.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/trips.ts
git commit -m "feat: edycja cennika nadpisuje ceny u wszystkich potwierdzonych (twardy reset)"
```

Ten commit obejmuje też wcześniejsze niezacommitowane zmiany w `trips.ts` (flaga `pricingChanged`, ochrona trwale anulowanych płatności) — są częścią tej samej funkcji.

---

## Chunk 3: UI panelu admina

### Task 6: Komponent `RecordPaymentDialog`

**Files:**
- Create: `src/components/admin/record-payment-dialog.tsx`

- [ ] **Step 1: Utwórz komponent dialogu wpłaty**

Wzoruj się na istniejących dialogach w `src/components/` (Radix `Dialog` jest już w zależnościach: `@radix-ui/react-dialog`; sprawdź `src/components/ui/dialog.tsx`). Komponent przyjmuje płatność i renderuje formularz: kwota wpłaty, metoda, data oraz checkbox „zniżka". Pełny kod:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { addPaymentTransaction } from '@/lib/actions/payments';

interface RecordPaymentDialogProps {
  paymentId: string;
  currency: 'PLN' | 'EUR';
  amountRemaining: number; // amount - amount_paid (>0 = do zapłaty)
  onDone: () => void;
  children: React.ReactNode; // element wyzwalający (trigger)
}

export function RecordPaymentDialog({
  paymentId, currency, amountRemaining, onDone, children,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('transfer');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closeAsDiscount, setCloseAsDiscount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseFloat(amount);
  const amountValid = !isNaN(parsed) && parsed > 0;
  // Checkbox „zniżka" ma sens tylko gdy wpłata nie pokrywa należności.
  const showDiscount = amountValid && parsed < amountRemaining;

  async function handleSubmit() {
    if (!amountValid) {
      toast.error('Podaj poprawną kwotę wpłaty');
      return;
    }
    setSubmitting(true);
    try {
      const result = await addPaymentTransaction(
        paymentId, parsed, currency, date, method, undefined,
        showDiscount ? closeAsDiscount : false,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wpłata zarejestrowana');
        setOpen(false);
        setAmount('');
        setCloseAsDiscount(false);
        onDone();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zarejestruj wpłatę</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-amount">Kwota wpłaty ({currency})</Label>
            <Input
              id="rp-amount" type="number" min="0" step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="np. 322" autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Metoda</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'cash' | 'transfer')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Przelew</SelectItem>
                  <SelectItem value="cash">Gotówka</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-date">Data wpłaty</Label>
              <Input
                id="rp-date" type="date"
                value={date} onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          {showDiscount && (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="rp-discount" checked={closeAsDiscount}
                onCheckedChange={(c) => setCloseAsDiscount(!!c)}
              />
              <Label htmlFor="rp-discount" className="font-normal cursor-pointer text-sm">
                Zniżka — zamknij płatność jako opłaconą mimo niższej kwoty
                (kwota należna spadnie do {parsed.toFixed(0)} {currency})
              </Label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !amountValid}>
              {submitting ? 'Zapisywanie...' : 'Zapisz wpłatę'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Sprawdź, czy istnieje `src/components/ui/dialog.tsx`**

Run: `ls src/components/ui/dialog.tsx`
Expected: plik istnieje. Jeśli nie — sprawdź jak inne komponenty robią dialog (`grep -rln "DialogContent" src/components`) i dostosuj importy.

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/record-payment-dialog.tsx
git commit -m "feat: dialog rejestrowania wpłaty z checkboxem zniżka"
```

---

### Task 7: Badge salda (nadpłata/niedopłata) w liście płatności

**Files:**
- Modify: `src/app/(protected)/admin/payments/payments-list.tsx`

- [ ] **Step 1: Dodaj stałą `SALDO_EPSILON` i helper badge'a**

W `payments-list.tsx`, w ciele komponentu listy (obok innych helperów jak `getStatusBadge`), dodaj stałą modułową na górze pliku (poza komponentem):

```typescript
// Próg tolerancji groszowej — saldo poniżej uznajemy za rozliczone.
const SALDO_EPSILON = 0.5;
```

- [ ] **Step 2: Wyrenderuj badge w komórce statusu**

W `renderRow`, w komórce `{/* Status */}` (zaraz po `<span>` ze `statusLabel`), dodaj wskaźnik salda. `row.amount_remaining` to `amount − amount_paid`:

```tsx
        {(() => {
          if (row.status === 'cancelled') return null;
          const rem = row.amount_remaining ?? (row.amount - (row.amount_paid ?? 0));
          if (rem < -SALDO_EPSILON) {
            return (
              <span className="mt-1 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                Nadpłata {Math.abs(rem).toFixed(0)} {row.currency}
              </span>
            );
          }
          if (rem > SALDO_EPSILON && (row.status === 'partially_paid' || row.status === 'partially_paid_overdue')) {
            return (
              <span className="mt-1 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                Do dopłaty {rem.toFixed(0)} {row.currency}
              </span>
            );
          }
          return null;
        })()}
```

Umieść to wewnątrz `<td>` komórki statusu, pod istniejącym `<span>` statusu; owiń całość tak, by oba elementy ułożyły się pionowo (np. `<div className="flex flex-col items-start gap-1">`).

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów. Jeśli TS zgłosi, że `amount_remaining` nie istnieje na typie `AdminPaymentRow` — użyj wyłącznie wariantu `row.amount - (row.amount_paid ?? 0)`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/admin/payments/payments-list.tsx"
git commit -m "feat: badge nadpłaty i niedopłaty na liście płatności admina"
```

---

### Task 8: Usunięcie trybu `%` i podpięcie dialogu wpłaty

**Files:**
- Modify: `src/app/(protected)/admin/payments/payments-list.tsx`

- [ ] **Step 1: Usuń tryb procentowy z edytora kwoty**

W `payments-list.tsx`:
- Usuń import `applyDiscount` z `@/lib/actions/payments`.
- W funkcji `saveAmount` usuń całą gałąź `editMode === 'percent'` — zostaje tylko `await updatePaymentAmount(paymentId, value)` oraz walidacja kwoty. Usuń też walidację `> 100` i komunikaty zależne od `editMode`.
- W edytorze kwoty (komórka `{/* Kwota */}`, tryb edycji) usuń dwa przyciski przełącznika `zł` / `%` i powiązany stan `editMode` / `setEditMode`. Zostaje samo pole liczbowe kwoty.

Po zmianie `saveAmount` powinno wyglądać mniej więcej tak:

```typescript
  async function saveAmount(paymentId: string) {
    const value = parseFloat(editAmount);
    if (isNaN(value) || value < 0) {
      toast.error('Podaj poprawną kwotę');
      return;
    }
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentAmount(paymentId, value);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Kwota zaktualizowana');
        setEditingPayment(null);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }
```

- [ ] **Step 2: Podepnij `RecordPaymentDialog`**

Zaimportuj komponent:
```typescript
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog';
```

W `renderRow` dodaj przycisk „Wpłata" (np. w komórce akcji obok edycji notatki/statusu), owinięty dialogiem:

```tsx
<RecordPaymentDialog
  paymentId={row.id}
  currency={row.currency as 'PLN' | 'EUR'}
  amountRemaining={(row.amount_remaining ?? (row.amount - (row.amount_paid ?? 0)))}
  onDone={() => router.refresh()}
>
  <button className="text-xs font-medium text-blue-600 hover:underline" disabled={row.status === 'cancelled'}>
    + Wpłata
  </button>
</RecordPaymentDialog>
```

Dostosuj klasy/umiejscowienie do istniejącego układu wiersza (wzoruj się na przyciskach edycji już obecnych w `renderRow`).

- [ ] **Step 3: Weryfikacja**

Run: `npx tsc --noEmit && npm run lint`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/admin/payments/payments-list.tsx"
git commit -m "feat: rejestrowanie wpłaty z listy płatności; usunięcie trybu procentowego"
```

---

## Chunk 4: Weryfikacja końcowa

### Task 9: Build i ręczny test

- [ ] **Step 1: Pełny build**

Run: `npm run build`
Expected: build kończy się sukcesem, bez błędów typów ani lintu.

- [ ] **Step 2: Ręczny checklist w przeglądarce**

Uruchom `npm run dev` i sprawdź w panelu admina (`/admin/payments`) oraz rodzica (`/parent/payments`):

- [ ] Rejestrowanie wpłaty pełnej (= kwota należna) → status „Opłacone", brak badge'a salda.
- [ ] Rejestrowanie wpłaty niższej, checkbox „zniżka" ZAZNACZONY → status „Opłacone", kolumna „Zniżka" pokazuje różnicę, brak niedopłaty.
- [ ] Rejestrowanie wpłaty niższej, checkbox „zniżka" NIEZAZNACZONY → status „Częściowo", badge „Do dopłaty X".
- [ ] Rejestrowanie wpłaty wyższej niż należna → status „Opłacone", badge „Nadpłata X".
- [ ] Checkbox „zniżka" nie pojawia się, gdy wpisana kwota pokrywa należność.
- [ ] Próba rejestrowania wpłaty dla płatności anulowanej → komunikat błędu.
- [ ] Edycja kwoty należnej przy danej osobie → status przelicza się poprawnie.
- [ ] Przełącznik „opłacone/nieopłacone" działa jak wcześniej.
- [ ] Edycja cennika wyjazdu (zmiana ceny karnetu) → u potwierdzonych uczestników kwoty zaktualizowane; opłacony uczestnik z niższą wpłatą dostaje niedopłatę.
- [ ] Edycja wyjazdu BEZ zmiany cennika (np. sam tytuł) → płatności uczestników nietknięte.
- [ ] Panel rodzica: niedopłata widoczna jako aktywne „do dopłaty"; nadpłata pokazana jako opłacona (bez kwoty ujemnej).
- [ ] W edytorze kwoty nie ma już przełącznika `zł / %`.

- [ ] **Step 3: Raport**

Jeśli wszystkie punkty przechodzą — zgłoś gotowość do wdrożenia. Jeśli któryś nie przechodzi — użyj superpowers:systematic-debugging przed dalszymi zmianami.

---

## Uwagi końcowe

- **Bez migracji bazy** — żaden krok nie wymaga uruchamiania SQL na Supabase.
- **Push i wdrożenie** — zgodnie z `CLAUDE.md` po zakończeniu zapytaj właściciela o push na `main` (wdrożenie produkcyjne Vercel). Nie pushuj bez potwierdzenia.
- **`recomputePaymentStatus` / `computePaymentStatus`** — dwie identyczne kopie (payments.ts i trips.ts) celowo; przy zmianie logiki statusu zaktualizuj obie.
