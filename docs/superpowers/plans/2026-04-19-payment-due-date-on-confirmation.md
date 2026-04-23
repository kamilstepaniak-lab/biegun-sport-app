# Payment Due Date on Confirmation – Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a parent confirms a trip ("jedzie"), store the actual computed `due_date` (confirmed_at + N days) in the `payments` table so all views (parent dashboard, wyjazd, płatności; admin płatności, wyjazd) display a real date instead of the label "5 dni od potwierdzenia".

**Architecture:** `createPaymentsForRegistration` receives `confirmedAt` and converts `due_days_from_confirmation` into a concrete `due_date` before inserting payments. All display locations read `payment.due_date` directly — no more client-side calculation from template. General cennik in trip lists (before any confirmation) keeps the template label.

**Tech Stack:** Next.js 14, Supabase (PostgreSQL), TypeScript, date-fns

---

## Chunk 1: Core — compute and store due_date at confirmation

### Task 1: Update `createPaymentsForRegistration` to accept and apply `confirmedAt`

**Files:**
- Modify: `src/lib/actions/payments.ts:357-427`

- [ ] **Step 1: Add `confirmedAt` parameter and compute `due_date` for day-based templates**

In `createPaymentsForRegistration(registrationId, tripId, participantId)`, change signature to:
```typescript
export async function createPaymentsForRegistration(
  registrationId: string,
  tripId: string,
  participantId: string,
  confirmedAt: string
)
```

In the `.map()` at line 396, add import at top of file if missing:
```typescript
import { addDays, format } from 'date-fns';
```

Change the map to compute `due_date` when `due_days_from_confirmation` is set:
```typescript
.map((template: {
  id: string;
  payment_type: string;
  installment_number: number | null;
  amount: number;
  currency: string;
  due_date: string | null;
  due_days_from_confirmation: number | null;
  payment_method: string | null;
}) => {
  let dueDate: string | null = template.due_date ?? null;
  if (template.due_days_from_confirmation != null) {  // != null, not falsy — Zod enforces .positive() but be explicit
    dueDate = format(
      addDays(new Date(confirmedAt), template.due_days_from_confirmation),
      'yyyy-MM-dd'
    );
  }
  return {
    registration_id: registrationId,
    template_id: template.id,
    payment_type: template.payment_type,
    installment_number: template.installment_number,
    original_amount: template.amount,
    discount_percentage: 0,
    amount: template.amount,
    currency: template.currency,
    due_date: dueDate,
    status: 'pending',
    amount_paid: 0,
  };
})
```

- [ ] **Step 2: Also include `due_days_from_confirmation` in the template select query (line 362)**

The `.select('*')` at line 362 already fetches all columns — no change needed. Verify `due_days_from_confirmation` is in the result by checking that the select is `'*'`.

- [ ] **Step 3: Update the two call sites in `trips.ts` to pass `confirmedAt`**

In `src/lib/actions/trips.ts`:

**Call site 1 (line ~947)** — admin manually creating registration:
```typescript
await createPaymentsForRegistration(registrationId, tripId, participantId, new Date().toISOString());
```

Also in the admin `updateParticipationStatus` function (around line 903), the `.update()` call sets `participation_status` but NOT `confirmed_at`. Add it:
```typescript
.update({
  participation_status: status,
  participation_note: note || null,
  confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
})
```
This mirrors what the parent path already does at line 1178.

**Call site 2 (line ~1221)** — parent clicks "jedzie":
```typescript
await createPaymentsForRegistration(registrationId, tripId, participantId, new Date().toISOString());
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/kamilstepaniak/Desktop/BS APP Claude ver.2" && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to `createPaymentsForRegistration`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/payments.ts src/lib/actions/trips.ts
git commit -m "feat: store computed due_date in payments at confirmation time"
```

---

## Chunk 2: Fix email to use payment due_date

### Task 2: Change confirmation email to read from `payments` not `trip_payment_templates`

**Files:**
- Modify: `src/lib/actions/trips.ts:1262-1300`
- Modify: `src/lib/email.ts:236-248`

