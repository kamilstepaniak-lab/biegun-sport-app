# Trip: Payment Deadline "5 dni od potwierdzenia" + Separate Date/Time — Design

## Goal

Two related improvements to the trip management system:
1. Add a "5 days from parent confirmation" option for payment due dates (used for late summer camp registrations)
2. Split the departure/return datetime into separate date (required) + time (optional) fields

---

## Feature 1: "5 dni od potwierdzenia obozu" Payment Deadline

### Context

When a parent registers a child after the official registration deadline, the admin needs a flexible payment window. Currently, admins can set a fixed date or "on departure day". The new option: "5 days from when the parent confirms" — if the parent confirms on May 10th but hasn't paid by May 15th, the admin knows they're overdue.

"Confirmation" = when the parent clicks "jedzie" (going) or selects a pickup stop, which sets `participation_status = 'confirmed'`. This timestamp is not currently tracked — we need to add `confirmed_at`.

### DB Changes

**`trip_payment_templates`:**
- Add `due_days_from_confirmation integer NULL`
- NULL = not using this mode
- 5 = deadline is confirmed_at + 5 days

**`trip_registrations`:**
- Add `confirmed_at timestamptz NULL`
- Set to `NOW()` when parent sets participation_status = 'confirmed'

### Mutual Exclusion Rule (application layer)
For each payment template exactly one of these must hold:
- `due_date IS NOT NULL` and `due_days_from_confirmation IS NULL` → fixed date
- `due_date IS NULL` and `due_days_from_confirmation IS NULL` → "wg ustaleń"
- `due_date IS NULL` and `due_days_from_confirmation IS NOT NULL` → dynamic from confirmation

### Admin Form (trip creation/edit)
In the "Termin płatności" section:
```
[Date input — disabled when either checkbox is checked]
[ ] W dniu wyjazdu
[ ] 5 dni od potwierdzenia obozu
```
Checkboxes are mutually exclusive. Selecting one clears the other and disables/clears the date input.

### Display Logic (helper)
```ts
function formatDueDate(template, departureDate): string {
  if (template.due_days_from_confirmation)
    return `${template.due_days_from_confirmation} dni od potwierdzenia`
  if (!template.due_date) return 'wg ustaleń'
  if (isDepartureDay) return 'w dniu wyjazdu'
  return `do ${format(new Date(template.due_date), 'd.MM.yyyy')}`
}
```

### Overdue Detection (admin payments list)
When `due_days_from_confirmation` is set and the registration has `confirmed_at`:
- Calculate `actual_due = confirmed_at + due_days_from_confirmation days`
- If `today > actual_due` and no payment → show ⚠️ badge "PO TERMINIE"

### Views to Update
- `src/components/shared/pricing-table.tsx` — display "5 dni od potwierdzenia"
- `src/app/(protected)/parent/trips/trips-list.tsx` — pricing table display
- `src/app/(protected)/admin/trips/[id]/payments/trip-payments-list.tsx` — overdue detection
- `src/app/(protected)/parent/trips/[id]/page.tsx` — pricing table
- `src/app/(protected)/admin/trips/[id]/page.tsx` — pricing table
- `src/components/admin/trip-form/index.tsx` — new checkbox in payment section
- `src/lib/actions/registrations.ts` (or equivalent) — set confirmed_at on confirmation
- `src/lib/validations/trip.ts` — update paymentTemplateSchema
- `src/types/database.ts` and `src/types/index.ts` — add new fields

---

## Feature 2: Separate Date and Time for Departure/Return

### Context

Admins often know the departure date but not the time. Currently, the form uses `datetime-local` which requires both. If time is unknown, it shouldn't appear in any display.

### DB Changes

**`trips`:**
- Add `departure_time_known boolean NOT NULL DEFAULT true`
- Add `return_time_known boolean NOT NULL DEFAULT true`

Existing records: default `true` (they have real times). New records with no time entered: stored as `T00:00` with `false`.

### Admin Form Change
Replace single `datetime-local` input with two fields:
```
Data wyjazdu *          Godzina wyjazdu
[date input]            [time input] (opcjonalna)
```
Same for return. Same for stop2 datetimes (already optional).

If time is empty → `departure_time_known = false`, time stored as `00:00`.

### Validation Update
`tripDatesSchema`:
- `departure_datetime` remains required (date part)
- Add `departure_time_known: z.boolean().default(true)`
- Add `return_time_known: z.boolean().default(true)`

### Display Helper
```ts
function formatTripDatetime(iso: string, timeKnown: boolean): string {
  if (timeKnown) return format(new Date(iso), "d MMMM yyyy, HH:mm", { locale: pl })
  return format(new Date(iso), "d MMMM yyyy", { locale: pl })
}
```

### Views to Update
- `src/app/(protected)/parent/trips/[id]/page.tsx`
- `src/app/(protected)/parent/trips/trips-list.tsx`
- `src/app/(protected)/admin/calendar/calendar-view.tsx`
- `src/app/(protected)/parent/calendar/calendar-view.tsx`
- `src/app/(protected)/admin/trips/[id]/page.tsx`
- `src/components/admin/trip-form/index.tsx` — split datetime input

---

## Approach Summary

| Decision | Choice | Reason |
|---|---|---|
| "5 dni" storage | New int column `due_days_from_confirmation` | Minimal, flexible, nullable |
| Confirmation tracking | New `confirmed_at` on `trip_registrations` | Accurate semantics |
| Time optionality | Boolean `_time_known` flags | Zero breaking changes, backward compatible |
| Mutual exclusion | Application layer, not DB constraint | Simpler migration |
