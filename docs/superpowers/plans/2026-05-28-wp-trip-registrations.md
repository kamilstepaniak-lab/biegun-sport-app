# WP → Zgłoszenia na wyjazd (Obozy Letnie) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać publiczny endpoint przyjmujący zgłoszenia dzieci z formularza WordPress + admin UI do moderacji tych zgłoszeń, z auto-utworzeniem konta rodzica (magic link), profilu dziecka i zapisu na wyjazd po zatwierdzeniu.

**Architecture:** Jednokierunkowa integracja: WP → aplikacja. WP wysyła `POST` z UUID wyjazdu i danymi dziecka/rodzica do `/api/public/trip-registrations`. Aplikacja zapisuje do nowej tabeli `trip_registration_requests` w stanie `pending`. Admin moderuje w `/admin/registrations`. Zatwierdzenie wywołuje istniejący flow: `createExternalChild` (z magic linkiem) + `registerParticipantToTrip` jako admin + standardowy mail rejestracyjny. Aplikacja nie modyfikuje WP — UUID wyjazdu kopiowany ręcznie do custom field w WP.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Auth Admin), Server Actions, istniejący helper `getAuthUser`, klucz API w env.

**Context source:** Wcześniejszy szkic [docs/wordpress-signup.md](../../wordpress-signup.md) (referencyjny, nie obowiązujący — ten plan ma pierwszeństwo).

**Notatki o kodzie:**
- W projekcie nie ma test runnera. Weryfikacja = ręczne uruchomienie (`curl`, klik w UI, sprawdzenie w Supabase Studio).
- Migracje SQL idą do `supabase/migrations/`. **Nie są uruchamiane automatycznie** — po każdej migracji ostrzeż użytkownika, że musi ją odpalić ręcznie w Supabase.
- Pracujemy bezpośrednio na `main`, bez nowych branchy. Push tylko po wyraźnym OK użytkownika.
- Po każdym Task commit lokalnie (bez push). Push na końcu, po zgodzie.

---

## Chunk 1: Baza danych + flaga na wyjeździe

### Task 1: Migracja — flaga `registration_form_enabled` na wyjeździe

**Files:**
- Create: `supabase/migrations/trip-registration-form-flag.sql`

- [ ] **Step 1: Napisz migrację**

```sql
-- supabase/migrations/trip-registration-form-flag.sql
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS registration_form_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN trips.registration_form_enabled IS
  'Gdy true: publiczny endpoint /api/public/trip-registrations przyjmuje zgloszenia dla tego wyjazdu. Domyslnie wylaczone.';
```

- [ ] **Step 2: Ostrzeż użytkownika**

Wypisz w odpowiedzi: „Migracja `trip-registration-form-flag.sql` gotowa. Uruchom ją ręcznie w Supabase SQL Editor zanim ruszymy dalej z kodem czytającym/piszącym tę kolumnę."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/trip-registration-form-flag.sql
git commit -m "feat(trips): add registration_form_enabled flag for WP intake"
```

---

### Task 2: Migracja — tabela `trip_registration_requests`

**Files:**
- Create: `supabase/migrations/trip-registration-requests.sql`

- [ ] **Step 1: Napisz migrację**

```sql
-- supabase/migrations/trip-registration-requests.sql
CREATE TABLE IF NOT EXISTS trip_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  child_first_name TEXT NOT NULL,
  child_last_name  TEXT NOT NULL,
  child_birth_date DATE NOT NULL,
  child_height_cm  INT,

  parent_email TEXT NOT NULL,
  parent_phone TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  admin_note TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),

  created_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  raw_payload JSONB
);

