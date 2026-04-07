# Trip: Payment Deadline "5 dni od potwierdzenia" + Separate Date/Time — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "5 days from parent confirmation" payment deadline option and split departure/return datetime into separate date (required) + time (optional) fields, updating all views.

**Architecture:** Two boolean flags on `trips` (`departure_time_known`, `return_time_known`) control whether time is displayed. An integer column `due_days_from_confirmation` on `trip_payment_templates` stores the dynamic deadline mode. A `confirmed_at` timestamp on `trip_registrations` records when the parent clicked "jedzie". Two pure utility helpers centralize all formatting logic. All 5+ views that display these values use the helpers — no inline formatting.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL), TypeScript, Zod, date-fns, Tailwind, shadcn/ui

---

## Chunk 1: Database Migration + TypeScript Types

**Files:**
- Create: `supabase/migrations/trip-datetime-and-payment-deadline.sql`
- Modify: `src/types/database.ts`
- Modify: `src/types/index.ts`

---

### Task 1: Write and apply DB migration

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/trip-datetime-and-payment-deadline.sql`:

```sql
-- Oddzielna data i godzina wyjazdu/powrotu
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS departure_time_known boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS return_time_known boolean NOT NULL DEFAULT true;

-- Termin płatności "N dni od potwierdzenia"
ALTER TABLE trip_payment_templates
  ADD COLUMN IF NOT EXISTS due_days_from_confirmation integer NULL;

-- Timestamp potwierdzenia przez rodzica (kliknięcie "jedzie")
ALTER TABLE trip_registrations
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL;
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to Supabase → SQL editor → run the migration.  
Verify columns exist: check `trips`, `trip_payment_templates`, `trip_registrations` tables in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/trip-datetime-and-payment-deadline.sql
git commit -m "feat: add DB columns for datetime split and dynamic payment deadline"
```

---

### Task 2: Update TypeScript types

- [ ] **Step 1: Update `src/types/database.ts`**

In the `Trip` interface (around line 102), add after `return_stop2_location`:
```ts
departure_time_known: boolean;
return_time_known: boolean;
```

In the `TripPaymentTemplate` interface (around line 133), add after `due_date`:
```ts
due_days_from_confirmation: number | null;
```

In the `TripRegistration` interface (around line 150), add after `participation_note`:
```ts
confirmed_at: string | null;
```

- [ ] **Step 2: Update `src/types/database.ts` — `CreatePaymentTemplateInput`**

Note: `src/types/index.ts` only re-exports from `database.ts` — all types live in `database.ts`.

Find `CreatePaymentTemplateInput` (around line 334 in `database.ts`) and add:
```ts
due_days_from_confirmation?: number | null;
```

Find `CreateTripInput` (around line 311 in `database.ts`) and add:
```ts
departure_time_known?: boolean;
return_time_known?: boolean;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add TypeScript types for datetime split and dynamic payment deadline"
```

---

## Chunk 2: Validation Schema + Server Actions

**Files:**
- Modify: `src/lib/validations/trip.ts`
- Modify: `src/lib/actions/trips.ts`

---

### Task 3: Update Zod validation schemas

- [ ] **Step 1: Update `src/lib/validations/trip.ts` — `paymentTemplateSchema`**

Add the new field to `paymentTemplateSchema` (after `due_date` field, around line 41):
```ts
due_days_from_confirmation: z
  .number()
  .int()
  .positive()
  .nullable()
  .optional(),