- [ ] **Step 1: In `trips.ts` email section, fetch from `payments` for this registration**

Replace the `paymentTemplates` fetch (lines ~1262-1267) with a fetch from `payments`:

```typescript
// Pobierz płatności dla tej rejestracji (mają już konkretne due_date)
const { data: registrationPayments } = await supabaseAdmin
  .from('payments')
  .select('payment_type, installment_number, amount, currency, due_date, payment_method')
  .eq('registration_id', registrationId!)
  .neq('status', 'cancelled')
  .order('installment_number', { ascending: true });
```

Pass `registrationPayments` to the email helper instead of `paymentTemplates`. Find where `paymentTemplates` is passed to `sendTripConfirmationEmail` (or the inline email builder) and replace it with `registrationPayments`.

**Also remove the birth-year filter block** (lines ~1272-1282) that filters `paymentTemplates` by child's birth year — this is now dead code because `createPaymentsForRegistration` already applied birth-year filtering when creating the payments, so the payments table already contains only relevant rows.

- [ ] **Step 2: Fix `email.ts` to not use `due_days_from_confirmation`**

In `src/lib/email.ts:243-247`, the email already checks `p.due_date` in the else branch. Change to always use `due_date`:

```typescript
const dueStr = p.due_date
  ? ` · termin: ${new Date(p.due_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`
  : '';
```

Remove the `p.due_days_from_confirmation` branch entirely.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/trips.ts src/lib/email.ts
git commit -m "fix: confirmation email shows actual due_date instead of template label"
```

---

## Chunk 3: Fix dashboard

### Task 3: Simplify `dashboard.ts` — remove on-the-fly calculation

**Files:**
- Modify: `src/lib/actions/dashboard.ts:195-225`

- [ ] **Step 1: Remove `calcConfirmationDueDate` usage**

In `dashboard.ts`, the block at lines 204-214 computes `effectiveDueDate` from `due_days_from_confirmation + confirmed_at`. Replace with:

```typescript
const effectiveDueDate = p.due_date ?? null;
const awaitingConfirmation = false; // due_date is now always set at confirmation
```

Remove the `calcConfirmationDueDate` import if no longer used elsewhere in this file.

Remove the `dueDaysFromConfirmation` / `confirmedAt` / `confDueDate` variables entirely.

- [ ] **Step 2: Verify `awaiting_confirmation` usage in dashboard-blocks.tsx**

Check line 272 in `dashboard-blocks.tsx`:
```tsx
{p.awaiting_confirmation
  ? `${p.due_days_from_confirmation} dni od potwierdzenia`
  : p.effective_due_date
    ? `...`
    : 'Brak terminu'}
```

Since `awaiting_confirmation` is now always `false`, simplify to:
```tsx
{p.effective_due_date
  ? `${p.isOverdue ? 'Termin minął' : 'Do'} ${format(new Date(p.effective_due_date), 'd MMM yyyy', { locale: pl })}`
  : 'Brak terminu'}
```

Remove `awaiting_confirmation` from the data type/return shape in `dashboard.ts` and from display in `dashboard-blocks.tsx`.

Also remove `due_days_from_confirmation` from the payment shape passed to the dashboard component if it's no longer needed for display.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/dashboard.ts src/app/\(protected\)/parent/children/dashboard-blocks.tsx
git commit -m "fix: dashboard shows computed due_date instead of label"
```

---

## Chunk 4: Fix parent payments list

### Task 4: Parent `payments-list.tsx` — remove `calcConfirmationDueDate`

**Files:**
- Modify: `src/app/(protected)/parent/payments/payments-list.tsx:199, 363`

- [ ] **Step 1: Remove `calcConfirmationDueDate` at line 199**

Find the block:
```typescript
? calcConfirmationDueDate(payment.due_days_from_confirmation!, payment.confirmed_at)
```
Replace with just `payment.due_date ? new Date(payment.due_date) : null`.

If there's an overdue check (`isConfirmationDeadlineOverdue`), replace with `payment.due_date ? new Date(payment.due_date) < new Date() : false`.

- [ ] **Step 2: Remove `calcConfirmationDueDate` at line 363**

Same pattern — replace with `p.due_date ? new Date(p.due_date) : null`.

- [ ] **Step 3: Remove unused imports**

Remove `calcConfirmationDueDate` and `isConfirmationDeadlineOverdue` from the import at line 23 if no longer used.

- [ ] **Step 4: Ensure the query fetches `payments.due_date` (not just from template join)**

The payment query should select `due_date` directly from `payments`. Verify the Supabase select includes `due_date` on the payments table — not just via the template join.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(protected\)/parent/payments/payments-list.tsx
git commit -m "fix: parent payments shows actual due_date instead of calculated label"
```

---

## Chunk 5: Fix admin payment lists

### Task 5: Admin `payments-list.tsx` — remove `calcConfirmationDueDate`

**Files:**
- Modify: `src/app/(protected)/admin/payments/payments-list.tsx:474`

- [ ] **Step 1: Replace `calcConfirmationDueDate` at line 474**

```typescript
// Before:
const confDueDate = calcConfirmationDueDate(payment.template.due_days_from_confirmation, confirmedAt);

// After:
const confDueDate = payment.due_date ? new Date(payment.due_date) : null;
```

Remove the `confirmedAt` lookup if it's only used for this calculation.

- [ ] **Step 2: Remove unused imports**

Remove `calcConfirmationDueDate`, `isConfirmationDeadlineOverdue` imports if unused.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Task 6: Admin `trip-payments-list.tsx` — remove `calcConfirmationDueDate`

**Files:**
- Modify: `src/app/(protected)/admin/trips/[id]/payments/trip-payments-list.tsx:266`

- [ ] **Step 1: Replace `calcConfirmationDueDate` at line 266**

```typescript
// Before:
const dueDate = calcConfirmationDueDate(p.template.due_days_from_confirmation, confirmedAt);

// After:
const dueDate = p.due_date ? new Date(p.due_date) : null;
```

Remove `confirmedAt` lookup and template join for `due_days_from_confirmation` if no longer needed.

- [ ] **Step 2: Remove unused imports**

- [ ] **Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | head -30
git add src/app/\(protected\)/admin/payments/payments-list.tsx src/app/\(protected\)/admin/trips/\[id\]/payments/trip-payments-list.tsx
git commit -m "fix: admin payment views show actual due_date instead of calculated label"
```

---

## Chunk 6: Fix parent trip-card (wyjazd tab) — show per-child payment due dates

### Task 7: Add payment data to `ChildTripStatus` and `getTripsForParentWithChildren`

**Files:**
- Modify: `src/lib/actions/trips.ts` (interfaces + `getTripsForParentWithChildren`)

- [ ] **Step 1: Extend `ChildTripStatus` interface**

```typescript
export interface ChildPaymentSummary {
  template_id: string | null;
  payment_type: string;
  installment_number: number | null;
  amount: number;
  currency: string;
  due_date: string | null;
}

export interface ChildTripStatus {
  child_id: string;
  child_name: string;
  participation_status: 'unconfirmed' | 'confirmed' | 'not_going' | 'other';
  participation_note: string | null;
  registration_id: string | null;       // add
  payments: ChildPaymentSummary[];      // add — empty if not confirmed
}
```

- [ ] **Step 2: Fetch payments per registration in `getTripsForParentWithChildren`**

After building `childrenStatuses` (around line 1113), for each child that has a registration, fetch their payments:

```typescript
// Collect registration_ids for confirmed children
const regIds = childrenStatuses
  .filter(c => c.registration_id)
  .map(c => c.registration_id as string);

let paymentsByReg: Record<string, ChildPaymentSummary[]> = {};
if (regIds.length > 0) {
  const { data: payments } = await supabase
    .from('payments')
    .select('registration_id, template_id, payment_type, installment_number, amount, currency, due_date')
    .in('registration_id', regIds)
    .neq('status', 'cancelled')
    .order('installment_number', { ascending: true });

  for (const p of payments ?? []) {
    if (!paymentsByReg[p.registration_id]) paymentsByReg[p.registration_id] = [];
    paymentsByReg[p.registration_id].push(p);
  }
}

// Attach payments to each child status
childrenStatuses.forEach(c => {
  c.payments = c.registration_id ? (paymentsByReg[c.registration_id] ?? []) : [];
});
```

**Required: capture `registration_id` in the `childrenStatuses` map.** The current `.map()` at line ~1113 returns only `child_id`, `child_name`, `participation_status`, `participation_note`. Add `registration_id` from the registration lookup — without this, `regIds` will always be empty and no payments will be fetched. Example:
```typescript
{
  child_id: child.id,
  child_name: `${child.first_name} ${child.last_name}`,
  participation_status: reg?.participation_status ?? 'unconfirmed',
  participation_note: reg?.participation_note ?? null,
  registration_id: reg?.id ?? null,   // ← add this
  payments: [],                        // ← filled below
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Task 8: Display per-child payment due dates in trip-card

**Files:**
- Modify: `src/app/(protected)/parent/trips/trip-card.tsx`

- [ ] **Step 1: Add import for `format` from date-fns if not already imported**

Check existing imports and add if needed:
```typescript
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
```

- [ ] **Step 2: Add per-child payment summary section in the child status area**

In the per-child section (around line 178 where status is displayed), after the status badge, add a payment due-date mini-list for confirmed children with payments:

```tsx
{currentStatus === 'confirmed' && child.payments.length > 0 && (
  <div className="mt-1.5 space-y-0.5">
    {child.payments.map((p, i) => {
      const label = p.payment_type === 'installment'
        ? `Rata ${p.installment_number}`
        : p.payment_type === 'season_pass'
          ? 'Karnet'
          : 'Opłata';
      const dateStr = p.due_date
        ? `do ${format(new Date(p.due_date), 'd MMM yyyy', { locale: pl })}`
        : 'brak terminu';
      return (
        <p key={i} className="text-xs text-gray-500">
          {label}: <span className="font-medium">{p.amount.toFixed(0)} {p.currency}</span>
          {' · '}{dateStr}
        </p>
      );
    })}
  </div>
)}
```

Find the exact location by searching for `currentStatus === 'confirmed'` and the section that shows the stop/status badge (around lines 195-260).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/trips.ts src/app/\(protected\)/parent/trips/trip-card.tsx
git commit -m "feat: show per-child payment due dates in parent trip card"
```

---

## Chunk 7: Cleanup + final verification

### Task 9: Cleanup unused helpers in `payment-due.ts`

**Files:**
- Modify: `src/lib/payment-due.ts`

- [ ] **Step 1: Check if `calcConfirmationDueDate` and `isConfirmationDeadlineOverdue` are still used**

```bash
grep -rn "calcConfirmationDueDate\|isConfirmationDeadlineOverdue" src/ --include="*.tsx" --include="*.ts"
```

If no references remain, remove both functions from `src/lib/payment-due.ts`.
Keep `formatPaymentDueDate` — still used for general cennik views (admin trips list, parent trip cennik before confirmation).

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 3: Manual test checklist**

Test with a test trip that has "5 dni od potwierdzenia" payment template:

1. **Before confirmation**: Parent trip-card cennik shows "5 dni od potwierdzenia" label ✓
2. **After clicking "Jedzie"** (e.g., on 19.04.2026):
   - Parent dashboard: payment shows "Do 24 kwi 2026" (or similar) ✓
   - Parent "Wyjazdy" tab → trip-card → child section: shows "Rata 1: 500 PLN · do 24 kwi 2026" ✓
   - Parent "Płatności" tab: shows "24.04.2026" ✓
   - Confirmation email: shows "termin: 24 kwietnia 2026" ✓
   - Admin "Płatności" (all payments): shows "24.04.2026" ✓
   - Admin trip → payments tab: shows "24.04.2026" ✓
3. **Check `payments` table in Supabase**: row has `due_date = '2026-04-24'` ✓

- [ ] **Step 4: Final commit**

```bash
git add src/lib/payment-due.ts
git commit -m "chore: remove unused calcConfirmationDueDate helpers"
```