-- Szybkie listowania po statusie/wyjeździe
CREATE INDEX IF NOT EXISTS idx_trr_status_submitted
  ON trip_registration_requests (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_trr_trip
  ON trip_registration_requests (trip_id);

-- Anty-duplikat dla pending: ten sam rodzic, to samo dziecko, ten sam wyjazd
CREATE UNIQUE INDEX IF NOT EXISTS uq_trr_pending_dedup
  ON trip_registration_requests (trip_id, lower(parent_email), lower(child_first_name), lower(child_last_name), child_birth_date)
  WHERE status = 'pending';

ALTER TABLE trip_registration_requests ENABLE ROW LEVEL SECURITY;

-- Insert tylko przez service role (z publicznego endpointu). Brak policy = brak dostępu dla anon/authenticated.
-- Select/Update tylko admin.
CREATE POLICY trr_admin_select ON trip_registration_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY trr_admin_update ON trip_registration_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE trip_registration_requests IS
  'Kolejka zgloszen z formularza WP. Po approve: tworzony participant + trip_registration. Service role insertuje z /api/public/trip-registrations.';
```

- [ ] **Step 2: Ostrzeż użytkownika**

Wypisz: „Migracja `trip-registration-requests.sql` gotowa. Uruchom w Supabase SQL Editor (zależność: kod admin/API odwołuje się do tej tabeli)."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/trip-registration-requests.sql
git commit -m "feat(db): add trip_registration_requests queue table"
```

---

## Chunk 2: Publiczny endpoint POST

### Task 3: Walidacja env `WP_INTAKE_API_KEY`

**Files:**
- Modify: `src/lib/env.ts` (jeśli istnieje; jeśli nie ma — pomiń, klucz czytamy bezpośrednio `process.env`)
- Reference: `.env.local` (lokalnie), Vercel Project Settings (prod)

- [ ] **Step 1: Wygeneruj sekret**

```bash
openssl rand -hex 32
```

Skopiuj wynik. Wypisz użytkownikowi: „Dodaj `WP_INTAKE_API_KEY=<wartość>` do `.env.local` ORAZ do Vercel Project Settings → Environment Variables (Production + Preview). Ten sam klucz wpisz w konfiguracji formularza WP."

- [ ] **Step 2: Commit (jeśli zmieniłeś env.ts)**

```bash
git add src/lib/env.ts
git commit -m "feat(env): add WP_INTAKE_API_KEY"
```

Jeśli nie ma `env.ts` i nie powstał plik — pomiń commit.

---

### Task 4: Endpoint `POST /api/public/trip-registrations`

**Files:**
- Create: `src/app/api/public/trip-registrations/route.ts`

- [ ] **Step 1: Implementacja endpointu**

```typescript
// src/app/api/public/trip-registrations/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  trip_id: z.string().uuid('trip_id musi być UUID'),
  child: z.object({
    first_name: z.string().trim().min(2).max(50),
    last_name: z.string().trim().min(2).max(50),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date format YYYY-MM-DD'),
    height_cm: z.number().int().min(50).max(250).nullable().optional(),
  }),
  parent: z.object({
    email: z.string().email().max(120),
    phone: z.string().trim().min(6).max(30),
  }),
});

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  const expected = process.env.WP_INTAKE_API_KEY;
  if (!expected || !apiKey || apiKey !== expected) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Sprawdź wyjazd + flagę
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, registration_form_enabled')
    .eq('id', data.trip_id)
    .maybeSingle();

  if (tripErr) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  if (!trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404 });
  if (!trip.registration_form_enabled) {
    return NextResponse.json({ error: 'registrations_closed' }, { status: 403 });
  }

  // Idempotencja: jeśli istnieje pending o tym samym dedup-keyu, zwróć ten sam id
  const { data: existing } = await admin
    .from('trip_registration_requests')
    .select('id')
    .eq('trip_id', data.trip_id)
    .ilike('parent_email', data.parent.email)
    .ilike('child_first_name', data.child.first_name)
    .ilike('child_last_name', data.child.last_name)
    .eq('child_birth_date', data.child.birth_date)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ id: existing.id, status: 'pending', deduped: true }, { status: 200 });
  }

  const { data: inserted, error: insertErr } = await admin
    .from('trip_registration_requests')
    .insert({
      trip_id: data.trip_id,
      child_first_name: data.child.first_name,
      child_last_name: data.child.last_name,
      child_birth_date: data.child.birth_date,
      child_height_cm: data.child.height_cm ?? null,
      parent_email: data.parent.email.toLowerCase(),
      parent_phone: data.parent.phone,
      raw_payload: body as object,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('trip_registration_requests insert error:', insertErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, status: 'pending' }, { status: 201 });
}
```

- [ ] **Step 2: Weryfikacja manualna — happy path**

Uruchom dev server (`npm run dev`). W innym terminalu:

```bash
curl -i -X POST http://localhost:3000/api/public/trip-registrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WP_INTAKE_API_KEY" \
  -d '{
    "trip_id": "<UUID-istniejacego-wyjazdu-z-flaga-true>",
    "child": {"first_name":"Jan","last_name":"Test","birth_date":"2015-06-01","height_cm":140},
    "parent": {"email":"rodzic.test@example.com","phone":"+48500600700"}
  }'
```

Oczekiwane: `HTTP/1.1 201` + `{"id":"...","status":"pending"}`. Sprawdź wpis w Supabase Studio → `trip_registration_requests`.

UWAGA: żeby ten test przeszedł, najpierw ręcznie odpal obie migracje i ustaw `registration_form_enabled=true` na wybranym wyjeździe testowym (SQL: `UPDATE trips SET registration_form_enabled = true WHERE id = '...';`).

- [ ] **Step 3: Weryfikacja manualna — błędne ścieżki**

```bash
# brak klucza -> 401
curl -i -X POST http://localhost:3000/api/public/trip-registrations -H "Content-Type: application/json" -d '{}'

# zły uuid wyjazdu -> 404
curl -i -X POST http://localhost:3000/api/public/trip-registrations \
  -H "Content-Type: application/json" -H "x-api-key: $WP_INTAKE_API_KEY" \
  -d '{"trip_id":"00000000-0000-0000-0000-000000000000","child":{"first_name":"A","last_name":"B","birth_date":"2015-01-01"},"parent":{"email":"a@b.pl","phone":"123456"}}'

# flaga off -> 403 (ustaw UPDATE trips SET registration_form_enabled=false WHERE id='...' i ponów request z Step 2)

# duplikat -> 200 z deduped:true (ponów request z Step 2 dwa razy)
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/trip-registrations/route.ts
git commit -m "feat(api): public trip registration intake endpoint"
```

---

## Chunk 3: Karta wyjazdu — UUID + flaga w UI

### Task 5: Sekcja „Zapisy zewnętrzne (WordPress)" w formularzu wyjazdu

**Files:**
- Modify: `src/components/admin/trip-form/*` — sekcja BasicInfo lub osobny boks (sprawdź strukturę i dołóż w sensownym miejscu, np. obok statusu publikacji)
- Modify: `src/lib/actions/trips.ts` — dopisz obsługę `registration_form_enabled` w create/update
- Modify: `src/types/index.ts` (lub odpowiedni plik typu Trip) — dodaj pole

- [ ] **Step 1: Rozejrzyj się w trip-form**

```bash
ls src/components/admin/trip-form/
grep -n "registration_form_enabled\|status\|published" src/components/admin/trip-form/*.tsx | head -20
grep -n "UpdateTripInput\|CreateTripInput\|updateTrip\|createTrip" src/lib/actions/trips.ts | head -20
```

Cel: znajdź `BasicInfoSection` lub równoważny komponent i miejsce, gdzie ustawia się boolowskie flagi wyjazdu.

- [ ] **Step 2: Dodaj pole do schematu + akcji**

W `src/lib/actions/trips.ts` w schemacie Zod (input createTrip/updateTrip) dodaj:

```typescript
registration_form_enabled: z.boolean().optional().default(false),
```

W bodyniku insert/update dopisz `registration_form_enabled: data.registration_form_enabled ?? false`.

W typach `Trip` (najczęściej `src/types/index.ts` lub generowanych) dopisz `registration_form_enabled: boolean`.

- [ ] **Step 3: Nowa sekcja UI w formularzu**

W odpowiednim komponencie formularza wyjazdu (najprawdopodobniej `BasicInfoSection.tsx` na dole, albo nowy `WordPressIntakeSection.tsx`) dodaj:

```tsx
// Renderuj tylko gdy edytujemy istniejący wyjazd (mamy UUID)
{trip?.id && (
  <section className="rounded-md border border-slate-200 p-4">
    <h3 className="mb-2 text-sm font-semibold">Zapisy zewnętrzne (WordPress)</h3>

    <label className="block text-xs text-slate-600">UUID wyjazdu (wklej w pole „ID wyjazdu w systemie" przy wpisie WP)</label>
    <div className="mt-1 flex items-center gap-2">
      <input
        readOnly
        value={trip.id}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(trip.id);
          // optional: toast
        }}
        className="rounded bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-700"
      >
        Kopiuj
      </button>
    </div>

    <label className="mt-3 flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={form.registration_form_enabled ?? false}
        onChange={(e) => setForm({ ...form, registration_form_enabled: e.target.checked })}
      />
      <span>
        <span className="font-medium">Przyjmuj zgłoszenia z formularza WP</span>
        <span className="block text-xs text-slate-500">
          Gdy zaznaczone, publiczne API akceptuje zgłoszenia dzieci na ten wyjazd. Domyślnie wyłączone.
        </span>
      </span>
    </label>
  </section>
)}
```

UWAGA: realna nazwa propów (`form`, `setForm`, `trip`) zależy od istniejącej struktury — dostosuj.

- [ ] **Step 4: Weryfikacja manualna**

`npm run dev`. Otwórz `/admin/trips/<id>` → karta edycji. Zobacz sekcję, skopiuj UUID, zaznacz checkbox, zapisz, odśwież — wartość trzyma się w bazie (`SELECT registration_form_enabled FROM trips WHERE id='...'`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/trip-form src/lib/actions/trips.ts src/types
git commit -m "feat(admin/trips): WP intake section with copyable UUID and enable flag"
```

---

### Task 6: Badge na liście wyjazdów

**Files:**
- Modify: lista wyjazdów w `/admin/trips` (najprawdopodobniej `src/app/(protected)/admin/trips/page.tsx` lub komponent listy)

- [ ] **Step 1: Lokalizacja**

```bash
ls src/app/\(protected\)/admin/trips/
grep -rn "registration_form_enabled" src/app/\(protected\)/admin/trips/ src/components/admin/ 2>/dev/null
```

- [ ] **Step 2: Dodaj mały badge przy tytułach wyjazdów z włączonymi zapisami**

Tam gdzie renderowany jest tytuł wyjazdu (kafelek lub wiersz) dorzuć:

```tsx
{trip.registration_form_enabled && (
  <span
    className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700"
    title="Wyjazd przyjmuje zgłoszenia z WordPressa"
  >
    WP
  </span>
)}
```

Upewnij się, że selekt z bazy zaciąga `registration_form_enabled` (jeśli używa explicit `select(...)`).

- [ ] **Step 3: Weryfikacja manualna**

Otwórz `/admin/trips`. Wyjazd z flagą = badge „WP", reszta bez badge'a.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(protected\)/admin/trips src/components/admin
git commit -m "feat(admin/trips): WP badge on trips list"
```

---

## Chunk 4: Admin — strona Zgłoszenia + akcje

### Task 7: Server actions — list/approve/reject

**Files:**
- Create: `src/lib/actions/trip-registration-requests.ts`

- [ ] **Step 1: Szkielet akcji**

```typescript
// src/lib/actions/trip-registration-requests.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { createExternalChild } from './external-children';
import { registerParticipantToTrip } from './registrations';

type Status = 'pending' | 'approved' | 'rejected';

export type TripRegistrationRequestRow = {
  id: string;
  trip_id: string;
  trip_title: string | null;
  child_first_name: string;
  child_last_name: string;
  child_birth_date: string;
  child_height_cm: number | null;
  parent_email: string;
  parent_phone: string | null;
  status: Status;
  submitted_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  created_participant_id: string | null;
};

export async function listTripRegistrationRequests(filter?: {
  status?: Status | 'all';
  tripId?: string;
  search?: string;
}): Promise<{ data?: TripRegistrationRequestRow[]; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  let q = admin
    .from('trip_registration_requests')
    .select('id, trip_id, child_first_name, child_last_name, child_birth_date, child_height_cm, parent_email, parent_phone, status, submitted_at, processed_at, rejection_reason, created_participant_id, trips(title)')
    .order('submitted_at', { ascending: false });

  if (filter?.status && filter.status !== 'all') q = q.eq('status', filter.status);
  if (filter?.tripId) q = q.eq('trip_id', filter.tripId);
  if (filter?.search && filter.search.trim()) {
    const s = `%${filter.search.trim()}%`;
    q = q.or(`child_first_name.ilike.${s},child_last_name.ilike.${s},parent_email.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };

  const rows: TripRegistrationRequestRow[] = (data || []).map((r: any) => ({
    id: r.id,
    trip_id: r.trip_id,
    trip_title: r.trips?.title ?? null,
    child_first_name: r.child_first_name,
    child_last_name: r.child_last_name,
    child_birth_date: r.child_birth_date,
    child_height_cm: r.child_height_cm,
    parent_email: r.parent_email,
    parent_phone: r.parent_phone,
    status: r.status,
    submitted_at: r.submitted_at,
    processed_at: r.processed_at,
    rejection_reason: r.rejection_reason,
    created_participant_id: r.created_participant_id,
  }));
  return { data: rows };
}