```

Add a new refine after the existing ones:
```ts
.refine((data) => {
  // due_date and due_days_from_confirmation are mutually exclusive
  if (data.due_date && data.due_days_from_confirmation) return false;
  return true;
}, {
  message: 'Nie można jednocześnie ustawić konkretnej daty i "dni od potwierdzenia"',
  path: ['due_days_from_confirmation'],
});
```

- [ ] **Step 2: Update `tripDatesSchema` (around line 84)**

Add new fields:
```ts
departure_time_known: z.boolean().default(true),
return_time_known: z.boolean().default(true),
```

Keep the `.min(1, 'Data wyjazdu jest wymagana')` constraint on `departure_datetime` and `return_datetime` as-is — it still enforces that the date field is not empty (the date part remains required). Do NOT remove it.

- [ ] **Step 3: Commit**

Note: `TripFormData` interface update in `src/components/admin/trip-form/index.tsx` is handled in Task 7 (Chunk 4) where the rest of that file is modified — do not update it here.

```bash
git add src/lib/validations/trip.ts
git commit -m "feat: update Zod schemas for datetime split and dynamic payment deadline"
```

---

### Task 4: Update `updateParticipationStatusByParent` in trips.ts

- [ ] **Step 1: Find the function** at line ~1106 in `src/lib/actions/trips.ts`

In the UPDATE branch (around line 1143), update the `.update()` call:
```ts
const { error } = await supabaseAdmin
  .from('trip_registrations')
  .update({
    participation_status: status,
    participation_note: note || null,
    // Track confirmation timestamp for payment deadline calculation
    ...(status === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
  })
  .eq('id', existing.id);
```

In the INSERT branch (around line 1157), update the `.insert()` call:
```ts
const { error, data } = await supabaseAdmin
  .from('trip_registrations')
  .insert({
    trip_id: tripId,
    participant_id: participantId,
    registered_by: user.id,
    registration_type: 'parent',
    is_outside_group: false,
    status: 'active',
    participation_status: status,
    participation_note: note || null,
    ...(status === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
  })
  .select('id')
  .single();
```

- [ ] **Step 2: Update `createTrip` — destructuring + insert payload**

In `createTrip` (around line 161), the function uses explicit destructuring. Add the new fields to the destructuring block:
```ts
const {
  title,
  // ...existing fields...
  additional_info,
  departure_time_known,   // ADD
  return_time_known,      // ADD
} = input;
```

Then in the `.insert({...})` payload (around line 187), add:
```ts
departure_time_known: departure_time_known ?? true,
return_time_known: return_time_known ?? true,
```

- [ ] **Step 2b: Update `updateTrip` — destructuring + conditional updateData**

In `updateTrip` (around line 276), add to the destructuring block:
```ts
const {
  // ...existing fields...
  additional_info,
  departure_time_known,   // ADD
  return_time_known,      // ADD
} = input;
```

In the `updateData` conditional block (after line 321 where `additional_info` is handled), add:
```ts
if (departure_time_known !== undefined) updateData.departure_time_known = departure_time_known;
if (return_time_known !== undefined) updateData.return_time_known = return_time_known;
```

- [ ] **Step 3: Update payment template insert/update to pass `due_days_from_confirmation`**

Find where payment templates are saved (in `createTrip` / `updateTrip`). Add `due_days_from_confirmation` to the template payload:
```ts
due_days_from_confirmation: pt.due_days_from_confirmation ?? null,
```

- [ ] **Step 4: Verify selects already cover new columns (wildcard)**

Both `getTrip` and `getTripsForParentWithChildren` (the actual function name in `trips.ts`) use `select('*')` or wildcard sub-selects like `trip_payment_templates (*)`. Because Supabase wildcard selects automatically return all columns, the new DB columns (`departure_time_known`, `return_time_known`, `due_days_from_confirmation`, `confirmed_at`) will be returned without any changes to the select statements.

Action: Search for any **named-column selects** (non-wildcard) that reference trip or payment template fields. If found, add the new columns explicitly. If only wildcards are used, no action required — confirm this by grepping:
```bash
grep -n "departure_datetime" src/lib/actions/trips.ts | head -20
```
If the output shows only wildcard selects (`*`), skip to the next step.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/trips.ts
git commit -m "feat: set confirmed_at on participation confirmation, persist datetime/deadline fields"
```

---

## Chunk 3: Utility Helpers

Note: `src/lib/utils.ts` already exists as a flat file — do NOT create a `src/lib/utils/` directory. Place new helpers as sibling files directly in `src/lib/`.

**Files:**
- Create: `src/lib/trip-datetime.ts`
- Create: `src/lib/payment-due.ts`

---

### Task 5: Create `formatTripDatetime` helper

- [ ] **Step 1: Create `src/lib/trip-datetime.ts`**

```ts
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

/**
 * Format a trip datetime ISO string for combined display (e.g. detail pages).
 * If timeKnown is false, shows only the date (no time part).
 */
export function formatTripDatetime(
  iso: string,
  timeKnown: boolean,
  dateFormat = 'd MMMM yyyy'
): string {
  const date = new Date(iso);
  if (timeKnown) {
    return format(date, `${dateFormat}, HH:mm`, { locale: pl });
  }
  return format(date, dateFormat, { locale: pl });
}

/**
 * Short date format variant (e.g. for list views: "15 mar 2025").
 */
export function formatTripDatetimeShort(iso: string, timeKnown: boolean): string {
  return formatTripDatetime(iso, timeKnown, 'd MMM yyyy');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trip-datetime.ts
git commit -m "feat: add formatTripDatetime helper for optional time display"
```

---

### Task 6: Create `payment-due` helper

- [ ] **Step 1: Create `src/lib/payment-due.ts`**

```ts
import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PaymentTemplateForDue {
  due_date?: string | null;
  // due_days_from_confirmation > 0 always (Zod .positive()), so falsy check is safe
  due_days_from_confirmation?: number | null;
}

/**
 * Format the due date label for display in pricing tables and lists.
 * departureDate is the trip's departure_datetime ISO string.
 */
export function formatPaymentDueDate(
  template: PaymentTemplateForDue,
  departureDate?: string
): string {
  if (template.due_days_from_confirmation) {
    return `${template.due_days_from_confirmation} dni od potwierdzenia`;
  }
  if (!template.due_date) return 'wg ustaleń';
  if (departureDate) {
    const departureDay = new Date(departureDate).toISOString().split('T')[0];
    if (template.due_date === departureDay) return 'w dniu wyjazdu';
  }
  return `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`;
}

/**
 * Calculate the actual due date for a "days from confirmation" payment.
 * Returns null if confirmed_at is missing (parent hasn't confirmed yet).
 */
export function calcConfirmationDueDate(
  dueDaysFromConfirmation: number,
  confirmedAt: string | null | undefined
): Date | null {
  if (!confirmedAt) return null;
  return addDays(new Date(confirmedAt), dueDaysFromConfirmation);
}

/**
 * Check if a "days from confirmation" payment deadline has passed.
 */
export function isConfirmationDeadlineOverdue(
  dueDaysFromConfirmation: number,
  confirmedAt: string | null | undefined
): boolean {
  const dueDate = calcConfirmationDueDate(dueDaysFromConfirmation, confirmedAt);
  if (!dueDate) return false;
  return new Date() > dueDate;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/payment-due.ts
git commit -m "feat: add payment due date helpers for dynamic confirmation-based deadlines"
```

---

## Chunk 4: Admin Form UI

**Files:**
- Modify: `src/components/admin/trip-form/index.tsx`

---

### Task 7: Split departure/return datetime inputs

- [ ] **Step 0: Add `departure_time_known` and `return_time_known` to `TripFormData` interface** (in `src/components/admin/trip-form/index.tsx`, around line 33):

```ts
export interface TripFormData {
  // ...existing fields...
  departure_time_known: boolean;   // ADD THIS
  return_time_known: boolean;      // ADD THIS
}
```

This must be done before the state initialization and JSX steps below, as those use `updateFormData({ departure_time_known: ... })` which requires the field to be typed.

- [ ] **Step 1: Update `TripFormData` default state initialization**

In `useState<TripFormData>` (around line 191), change datetime initialization:

```ts
// Replace: departure_datetime: formatDateTimeLocal(trip?.departure_datetime),
// With splitting date and time:
departure_datetime: trip?.departure_datetime
  ? formatDateTimeLocal(trip.departure_datetime).split('T')[0]   // just the date
  : '',
departure_time_known: (trip as any)?.departure_time_known ?? true,
return_datetime: trip?.return_datetime
  ? formatDateTimeLocal(trip.return_datetime).split('T')[0]
  : '',
return_time_known: (trip as any)?.return_time_known ?? true,
```

Add separate state for the time strings (kept local, merged on submit):
```ts
// Add these to the useState block — they are UI-only state not in TripFormData
const [departureTime, setDepartureTime] = useState(
  trip?.departure_datetime && (trip as any)?.departure_time_known !== false
    ? formatDateTimeLocal(trip.departure_datetime).split('T')[1] ?? ''
    : ''
);
const [returnTime, setReturnTime] = useState(
  trip?.return_datetime && (trip as any)?.return_time_known !== false
    ? formatDateTimeLocal(trip.return_datetime).split('T')[1] ?? ''
    : ''
);
```

- [ ] **Step 2: Find the departure datetime input** in the form (search for `departure_datetime` input, around the "Wyjazd" card). Replace the single `datetime-local` input with two inputs:

```tsx
{/* Data wyjazdu */}
<div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="departure_date">Data wyjazdu *</Label>
    <Input
      id="departure_date"
      type="date"
      value={formData.departure_datetime}
      onChange={(e) => {
        const dateVal = e.target.value;
        const time = departureTime || '00:00';
        updateFormData({
          departure_datetime: dateVal ? `${dateVal}T${time}` : '',
          departure_time_known: !!departureTime,
        });
      }}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="departure_time">Godzina wyjazdu</Label>
    <Input
      id="departure_time"
      type="time"
      value={departureTime}
      placeholder="nieznana"
      onChange={(e) => {
        const timeVal = e.target.value;
        setDepartureTime(timeVal);
        if (formData.departure_datetime) {
          const datePart = formData.departure_datetime.split('T')[0];
          updateFormData({
            departure_datetime: `${datePart}T${timeVal || '00:00'}`,
            departure_time_known: !!timeVal,
          });
        }
      }}
    />
    <p className="text-xs text-muted-foreground">Opcjonalna — jeśli nieznana, nie będzie wyświetlana</p>
  </div>
</div>
```

- [ ] **Step 3: Replace the return datetime input** (search for `return_datetime` input in the "Powrót" card):

```tsx
{/* Data powrotu */}
<div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="return_date">Data powrotu *</Label>
    <Input
      id="return_date"
      type="date"
      value={formData.return_datetime ? formData.return_datetime.split('T')[0] : ''}
      onChange={(e) => {
        const dateVal = e.target.value;
        const time = returnTime || '00:00';
        updateFormData({
          return_datetime: dateVal ? `${dateVal}T${time}` : '',
          return_time_known: !!returnTime,
        });
      }}
    />
    {formData.departure_datetime && formData.return_datetime &&
      new Date(formData.return_datetime) <= new Date(formData.departure_datetime) && (
        <p className="text-sm text-destructive">
          Data powrotu musi być późniejsza niż data wyjazdu
        </p>
      )}
  </div>
  <div className="space-y-2">
    <Label htmlFor="return_time">Godzina powrotu</Label>
    <Input
      id="return_time"
      type="time"
      value={returnTime}
      placeholder="nieznana"
      onChange={(e) => {
        const timeVal = e.target.value;
        setReturnTime(timeVal);
        if (formData.return_datetime) {
          const datePart = formData.return_datetime.split('T')[0];
          updateFormData({
            return_datetime: `${datePart}T${timeVal || '00:00'}`,
            return_time_known: !!timeVal,
          });
        }
      }}
    />
    <p className="text-xs text-muted-foreground">Opcjonalna — jeśli nieznana, nie będzie wyświetlana</p>
  </div>
</div>
```

- [ ] **Step 4: Split stop2 datetime inputs** (UI only — no DB flags for stop2, time defaults to `00:00` when empty)

The stop2 fields (`departure_stop2_datetime`, `return_stop2_datetime`) currently use `datetime-local`. Replace each with a date + time pair. Add local state:

```ts
const [departureStop2Time, setDepartureStop2Time] = useState(
  t?.departure_stop2_datetime ? formatDateTimeLocal(t.departure_stop2_datetime).split('T')[1] ?? '' : ''
);
const [returnStop2Time, setReturnStop2Time] = useState(
  t?.return_stop2_datetime ? formatDateTimeLocal(t.return_stop2_datetime).split('T')[1] ?? '' : ''
);
```

In the stop2 departure input (search for `departure_stop2_datetime` in the form), replace the `datetime-local` input:
```tsx
<div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <Label htmlFor="stop2_dep_date">Data przystanku 2</Label>
    <Input
      id="stop2_dep_date"
      type="date"
      value={formData.departure_stop2_datetime ? formData.departure_stop2_datetime.split('T')[0] : ''}
      onChange={(e) => {
        const dateVal = e.target.value;
        const time = departureStop2Time || '00:00';
        updateFormData({ departure_stop2_datetime: dateVal ? `${dateVal}T${time}` : '' });
      }}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="stop2_dep_time">Godzina przystanku 2</Label>
    <Input
      id="stop2_dep_time"
      type="time"
      value={departureStop2Time}
      onChange={(e) => {
        const timeVal = e.target.value;
        setDepartureStop2Time(timeVal);
        if (formData.departure_stop2_datetime) {
          const datePart = formData.departure_stop2_datetime.split('T')[0];
          updateFormData({ departure_stop2_datetime: `${datePart}T${timeVal || '00:00'}` });
        }
      }}
    />
  </div>
</div>
```

Apply the same pattern for `return_stop2_datetime` using `returnStop2Time` / `setReturnStop2Time`.

**Display note for stop2 times in calendars:** Since stop2 has no `_time_known` DB flag, use a convention in the calendar display: hide stop2 time if it is `00:00`. In `admin/calendar-view.tsx` and `parent/calendar-view.tsx`, wrap the stop2 time `<span>` in:
```tsx
{trip.departure_stop2_datetime && trip.departure_stop2_location && (() => {
  const stop2Date = new Date(trip.departure_stop2_datetime);
  const stop2Time = format(stop2Date, 'HH:mm', { locale: pl });
  return (
    <span className="text-gray-600 whitespace-nowrap">
      {stop2Time !== '00:00' ? `${stop2Time} · ` : ''}{trip.departure_stop2_location}
    </span>
  );
})()}
```

- [ ] **Step 5: Update `localToISO` usage** — the existing `localToISO` function expects `YYYY-MM-DDTHH:mm` format. Since we're now constructing the value ourselves, verify the format is consistent before the form submits. In the submit handler, the `departure_datetime` should already be in `YYYY-MM-DDTHH:mm` format — `localToISO` should still work correctly.

- [ ] **Step 5: Update `isValid` check** — find where `departure_datetime` validity is checked and ensure it still correctly validates (the date-only part `YYYY-MM-DD` should be sufficient for the date being set check).

- [ ] **Step 6: Update validation errors list** (around line 248) — `!formData.departure_datetime` check remains valid.

---

### Task 8: Add "5 dni od potwierdzenia" checkbox to payment section

- [ ] **Step 1: Find the "Termin płatności" section** in `index.tsx` (around line 797). The current UI is:

```tsx
<Label>Termin płatności</Label>
<Input type="date" value={payment.due_date || ''} ... />
<div className="flex items-center gap-2">
  <input type="checkbox" id={`due-departure-${index}`} ... />
  <label>W dniu wyjazdu</label>
</div>
```

- [ ] **Step 2: Replace with the new three-option UI:**

```tsx
<div className="space-y-2">
  <Label>Termin płatności</Label>
  <Input
    type="date"
    value={payment.due_date || ''}
    disabled={
      (!!formData.departure_datetime && payment.due_date === formData.departure_datetime.split('T')[0]) ||
      !!payment.due_days_from_confirmation
    }
    onChange={(e) =>
      updatePayment(index, {
        due_date: e.target.value || null,
        due_days_from_confirmation: null,
      })
    }
  />
  {/* Checkbox: W dniu wyjazdu */}
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id={`due-departure-${index}`}
      checked={
        !!formData.departure_datetime &&
        !!payment.due_date &&
        payment.due_date === formData.departure_datetime.split('T')[0]
      }
      onChange={(e) => {
        if (e.target.checked && formData.departure_datetime) {
          updatePayment(index, {
            due_date: formData.departure_datetime.split('T')[0],
            due_days_from_confirmation: null,
            payment_method: 'cash',
          });
        } else {
          updatePayment(index, { due_date: null, payment_method: 'transfer' });
        }
      }}
      className="w-4 h-4 rounded accent-gray-900 cursor-pointer"
    />
    <label htmlFor={`due-departure-${index}`} className="text-xs text-gray-500 cursor-pointer select-none">
      W dniu wyjazdu
    </label>
  </div>
  {/* Checkbox: 5 dni od potwierdzenia */}
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      id={`due-confirmation-${index}`}
      checked={!!payment.due_days_from_confirmation}
      onChange={(e) => {
        if (e.target.checked) {
          updatePayment(index, {
            due_date: null,           // mutually exclusive with due_days_from_confirmation
            due_days_from_confirmation: 5,
          });
        } else {
          // Also clear due_date since it was set to null when this checkbox was checked
          updatePayment(index, { due_date: null, due_days_from_confirmation: null });
        }
      }}
      className="w-4 h-4 rounded accent-gray-900 cursor-pointer"
    />
    <label htmlFor={`due-confirmation-${index}`} className="text-xs text-gray-500 cursor-pointer select-none">
      5 dni od potwierdzenia obozu
    </label>
  </div>
</div>
```

- [ ] **Step 3: Update `emptyPayment` default** (around line 62) to include:
```ts
due_days_from_confirmation: null,
```

- [ ] **Step 4: Update `isValid` logic** for payments (around line 47 in step-payments if it's still there, or in the main form). The current check ignores `due_date` as optional — verify this still holds.

- [ ] **Step 5: Verify the submit handler** passes `due_days_from_confirmation` to the action. In the submit section where payment templates are mapped, ensure `due_days_from_confirmation` is included.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/trip-form/index.tsx
git commit -m "feat: split departure/return datetime inputs and add 5-day confirmation deadline option"
```

---

## Chunk 5: Display — PricingTable + All Views

**Files:**
- Modify: `src/components/shared/pricing-table.tsx`
- Modify: `src/app/(protected)/parent/trips/trips-list.tsx`
- Modify: `src/app/(protected)/parent/trips/[id]/page.tsx`
- Modify: `src/app/(protected)/admin/trips/[id]/page.tsx`
- Modify: `src/app/(protected)/admin/trips/[id]/payments/trip-payments-list.tsx`
- Modify: `src/app/(protected)/admin/calendar/calendar-view.tsx`
- Modify: `src/app/(protected)/parent/calendar/calendar-view.tsx`

---

### Task 9: Update PricingTable to display new deadline type

- [ ] **Step 1: Update `src/components/shared/pricing-table.tsx`**

Add import at top:
```ts
import { formatPaymentDueDate } from '@/lib/payment-due';
```

Update the `PricingTableProps` interface:
```ts
interface PricingTableProps {
  templates: TripPaymentTemplate[];
  departureDate?: string;
}
```
(Already has `departureDate` — just ensure `TripPaymentTemplate` includes `due_days_from_confirmation`.)

Replace the due date display logic (around line 61–83). Currently:
```tsx
const isDepartureDay = departureDate && template.due_date === new Date(departureDate).toISOString().split('T')[0];
// ...
{isDepartureDay ? 'w dniu wyjazdu' : `do ${format(...)}`}
```

Replace with:
```tsx
const dueDateLabel = formatPaymentDueDate(template, departureDate);

// In the JSX:
<td className="px-4 py-3 whitespace-nowrap">
  {(template.due_date || template.due_days_from_confirmation) ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-300">
      <Clock className="h-3 w-3" />
      {dueDateLabel}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground italic">wg ustaleń</span>
  )}
</td>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/pricing-table.tsx
git commit -m "feat: PricingTable displays dynamic confirmation deadline"
```

---

### Task 10: Update parent trips-list.tsx pricing table display

- [ ] **Step 1: Find the pricing table display in `src/app/(protected)/parent/trips/trips-list.tsx`** (around line 567–573 where `template.due_date` is formatted inline).

Add import:
```ts
import { formatPaymentDueDate } from '@/lib/payment-due';
import { formatTripDatetime } from '@/lib/trip-datetime';
```

Replace the inline due_date rendering:
```tsx
// Before:
{template.due_date
  ? (trip.departure_datetime && template.due_date === new Date(trip.departure_datetime).toISOString().split('T')[0]
    ? 'w dniu wyjazdu'
    : format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl }))
  : '-'}