export async function countPendingRegistrationRequests(): Promise<number> {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return 0;
  const admin = createAdminClient();
  const { count } = await admin
    .from('trip_registration_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count ?? 0;
}

export async function approveRegistrationRequest(requestId: string) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const { data: reqRow, error: reqErr } = await admin
    .from('trip_registration_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqErr || !reqRow) return { error: 'Nie znaleziono zgłoszenia' };
  if (reqRow.status !== 'pending') return { error: 'Zgłoszenie już przetworzone' };

  // 1) Utwórz / dopnij rodzica + dziecko (grupa "Bez kategorii", magic link)
  const createRes = await createExternalChild({
    parent_email: reqRow.parent_email,
    parent_first_name: '',
    parent_last_name: '',
    parent_phone: reqRow.parent_phone ?? '',
    first_name: reqRow.child_first_name,
    last_name: reqRow.child_last_name,
    birth_date: reqRow.child_birth_date,
    height_cm: reqRow.child_height_cm ?? null,
    group_id: null,
  });

  if ('error' in createRes && createRes.error) return { error: createRes.error };
  const participantId = createRes.data!.id;

  // 2) Zapisz na wyjazd jako admin (confirmed + standardowy mail rejestracyjny — robi to registerParticipantToTrip)
  const regRes = await registerParticipantToTrip(reqRow.trip_id, participantId, 'admin');
  if ('error' in regRes && regRes.error) {
    // miękki błąd — uczestnik został utworzony, ale zapis się nie udał
    return { error: `Uczestnik utworzony, ale zapis na wyjazd nie powiódł się: ${regRes.error}` };
  }

  // 3) Update requesta
  await admin
    .from('trip_registration_requests')
    .update({
      status: 'approved',
      processed_at: new Date().toISOString(),
      processed_by: user.id,
      created_participant_id: participantId,
    })
    .eq('id', requestId);

  revalidatePath('/admin/registrations');
  revalidatePath('/admin/participants');
  revalidatePath('/admin/groups');
  return { success: true };
}

export async function rejectRegistrationRequest(requestId: string, reason: string | null) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('trip_registration_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason?.trim() || null,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) return { error: error.message };
  revalidatePath('/admin/registrations');
  return { success: true };
}
```

UWAGA architektoniczna: `createExternalChild` ma w środku `if (role !== 'admin') return ...`. Wywołanie odbywa się w kontekście zalogowanego admina (akcja wymaga admina wcześniej), więc przejdzie. Jeśli okaże się, że `getAuthUser()` w środku `createExternalChild` jednak nie zachowuje sesji przy wywołaniu z innej akcji — rozwiążemy w Task 8 (możliwe przekształcenie `createExternalChild` na wersję `*_AsAdmin` bez wewnętrznego sprawdzania roli, albo wynieść logikę do helpera).

- [ ] **Step 2: Eksport z indexa**

W `src/lib/actions/index.ts` dodaj re-export jeżeli plik istnieje i agreguje akcje (sprawdź konwencję):

```typescript
export * from './trip-registration-requests';
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/trip-registration-requests.ts src/lib/actions/index.ts
git commit -m "feat(actions): trip registration requests list/approve/reject"
```

---

### Task 8: Sanity check `createExternalChild` w kontekście server action → server action

**Files:**
- Modify (warunkowo): `src/lib/actions/external-children.ts`

- [ ] **Step 1: Sprawdź czy wywołanie z `approveRegistrationRequest` działa**

Uruchom dev. Po Task 9–10 (gdy UI gotowy) kliknij „Zatwierdź" na realnym pending. Jeśli leci błąd „Brak uprawnień" — oznacza że `getAuthUser` nie widzi sesji w łańcuchu server action → server action.

- [ ] **Step 2 (warunkowy): Refaktor**

Jeśli błąd występuje — wyciągnij logikę core na funkcję `_createExternalChildCore(adminClient, input, actorUserId)`, a publiczne `createExternalChild` niech robi auth-check i woła core. W `approveRegistrationRequest` wołaj core bezpośrednio z `user.id` przekazanym jako `actorUserId`.

Jeśli działa bez problemu — pomiń ten step, dopisz w odpowiedzi „Krok 8 pominięty: createExternalChild działa poprawnie z poziomu approveRegistrationRequest."

- [ ] **Step 3: Commit (jeśli był refaktor)**

```bash
git add src/lib/actions/external-children.ts src/lib/actions/trip-registration-requests.ts
git commit -m "refactor(external-children): expose core for cross-action reuse"
```

---

### Task 9: Strona `/admin/registrations` + badge w menu

**Files:**
- Create: `src/app/(protected)/admin/registrations/page.tsx`
- Create: `src/app/(protected)/admin/registrations/registrations-list.tsx`
- Modify: layout/menu admina (sprawdź `src/app/(protected)/admin/layout.tsx` i komponent menu) — dodaj pozycję „Zgłoszenia" z badge'em liczby pending

- [ ] **Step 1: Lokalizacja menu**

```bash
grep -rn "Uczestnicy\|/admin/participants" src/app/\(protected\)/admin/layout.tsx src/components/ 2>/dev/null | head -20
```

Znajdź miejsce, gdzie definiowane są pozycje menu admina.

- [ ] **Step 2: Strona serwerowa**

```tsx
// src/app/(protected)/admin/registrations/page.tsx
import { listTripRegistrationRequests } from '@/lib/actions/trip-registration-requests';
import RegistrationsList from './registrations-list';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await listTripRegistrationRequests({ status: 'pending' });
  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Zgłoszenia z formularza WP</h1>
      </header>
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <RegistrationsList initialRows={data ?? []} />
    </div>
  );
}
```

- [ ] **Step 3: Klient — lista + filtry + akcje**

```tsx
// src/app/(protected)/admin/registrations/registrations-list.tsx
'use client';