// After:
{formatPaymentDueDate(template, trip.departure_datetime)}
```

- [ ] **Step 2: Update departure/return datetime displays in trips-list.tsx**

Find where `departure_datetime` and `return_datetime` are formatted with `format(new Date(...), ..., HH:mm)`. Replace with:
```tsx
// Before:
format(new Date(trip.departure_datetime), 'd MMM yyyy, HH:mm', { locale: pl })

// After:
formatTripDatetime(trip.departure_datetime, trip.departure_time_known ?? true)
```

Do the same for `return_datetime` with `return_time_known`.

Note: `TripForParent` extends `TripWithGroups` which extends `Trip` in `src/types/database.ts`. Since `departure_time_known` and `return_time_known` are added to `Trip` in Task 2/Chunk 1, they will automatically be available here — no additional change needed.

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/parent/trips/trips-list.tsx
git commit -m "feat: parent trip list uses datetime helpers for time-optional display"
```

---

### Task 11: Update parent trip detail page

- [ ] **Step 1: Update `src/app/(protected)/parent/trips/[id]/page.tsx`**

Add import:
```ts
import { formatTripDatetime } from '@/lib/trip-datetime';
```

Replace (around line 104):
```tsx
// Before:
{format(new Date(trip.departure_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}

// After:
{formatTripDatetime(trip.departure_datetime, trip.departure_time_known ?? true)}
```