import { useState, useTransition } from 'react';
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  listTripRegistrationRequests,
  type TripRegistrationRequestRow,
} from '@/lib/actions/trip-registration-requests';

export default function RegistrationsList({ initialRows }: { initialRows: TripRegistrationRequestRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function refresh(nextStatus = status, nextSearch = search) {
    startTransition(async () => {
      const res = await listTripRegistrationRequests({ status: nextStatus, search: nextSearch });
      if (res.data) setRows(res.data);
    });
  }

  function approve(id: string) {
    if (!confirm('Zatwierdzić zgłoszenie? Powstanie konto rodzica (magic link), dziecko trafi do CRM (Bez kategorii) i zostanie zapisane na wyjazd. Standardowy mail rejestracyjny wyjdzie automatycznie.')) return;
    startTransition(async () => {
      const res = await approveRegistrationRequest(id);
      if ('error' in res && res.error) {
        alert(res.error);
        return;
      }
      refresh();
    });
  }

  function submitReject(id: string) {
    startTransition(async () => {
      const res = await rejectRegistrationRequest(id, reason || null);
      if ('error' in res && res.error) {
        alert(res.error);
        return;
      }
      setRejectFor(null);
      setReason('');
      refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => { const v = e.target.value as typeof status; setStatus(v); refresh(v, search); }}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="pending">Oczekujące</option>
          <option value="approved">Zatwierdzone</option>
          <option value="rejected">Odrzucone</option>
          <option value="all">Wszystkie</option>
        </select>
        <input
          placeholder="Szukaj (imię, nazwisko, email)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={() => refresh()}
          onKeyDown={(e) => { if (e.key === 'Enter') refresh(); }}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-500">{rows.length} wpisów{pending && ' • aktualizuję…'}</span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Dziecko</th>
              <th className="px-3 py-2">Data ur.</th>
              <th className="px-3 py-2">Wzrost</th>
              <th className="px-3 py-2">Rodzic</th>
              <th className="px-3 py-2">Wyjazd</th>
              <th className="px-3 py-2">Zgłoszono</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{r.child_first_name} {r.child_last_name}</td>
                <td className="px-3 py-2">{r.child_birth_date}</td>
                <td className="px-3 py-2">{r.child_height_cm ?? '—'} cm</td>
                <td className="px-3 py-2">
                  <div>{r.parent_email}</div>
                  <div className="text-xs text-slate-500">{r.parent_phone ?? ''}</div>
                </td>
                <td className="px-3 py-2">{r.trip_title ?? r.trip_id}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString('pl-PL')}</td>
                <td className="px-3 py-2 text-xs">
                  {r.status === 'pending' && <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-800">Oczekuje</span>}
                  {r.status === 'approved' && <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">Zatwierdzone</span>}
                  {r.status === 'rejected' && <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">Odrzucone</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === 'pending' ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => approve(r.id)} disabled={pending} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">Zatwierdź</button>
                      <button onClick={() => { setRejectFor(r.id); setReason(''); }} disabled={pending} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">Odrzuć</button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{r.rejection_reason ?? ''}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">Brak zgłoszeń</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-4">
            <h2 className="text-sm font-semibold">Odrzuć zgłoszenie</h2>
            <p className="mt-1 text-xs text-slate-500">Powód (opcjonalny, nie jest wysyłany rodzicowi).</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 h-24 w-full rounded border border-slate-300 p-2 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setRejectFor(null)} className="rounded px-3 py-1 text-sm">Anuluj</button>
              <button onClick={() => submitReject(rejectFor)} disabled={pending} className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50">Odrzuć</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pozycja menu „Zgłoszenia" z badge'em**

W komponencie menu admina (po Step 1 wiesz gdzie) dodaj pozycję z linkiem do `/admin/registrations`. Jeśli menu jest server-rendered, zaciągnij liczbę przez `countPendingRegistrationRequests`:

```tsx
import { countPendingRegistrationRequests } from '@/lib/actions/trip-registration-requests';
const pendingCount = await countPendingRegistrationRequests();
// ...
<Link href="/admin/registrations" className="...">
  Zgłoszenia
  {pendingCount > 0 && (
    <span className="ml-2 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{pendingCount}</span>
  )}
</Link>
```

Jeśli menu jest klientowe — zrób mały komponent server wrapper, który pobiera count i przekazuje.

- [ ] **Step 5: Weryfikacja manualna**

1. `npm run dev`. Wejdź jako admin.
2. Menu „Zgłoszenia" pokazuje badge z liczbą pending (przynajmniej 1 utworzony w Task 4 Step 2).
3. Strona `/admin/registrations` listuje zgłoszenia. Filtry działają.
4. „Zatwierdź" → confirm → sprawdź w innej karcie `/admin/participants`, że dziecko jest jako „Bez kategorii", w `/admin/trips/<id>` (lista zapisanych), że uczestnik dodany. Sprawdź skrzynkę testową (`parent.test@…`) — przyszedł mail rejestracyjny.
5. „Odrzuć" → wpisz powód → status zmienia się na „rejected".
6. Sprawdź w Supabase: `SELECT id, status, processed_at, created_participant_id FROM trip_registration_requests;`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(protected\)/admin/registrations src/app/\(protected\)/admin/layout.tsx src/components
git commit -m "feat(admin): registrations queue page + menu badge"
```

---

## Chunk 5: Domknięcie

### Task 10: Doc kontraktu API dla developera WP

**Files:**
- Create: `docs/wp-trip-registration-api.md`

- [ ] **Step 1: Spisz kontrakt**

```markdown
# WP → aplikacja: API zgłoszeń na wyjazd

## Endpoint
`POST https://<app-domain>/api/public/trip-registrations`

## Nagłówki
- `Content-Type: application/json`
- `x-api-key: <WP_INTAKE_API_KEY>` — sekret ustalony z adminem

## Body (JSON)
{
  "trip_id": "UUID wyjazdu z aplikacji (custom field przy wpisie WP)",
  "child": {
    "first_name": "string (2–50)",
    "last_name":  "string (2–50)",
    "birth_date": "YYYY-MM-DD",
    "height_cm":  "int 50–250 lub null"
  },
  "parent": {
    "email": "string email (max 120)",
    "phone": "string (6–30)"
  }
}

## Odpowiedzi
- 201 `{ "id": "...", "status": "pending" }` — przyjęte
- 200 `{ "id": "...", "status": "pending", "deduped": true }` — identyczne pending już istniało
- 400 — błąd walidacji (zwraca details Zod)
- 401 — brak/zły klucz
- 403 — wyjazd nie przyjmuje zgłoszeń (flaga off)
- 404 — wyjazd nie istnieje
- 500 — błąd serwera (spróbuj ponownie)

## Zachowanie
- Endpoint nigdy nie tworzy konta rodzica ani uczestnika.
- Wpis trafia do kolejki, admin moderuje w `/admin/registrations`.
- Po zatwierdzeniu rodzic dostaje mail rejestracyjny + (jeśli nowy) magic link do konta.

## Konfiguracja po stronie WP
1. Per wpis wyjazdu trzymaj custom field „ID wyjazdu w systemie" — wartość = UUID z aplikacji (admin kopiuje z karty wyjazdu).
2. Formularz „Zapisz dziecko" wysyła powyższy POST z tym UUID.
3. Klucz API trzymany w konfiguracji WP (nie w kodzie publicznym).
```

- [ ] **Step 2: Commit**

```bash
git add docs/wp-trip-registration-api.md
git commit -m "docs: WP intake API contract"
```

---

### Task 11: Smoke test end-to-end + zgoda na push

- [ ] **Step 1: Pełny test ręczny**

1. Zresetuj testowe zgłoszenia (`DELETE FROM trip_registration_requests WHERE parent_email LIKE '%example.com';`).
2. Ustaw `registration_form_enabled=true` na wybranym wyjeździe Obozu Letniego.
3. `curl` z Task 4 Step 2 z prawdziwym mailem testowym.
4. `/admin/registrations` → Zatwierdź.
5. Sprawdź:
   - Skrzynka rodzica: mail magic link + mail rejestracyjny.
   - `/admin/participants`: dziecko w „Bez kategorii".
   - Lista zapisanych na wyjeździe: dziecko jest.
   - Tabela `trip_registration_requests`: status `approved`, `created_participant_id` ustawione.
6. Zrób drugi `curl` z tym samym body → odpowiedź `200 deduped:true`, nic nowego nie powstaje.
7. Wyłącz flagę → `curl` → `403`.

- [ ] **Step 2: Zapytaj użytkownika o push i deploy**

Wypisz (przez AskUserQuestion jeśli interaktywnie):
- „Wszystko działa lokalnie. Pushnąć `main` na origin (auto-build produkcji na Vercelu)? Pamiętaj że na produkcji trzeba: (a) odpalić obie migracje SQL w Supabase prod, (b) ustawić `WP_INTAKE_API_KEY` w Vercel ENV."

Nie pushuj bez odpowiedzi „tak".

---

## Open questions / out of scope

- **Mail do rodzica o odrzuceniu** — nie wysyłamy w tej iteracji.
- **GET endpoint** (dane wyjazdu live dla WP) — nie wdrażamy. Endpoint POST zaprojektowany rozszerzalnie.
- **Audyt historii zmian statusu** — przechowujemy tylko końcowy stan + `processed_at/by`.
- **Spam/rate limit** — na MVP wystarczy klucz API + dedup index. Rate limit dorzucimy gdy zobaczymy ruch.
- **Walidacja wieku 3–17** — nie egzekwujemy hard; admin widzi datę urodzenia w UI i decyduje.

## Files Touched (recap)

Create:
- `supabase/migrations/trip-registration-form-flag.sql`
- `supabase/migrations/trip-registration-requests.sql`
- `src/app/api/public/trip-registrations/route.ts`
- `src/lib/actions/trip-registration-requests.ts`
- `src/app/(protected)/admin/registrations/page.tsx`
- `src/app/(protected)/admin/registrations/registrations-list.tsx`
- `docs/wp-trip-registration-api.md`

Modify:
- `src/lib/actions/trips.ts` (pole `registration_form_enabled` w create/update)
- `src/lib/actions/external-children.ts` (warunkowo — refaktor core)
- `src/lib/actions/index.ts` (re-export, jeśli używany wzorzec)
- `src/types/index.ts` (pole na typie Trip)
- `src/components/admin/trip-form/*` (sekcja „Zapisy zewnętrzne (WordPress)")
- `src/app/(protected)/admin/trips/page.tsx` lub komponent listy (badge „WP")
- `src/app/(protected)/admin/layout.tsx` lub komponent menu (pozycja „Zgłoszenia")