Replace (around line 124):
```tsx
// Before:
{format(new Date(trip.return_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}

// After:
{formatTripDatetime(trip.return_datetime, trip.return_time_known ?? true)}
```

Remove unused `format` import if no longer needed elsewhere in the file (check first).

- [ ] **Step 2: Commit**

```bash
git add src/app/(protected)/parent/trips/[id]/page.tsx
git commit -m "feat: parent trip detail respects departure_time_known flag"
```

---

### Task 12: Update admin trip detail page

- [ ] **Step 1: Update `src/app/(protected)/admin/trips/[id]/page.tsx`**

Add import:
```ts
import { formatTripDatetime } from '@/lib/trip-datetime';
```

Replace (around line 129):
```tsx
// Before:
{format(new Date(trip.departure_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}

// After:
{formatTripDatetime(trip.departure_datetime, trip.departure_time_known ?? true)}
```

Replace (around line 149):
```tsx
// Before:
{format(new Date(trip.return_datetime), "d MMMM yyyy, HH:mm", { locale: pl })}

// After:
{formatTripDatetime(trip.return_datetime, trip.return_time_known ?? true)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(protected)/admin/trips/[id]/page.tsx
git commit -m "feat: admin trip detail respects departure_time_known flag"
```

---

### Task 13: Update admin payments list — overdue detection

**Data shape context:** `PaymentWithDetails` (in `src/types/database.ts` line 257) is:
```ts
PaymentWithDetails extends Payment {
  registration: TripRegistration & { participant: ParticipantWithParent; trip: Trip; }
  transactions: PaymentTransaction[];
}
```

`Payment` has `due_date` and `template_id`, but NOT the template object. `TripRegistration` will have `confirmed_at` after Task 1's migration (and since the query uses `*`, it will be returned automatically).

For `due_days_from_confirmation`, we need to extend `PaymentWithDetails` to include the joined template. The underlying Supabase query for admin trip payments must also join `trip_payment_templates`.

- [ ] **Step 1: Extend `PaymentWithDetails` in `src/types/database.ts`**

Make `template` optional so `_fetchAllPaymentsDB` (which doesn't join template) continues to type-check:
```ts
export interface PaymentWithDetails extends Payment {
  registration: TripRegistration & {
    participant: ParticipantWithParent;
    trip: Trip;
  };
  template?: Pick<TripPaymentTemplate, 'due_days_from_confirmation'> | null;  // optional
  transactions: PaymentTransaction[];
}
```

- [ ] **Step 2: Update only `getPaymentsForTrip` in `src/lib/actions/payments.ts`** (line 20 — the trip-scoped query)

Add `template` join to the `.select()` string:
```ts
const { data: payments, error } = await supabase
  .from('payments')
  .select(`
    *,
    registration:trip_registrations (
      *,
      participant:participants (
        *,
        parent:profiles!parent_id (*)
      ),
      trip:trips (*)
    ),
    template:trip_payment_templates (due_days_from_confirmation),
    transactions:payment_transactions (*)
  `)
  .eq('registration.trip_id', tripId)
  // ...rest unchanged
```

Do NOT modify `_fetchAllPaymentsDB` (line 52) — it uses `template?: ...` (optional) so TypeScript won't complain. The global payments view doesn't need to show the confirmation deadline badge.

Also: `registration.confirmed_at` is returned automatically since the `trip_registrations` join uses `*` wildcard and `confirmed_at` was added to the table in Task 1.

- [ ] **Step 3: In `trip-payments-list.tsx`, add import:**
```ts
import { calcConfirmationDueDate, isConfirmationDeadlineOverdue } from '@/lib/payment-due';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
```

- [ ] **Step 4: Find where `due_date` is displayed per payment row** and replace with conditional overdue logic:

```tsx
{payment.template?.due_days_from_confirmation ? (
  (() => {
    const confirmedAt = payment.registration?.confirmed_at;
    const dueDate = calcConfirmationDueDate(
      payment.template.due_days_from_confirmation,
      confirmedAt
    );
    const overdue = isConfirmationDeadlineOverdue(
      payment.template.due_days_from_confirmation,
      confirmedAt
    );
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {dueDate
            ? format(dueDate, 'd.MM.yyyy', { locale: pl })
            : 'czeka na potwierdzenie'}
        </span>
        {overdue && payment.status !== 'paid' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <AlertTriangle className="h-3 w-3" />
            PO TERMINIE
          </span>
        )}
      </div>
    );
  })()
) : (
  payment.due_date
    ? format(new Date(payment.due_date), 'd.MM.yyyy', { locale: pl })
    : '—'
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/lib/actions/payments.ts src/app/(protected)/admin/trips/[id]/payments/trip-payments-list.tsx
git commit -m "feat: admin payments list shows calculated due date and overdue badge for confirmation-based deadlines"
```

---

### Task 14: Update admin calendar

The calendar uses a **two-span layout** (date on one line, time on a separate span below). The `formatTripDatetime` helper returns a combined string and cannot be used directly here. Instead, keep the date spans as-is and conditionally render the time spans.

- [ ] **Step 1: Update list-view rows in `src/app/(protected)/admin/calendar/calendar-view.tsx`**

Find the "Wyjazd" and "Powrót" table cells (around lines 267–286) which look like:
```tsx
<span className="font-semibold...">{format(dep, 'd.MM.yyyy', { locale: pl })}</span>
<span className="text-gray-600...">{format(dep, 'HH:mm', { locale: pl })}·{trip.departure_location}</span>
```

Replace the time span for departure (conditionally show based on flag):
```tsx
<span className="font-semibold text-gray-900 whitespace-nowrap">{format(dep, 'd.MM.yyyy', { locale: pl })}</span>
{(trip.departure_time_known ?? true) && (
  <span className="text-gray-600 whitespace-nowrap">
    {format(dep, 'HH:mm', { locale: pl })}{trip.departure_location ? ` · ${trip.departure_location}` : ''}
  </span>
)}
{!(trip.departure_time_known ?? true) && trip.departure_location && (
  <span className="text-gray-600 whitespace-nowrap">{trip.departure_location}</span>
)}
```

Apply the same pattern to return (`ret` / `return_time_known`).

- [ ] **Step 2: Update tooltip** (`TripTooltipContent` function around line 438)

Find the departure time `<span>` inside the tooltip (around line 460):
```tsx
<span className="font-medium">{format(departureDate, 'HH:mm', { locale: pl })}</span>
```
Wrap it with a conditional:
```tsx
{(trip.departure_time_known ?? true) && (
  <div className="flex items-center gap-1 text-gray-600 text-xs">
    <span className="font-medium">{format(departureDate, 'HH:mm', { locale: pl })}</span>
    {trip.departure_location && <span className="text-gray-400">· {trip.departure_location}</span>}
  </div>
)}
```
Apply the same pattern for return (around line 481), replacing `departureDate` with `returnDate` (the local variable declared on line 440) and `departure_time_known` with `return_time_known`:
```tsx
{(trip.return_time_known ?? true) && (
  <div className="flex items-center gap-1 text-gray-600 text-xs">
    <span className="font-medium">{format(returnDate, 'HH:mm', { locale: pl })}</span>
    {trip.return_location && <span className="text-gray-400">· {trip.return_location}</span>}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/admin/calendar/calendar-view.tsx
git commit -m "feat: admin calendar hides unknown departure/return times"
```

---

### Task 15: Update parent calendar

The parent calendar has **three distinct UI sections** that display departure/return times — all must be updated. The pattern for each is: keep the date `<span>` unchanged, wrap the time `<div>`/`<span>` in a conditional based on `_time_known`.

- [ ] **Step 1: Section 1 — List-view rows** (around lines 195–208, uses `dep`/`ret` variables)

```tsx
{/* Wyjazd - before */}
<span className="text-gray-600 whitespace-nowrap">{format(dep, 'HH:mm', { locale: pl })}{trip.departure_location ? ` · ${trip.departure_location}` : ''}</span>

{/* Wyjazd - after */}
{(trip.departure_time_known ?? true) && (
  <span className="text-gray-600 whitespace-nowrap">
    {format(dep, 'HH:mm', { locale: pl })}{trip.departure_location ? ` · ${trip.departure_location}` : ''}
  </span>
)}
{!(trip.departure_time_known ?? true) && trip.departure_location && (
  <span className="text-gray-600 whitespace-nowrap">{trip.departure_location}</span>
)}
```

Apply the same for `ret` / `return_time_known` (around line 205).

- [ ] **Step 2: Section 2 — Month-view HoverCard popup** (around lines 338–370, uses `trip.departure_datetime` directly)

```tsx
{/* Wyjazd time div - before (line 339–342) */}
<div className="flex items-center gap-1 text-gray-600">
  <span className="font-medium">{format(new Date(trip.departure_datetime), 'HH:mm', { locale: pl })}</span>
  {trip.departure_location && <span className="text-gray-400">· {trip.departure_location}</span>}
</div>

{/* Wyjazd time div - after */}
{(trip.departure_time_known ?? true) ? (
  <div className="flex items-center gap-1 text-gray-600">
    <span className="font-medium">{format(new Date(trip.departure_datetime), 'HH:mm', { locale: pl })}</span>
    {trip.departure_location && <span className="text-gray-400">· {trip.departure_location}</span>}
  </div>
) : (
  trip.departure_location && <div className="text-gray-600">{trip.departure_location}</div>
)}
```

Apply the same for return (around line 360–363) using `trip.return_time_known`.

- [ ] **Step 3: Section 3 — Mobile modal** (around lines 435–465, uses `selectedTrip`)

```tsx
{/* Wyjazd time div - before (line 436–439) */}
<div className="flex items-center gap-1.5 text-gray-600">
  <span className="font-medium">{format(new Date(selectedTrip.departure_datetime), 'HH:mm', { locale: pl })}</span>
  {selectedTrip.departure_location && <span className="text-gray-500">· {selectedTrip.departure_location}</span>}
</div>

{/* Wyjazd time div - after */}
{(selectedTrip.departure_time_known ?? true) ? (
  <div className="flex items-center gap-1.5 text-gray-600">
    <span className="font-medium">{format(new Date(selectedTrip.departure_datetime), 'HH:mm', { locale: pl })}</span>
    {selectedTrip.departure_location && <span className="text-gray-500">· {selectedTrip.departure_location}</span>}
  </div>
) : (
  selectedTrip.departure_location && <div className="text-gray-600">{selectedTrip.departure_location}</div>
)}
```

Apply the same for return (around line 457–460) using `selectedTrip.return_time_known`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(protected)/parent/calendar/calendar-view.tsx
git commit -m "feat: parent calendar hides unknown departure/return times in all 3 UI sections"
```

---

## Chunk 6: Final Verification

### Task 16: Manual end-to-end check

- [ ] **Step 1: Start dev server**
```bash
npm run dev
```

- [ ] **Step 2: Admin — create trip with no departure time**
  - Go to `/admin/trips/add`
  - Fill departure date, leave time empty
  - Fill return date, leave time empty
  - Save trip
  - Verify: trip detail page shows date only (no "00:00")
  - Verify: calendar shows date only

- [ ] **Step 3: Admin — create trip with time**
  - Create another trip, fill both date and time
  - Verify: trip detail shows "15 marca 2025, 08:30"
  - Verify: calendar shows time

- [ ] **Step 4: Admin — payment with "5 dni od potwierdzenia"**
  - Create trip, in payment section check "5 dni od potwierdzenia obozu"
  - Verify: date input is disabled
  - Save, view trip detail — pricing table shows "5 dni od potwierdzenia"

- [ ] **Step 5: Parent — confirm child**
  - Log in as parent
  - Go to trips list
  - Click "jedzie" for a child on a trip that has "5 dni od potwierdzenia" payment
  - Verify: `trip_registrations.confirmed_at` is set in Supabase (check Table Editor)

- [ ] **Step 6: Admin — check payments list for overdue**
  - Go to `/admin/trips/[id]/payments`
  - For a registration where `confirmed_at` is >5 days ago, verify ⚠️ PO TERMINIE badge appears
  - For a recent confirmation, verify no badge

- [ ] **Step 7: Pricing table on parent side**
  - Log in as parent, go to trip detail
  - Verify pricing table shows "5 dni od potwierdzenia" for the relevant template
  - Verify trips without this option show date or "wg ustaleń" as before

- [ ] **Step 8: Final verification commit (if any unstaged changes remain)**

```bash
git status
# Stage only files relevant to this feature (avoid git add -A)
git add src/ supabase/migrations/ docs/
git commit -m "feat: complete trip datetime split and dynamic payment deadline feature"
```
