# Zapisy z WordPressa do aplikacji (z moderacją admina)

Integracja własnego formularza zapisów na obozy z WordPressa. Zgłoszenia
trafiają najpierw do kolejki w aplikacji, admin je zatwierdza, dopiero
wtedy:

- dziecko jest tworzone w bazie i przypisywane do wyjazdu,
- rodzic dostaje maila z potwierdzeniem i linkiem do założenia konta /
  ustawienia hasła (na email z którego wypełnił formularz).

Założenie konta przez rodzica jest **oddzielną, dobrowolną czynnością** —
zapis dziecka na obóz działa niezależnie.

---

## 1. Architektura

```
[WordPress: <form>]
       │  POST JSON  (email rodzica, telefon, dane dziecka, trip_id, RODO)
       ▼
[Next.js: /api/public/wp-signup]  → insert do pending_trip_signups (status='pending')
       │
       ▼
[Admin /admin/pending-signups]  → "Zatwierdź" lub "Odrzuć"
       │
       ▼ (zatwierdzenie)
[Supabase]
  - auth.users (invite, jeśli rodzic jeszcze nie ma konta — bez hasła)
  - profiles (email + telefon + RODO; imię/nazwisko może zostać puste,
    rodzic uzupełni przy zakładaniu konta)
  - participants (dziecko z parent_id)
  - participant_groups (jeśli wybrano grupę)
  - trip_registrations (zapis na wyjazd)
       │
       ▼
[E-mail do rodzica]
  - potwierdzenie zapisu dziecka na konkretny wyjazd
  - link do założenia konta / ustawienia hasła (jeśli jeszcze nie ma konta)
```

Kluczowe zasady:

- Endpoint na WP **nigdy** nie tworzy konta ani uczestnika — tylko wrzuca
  wpis do kolejki. Spam moderuje admin.
- Profil rodzica może istnieć w bazie **bez aktywnego konta auth** — w
  praktyce użyjemy `auth.admin.inviteUserByEmail`, który tworzy
  `auth.users` w stanie "zaproszony" (login dopiero po kliknięciu linka).
- Rodzic, który dostanie maila z linkiem, ale go zignoruje — dziecko i
  tak jest na liście wyjazdu. Admin widzi je w `/admin/registrations`.
- Brak migracji konta: jeśli rodzic kiedyś założy konto sam przez
  `/register` na tym samym mailu, Supabase Auth obsłuży to (lub trigger /
  ręczna logika upsert profilu).

---

## 2. Migracja bazy

Plik: `supabase/migrations/pending-trip-signups.sql`

```sql
-- Kolejka zgłoszeń z formularza WP (oczekują na zatwierdzenie admina)
create table if not exists public.pending_trip_signups (
  id uuid primary key default gen_random_uuid(),

  -- dane rodzica (tylko kontakt — bez imienia/nazwiska)
  parent_email text not null,
  parent_phone text not null,

  -- dane dziecka
  child_first_name text not null,
  child_last_name text not null,
  child_birth_date date not null,
  child_height_cm int,
  child_notes_health text,
  child_notes_food text,
  child_notes_additional text,

  -- kontekst zapisu
  trip_id uuid not null references public.trips(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,

  rodo_accepted_at timestamptz not null,
  source text not null default 'wordpress',

  -- moderacja
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reject_reason text,

  -- po zatwierdzeniu — wskaźniki do utworzonych encji (audit)
  created_participant_id uuid references public.participants(id) on delete set null,
  created_registration_id uuid references public.trip_registrations(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists idx_pending_signups_status_created
  on public.pending_trip_signups (status, created_at desc);

create index if not exists idx_pending_signups_trip
  on public.pending_trip_signups (trip_id);

-- RLS: tylko admin czyta i modyfikuje. Insert robi service role (endpoint).
alter table public.pending_trip_signups enable row level security;

create policy "pending_signups_admin_select"
  on public.pending_trip_signups for select
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

create policy "pending_signups_admin_update"
  on public.pending_trip_signups for update
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

create policy "pending_signups_admin_delete"
  on public.pending_trip_signups for delete
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
-- INSERT nie ma polityki — robi go wyłącznie service role z endpointu.
```

> **Po wgraniu plików — uruchom migrację ręcznie na Supabase**
> (SQL Editor → Run). Bez tego endpoint zwróci 500.

---

## 3. Zmienne środowiskowe (Vercel)

```
WP_SIGNUP_SECRET=<openssl rand -hex 32>
WP_ALLOWED_ORIGINS=https://biegun-sport.pl,https://www.biegun-sport.pl
NEXT_PUBLIC_APP_URL=https://twoja-apka.vercel.app
```

`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` — już są.

---

## 4. Endpoint publiczny: `/api/public/wp-signup`

Plik: `src/app/api/public/wp-signup/route.ts`

Kontrakt:

- `POST`, `Content-Type: application/json`, `X-Signup-Secret: <secret>`
- Body:

```json
{
  "parent": { "email": "anna@example.com", "phone": "+48600100200" },
  "child": {
    "first_name": "Jan",
    "last_name": "Kowalski",
    "birth_date": "2015-04-12",
    "height_cm": 140,
    "group_id": null,
    "notes_health": "alergia na orzechy",
    "notes_food": null,
    "notes_additional": null
  },
  "trip_id": "uuid-wyjazdu",
  "rodo_accepted": true,
  "hp": ""
}
```

- Odpowiedzi:
  - `200` — `{ ok: true, pending_id }` (zgłoszenie czeka na admina)
  - `400` — walidacja, `{ error }`
  - `401` — brak/zły secret
  - `404` — `trip_id` nie istnieje
  - `409` — duplikat: ten sam email + imię/nazwisko/data ur. + trip_id już
    czeka w kolejce z `status = 'pending'`
  - `429` — rate limit
  - `500` — błąd serwera

Kod:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

const schema = z.object({
  parent: z.object({
    email: z.string().email(),
    phone: z.string().min(6).max(20),
  }),
  child: z.object({
    first_name: z.string().min(2).max(50),
    last_name: z.string().min(2).max(50),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    height_cm: z.number().int().positive().max(250).nullable().optional(),
    group_id: z.string().uuid().nullable().optional(),
    notes_health: z.string().max(1000).nullable().optional(),
    notes_food: z.string().max(1000).nullable().optional(),
    notes_additional: z.string().max(1000).nullable().optional(),
  }),
  trip_id: z.string().uuid(),
  rodo_accepted: z.literal(true),
  hp: z.string().max(0).optional(),
});

const ipBucket = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
function rateLimited(ip: string) {
  const now = Date.now();
  const b = ipBucket.get(ip);
  if (!b || b.resetAt < now) {
    ipBucket.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count++;
  return b.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-signup-secret') !== process.env.WP_SIGNUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Za dużo zgłoszeń. Spróbuj za chwilę.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Błędne dane' },
      { status: 400 },
    );
  }
  const { parent, child, trip_id } = parsed.data;
  const email = parent.email.trim().toLowerCase();

  const admin = createAdminClient();

  // Walidacja wyjazdu
  const { data: trip } = await admin
    .from('trips')
    .select('id, title')
    .eq('id', trip_id)
    .maybeSingle();
  if (!trip) {
    return NextResponse.json({ error: 'Wyjazd nie istnieje' }, { status: 404 });
  }

  // Duplikat oczekujący w kolejce — to samo dziecko, ten sam mail, ten sam wyjazd
  const { data: existing } = await admin
    .from('pending_trip_signups')
    .select('id')
    .eq('parent_email', email)
    .eq('child_first_name', child.first_name)
    .eq('child_last_name', child.last_name)
    .eq('child_birth_date', child.birth_date)
    .eq('trip_id', trip_id)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'Twoje zgłoszenie już czeka na zatwierdzenie.' },
      { status: 409 },
    );
  }

  const { data: inserted, error } = await admin
    .from('pending_trip_signups')
    .insert({
      parent_email: email,
      parent_phone: parent.phone,
      child_first_name: child.first_name,
      child_last_name: child.last_name,
      child_birth_date: child.birth_date,
      child_height_cm: child.height_cm ?? null,
      child_notes_health: child.notes_health ?? null,
      child_notes_food: child.notes_food ?? null,
      child_notes_additional: child.notes_additional ?? null,
      trip_id,
      group_id: child.group_id ?? null,
      rodo_accepted_at: new Date().toISOString(),
      source: 'wordpress',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('pending_trip_signups insert error', error);
    return NextResponse.json({ error: 'Błąd zapisu zgłoszenia' }, { status: 500 });
  }

  // TODO: opcjonalnie — powiadomienie maila admina o nowym zgłoszeniu
  // sendAdminNewSignupEmail(...).catch(console.error);

  return NextResponse.json({ ok: true, pending_id: inserted.id });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.WP_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signup-Secret',
    'Access-Control-Max-Age': '86400',
  };
}
```

---

## 5. Endpoint publiczny: lista wyjazdów dla formularza

Plik: `src/app/api/public/trips/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const admin = createAdminClient();
  // Pokazujemy tylko nadchodzące wyjazdy (zapisy mają sens)
  const { data } = await admin
    .from('trips')
    .select('id, title, location, departure_datetime')
    .gte('departure_datetime', new Date().toISOString())
    .order('departure_datetime');
  return NextResponse.json(
    { trips: data || [] },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
  );
}
```

(Opcjonalnie: `groups` analogicznie, jeśli chcesz dropdown grupy w
formularzu — patrz poprzednia wersja docu.)

---

## 6. Akcja serwerowa: zatwierdzanie / odrzucanie

Plik: `src/lib/actions/pending-signups.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { logActivity } from './activity-logs';
import {
  sendWpSignupApprovedEmail,
  sendWpSignupApprovedEmailNoAccount,
  sendWpSignupRejectedEmail,
} from '@/lib/email';

export async function listPendingSignups() {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return { error: 'Brak uprawnień', items: [] };

  const admin = createAdminClient();
  const { data } = await admin
    .from('pending_trip_signups')
    .select('*, trip:trips(id, title, departure_datetime), group:groups(id, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return { items: data || [] };
}

export async function approvePendingSignup(pendingId: string) {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();

  const { data: row, error: rowErr } = await admin
    .from('pending_trip_signups')
    .select('*')
    .eq('id', pendingId)
    .single();
  if (rowErr || !row) return { error: 'Zgłoszenie nie istnieje' };
  if (row.status !== 'pending') return { error: 'To zgłoszenie już zostało rozpatrzone' };

  // 1) Znajdź lub utwórz rodzica (auth + profile). Konto jest "zaproszone" —
  //    rodzic musi sam ustawić hasło klikając w link z maila.
  let parentId: string | null = null;
  let accountInvited = false;

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', row.parent_email)
    .maybeSingle();

  if (existingProfile) {
    parentId = existingProfile.id;
    // Uzupełnij telefon, jeśli brakuje
    await admin
      .from('profiles')
      .update({ phone: row.parent_phone })
      .eq('id', parentId)
      .is('phone', null);
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      row.parent_email,
      { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/parent/children` },
    );
    if (inviteError || !invited?.user) {
      return { error: `Nie można utworzyć konta rodzica: ${inviteError?.message}` };
    }
    parentId = invited.user.id;
    accountInvited = true;

    const { error: profileError } = await admin.from('profiles').insert({
      id: parentId,
      email: row.parent_email,
      phone: row.parent_phone,
      first_name: null,
      last_name: null,
      role: 'parent',
      rodo_accepted_at: row.rodo_accepted_at,
    });
    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Profile insert error:', profileError);
    }
  }
  if (!parentId) return { error: 'Brak ID rodzica' };

  // 2) Utwórz uczestnika
  const { data: participant, error: pErr } = await admin
    .from('participants')
    .insert({
      parent_id: parentId,
      first_name: row.child_first_name,
      last_name: row.child_last_name,
      birth_date: row.child_birth_date,
      height_cm: row.child_height_cm,
      parent_notes_health: row.child_notes_health,
      parent_notes_food: row.child_notes_food,
      parent_notes_additional: row.child_notes_additional,
    })
    .select('id')
    .single();
  if (pErr || !participant) return { error: `Błąd dodawania dziecka: ${pErr?.message}` };

  // 3) Grupa (opcjonalnie)
  if (row.group_id) {
    await admin
      .from('participant_groups')
      .insert({ participant_id: participant.id, group_id: row.group_id });
  }

  // 4) Zapis na wyjazd
  const { data: reg, error: rErr } = await admin
    .from('trip_registrations')
    .insert({
      trip_id: row.trip_id,
      participant_id: participant.id,
      registered_by: user.id,
      registration_type: 'admin',
      status: 'active',
    })
    .select('id')
    .single();
  if (rErr || !reg) return { error: `Błąd zapisu na wyjazd: ${rErr?.message}` };

  // 5) Oznacz zgłoszenie jako zatwierdzone
  await admin
    .from('pending_trip_signups')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      created_participant_id: participant.id,
      created_registration_id: reg.id,
    })
    .eq('id', pendingId);

  // 6) Mail do rodzica — dwa warianty
  const childName = `${row.child_first_name} ${row.child_last_name}`;
  if (accountInvited) {
    // Supabase sam wysyła template "Invite user" z linkiem do ustawienia
    // hasła. My wysyłamy dodatkowo potwierdzenie zapisu z tym samym linkiem
    // dla pewności (link generujemy przez generateLink, patrz sekcja 7).
    await sendWpSignupApprovedEmail({
      to: row.parent_email,
      childName,
      tripId: row.trip_id,
    }).catch(console.error);
  } else {
    await sendWpSignupApprovedEmailNoAccount({
      to: row.parent_email,
      childName,
      tripId: row.trip_id,
    }).catch(console.error);
  }

  await logActivity({
    action: 'pending_signup_approved',
    target_table: 'pending_trip_signups',
    target_id: pendingId,
    metadata: { participant_id: participant.id, registration_id: reg.id },
  });

  revalidatePath('/admin/pending-signups');
  return { ok: true };
}

export async function rejectPendingSignup(pendingId: string, reason: string) {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('pending_trip_signups')
    .select('parent_email, child_first_name, child_last_name, status')
    .eq('id', pendingId)
    .single();
  if (!row) return { error: 'Zgłoszenie nie istnieje' };
  if (row.status !== 'pending') return { error: 'Już rozpatrzone' };

  await admin
    .from('pending_trip_signups')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      reject_reason: reason,
    })
    .eq('id', pendingId);

  await sendWpSignupRejectedEmail({
    to: row.parent_email,
    childName: `${row.child_first_name} ${row.child_last_name}`,
    reason,
  }).catch(console.error);

  revalidatePath('/admin/pending-signups');
  return { ok: true };
}
```

---

## 7. Maile do rodzica

W `src/lib/email.ts` dodaj trzy funkcje (skrót — szablony wzoruj na
istniejących):

- `sendWpSignupApprovedEmail({ to, childName, tripId })` — rodzic nie miał
  konta. Treść:
  > Cześć, dziękujemy za zgłoszenie. Dziecko **{childName}** zostało zapisane
  > na wyjazd **{tripTitle}**. Aby zobaczyć szczegóły, listę płatności i
  > zarządzać udziałem — załóż konto na tym samym adresie e-mail klikając
  > w link poniżej:
  > **[Ustaw hasło i wejdź do panelu]({passwordLink})**
  >
  > Jeśli nie klikniesz w link — dziecko i tak pozostaje zapisane. Konto
  > możesz założyć później na `https://app.biegun-sport.pl/register`
  > używając tego samego adresu e-mail.

  `{passwordLink}` generujesz w funkcji `sendWpSignupApprovedEmail` przez:

  ```ts
  const { data } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: to,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/parent/children` },
  });
  const passwordLink = data?.properties?.action_link;
  ```

- `sendWpSignupApprovedEmailNoAccount({ to, childName, tripId })` — rodzic
  już ma konto. Treść:
  > Cześć, dziecko **{childName}** zostało zapisane na **{tripTitle}**.
  > Szczegóły zobaczysz logując się na `https://app.biegun-sport.pl/login`
  > adresem **{to}**.

- `sendWpSignupRejectedEmail({ to, childName, reason })` — odrzucenie.

> Dodaj wpisy w tabeli `email_templates` (lub trzymaj tekst w kodzie, jeśli
> nie potrzebujesz edycji w panelu). Jeśli używasz `email_templates`,
> pamiętaj o `RAW_HTML_KEYS` dla pól z tabelami (patrz notatka z 2026-05-19).

---

## 8. Panel admina: `/admin/pending-signups`

Plik: `src/app/(protected)/admin/pending-signups/page.tsx`

Minimum funkcjonalne:

- Lista zgłoszeń `status='pending'` (z `listPendingSignups`).
- Każda karta pokazuje: dane rodzica, dziecka, wybrany wyjazd, datę zgłoszenia.
- Dwie akcje: **Zatwierdź** (od razu) i **Odrzuć** (modal z polem
  `reason`).
- Po akcji — `router.refresh()`.
- W nawigacji admina dodaj link **„Zgłoszenia oczekujące"** z licznikiem
  (badge z liczbą `pending`).

Szkielet komponentu (przyciski → server action):

```tsx
'use client';
import { approvePendingSignup, rejectPendingSignup } from '@/lib/actions/pending-signups';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function PendingActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState('');

  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const res = await approvePendingSignup(id);
          if ('error' in res) alert(res.error);
          else router.refresh();
        })}
      >Zatwierdź</button>

      <button
        disabled={pending}
        onClick={() => {
          const r = prompt('Powód odrzucenia:');
          if (!r) return;
          start(async () => {
            const res = await rejectPendingSignup(id, r);
            if ('error' in res) alert(res.error);
            else router.refresh();
          });
        }}
      >Odrzuć</button>
    </div>
  );
}
```

(Pełną stylistykę dorób tak jak reszta panelu admina — Card / Tabs.)

---

## 9. Formularz na WordPress

Wklej w bloku **Custom HTML** w edytorze WP.

```html
<form id="bs-signup-form" class="bs-form" novalidate>
  <h2>Zapis dziecka na obóz</h2>

  <fieldset>
    <legend>Wyjazd</legend>
    <label>Wybierz wyjazd
      <select name="trip_id" required>
        <option value="">— wybierz —</option>
      </select>
    </label>
  </fieldset>

  <fieldset>
    <legend>Rodzic / opiekun (kontakt)</legend>
    <label>E-mail<input type="email" name="parent_email" required></label>
    <label>Telefon<input type="tel" name="parent_phone" required minlength="6"></label>
    <p class="bs-hint">
      Pełne dane (imię, nazwisko, adres) uzupełnisz przy zakładaniu konta —
      wyślemy Ci link e-mailem po zatwierdzeniu zgłoszenia.
    </p>
  </fieldset>

  <fieldset>
    <legend>Dziecko</legend>
    <label>Imię<input name="child_first_name" required minlength="2"></label>
    <label>Nazwisko<input name="child_last_name" required minlength="2"></label>
    <label>Data urodzenia<input type="date" name="child_birth_date" required></label>
    <label>Wzrost (cm)<input type="number" name="child_height_cm" min="50" max="220"></label>
    <label>Uwagi zdrowotne / alergie
      <textarea name="child_notes_health" maxlength="1000"></textarea>
    </label>
    <label>Uwagi żywieniowe
      <textarea name="child_notes_food" maxlength="1000"></textarea>
    </label>
    <label>Inne uwagi
      <textarea name="child_notes_additional" maxlength="1000"></textarea>
    </label>
  </fieldset>

  <label class="bs-checkbox">
    <input type="checkbox" name="rodo" required>
    Akceptuję <a href="/polityka-prywatnosci" target="_blank">politykę prywatności</a>
    i wyrażam zgodę na przetwarzanie danych dziecka w celu organizacji wyjazdu.
  </label>

  <input type="text" name="hp" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px;" aria-hidden="true">

  <button type="submit">Wyślij zgłoszenie</button>
  <p class="bs-status" role="status" aria-live="polite"></p>
</form>

<script>
(function () {
  const API_BASE = 'https://twoja-apka.vercel.app';
  const SECRET = 'TU_WKLEJ_WP_SIGNUP_SECRET';

  const form = document.getElementById('bs-signup-form');
  const status = form.querySelector('.bs-status');
  const tripSelect = form.querySelector('select[name="trip_id"]');

  // Wyjazdy
  fetch(API_BASE + '/api/public/trips')
    .then(r => r.json())
    .then(({ trips }) => {
      trips.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        const d = t.departure_datetime
          ? new Date(t.departure_datetime).toLocaleDateString('pl-PL')
          : '';
        o.textContent = d ? `${t.title} (${d})` : t.title;
        tripSelect.appendChild(o);
      });
    })
    .catch(() => { status.textContent = 'Nie udało się pobrać listy wyjazdów.'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Wysyłam...';

    const f = new FormData(form);
    const payload = {
      parent: {
        email: (f.get('parent_email') || '').trim(),
        phone: (f.get('parent_phone') || '').trim(),
      },
      child: {
        first_name: (f.get('child_first_name') || '').trim(),
        last_name: (f.get('child_last_name') || '').trim(),
        birth_date: f.get('child_birth_date'),
        height_cm: f.get('child_height_cm') ? Number(f.get('child_height_cm')) : null,
        group_id: null,
        notes_health: f.get('child_notes_health') || null,
        notes_food: f.get('child_notes_food') || null,
        notes_additional: f.get('child_notes_additional') || null,
      },
      trip_id: f.get('trip_id'),
      rodo_accepted: f.get('rodo') === 'on',
      hp: f.get('hp') || '',
    };

    try {
      const res = await fetch(API_BASE + '/api/public/wp-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signup-Secret': SECRET,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd');

      status.textContent =
        'Dziękujemy! Zgłoszenie czeka na zatwierdzenie. Po akceptacji ' +
        'wyślemy potwierdzenie i (jeśli to Twój pierwszy zapis) link do ' +
        'założenia konta na podany adres e-mail.';
      form.reset();
    } catch (err) {
      status.textContent = 'Błąd: ' + err.message;
    }
  });
})();
</script>

<style>
.bs-form { max-width: 560px; display: grid; gap: 16px; }
.bs-form fieldset { border: 1px solid #ddd; padding: 16px; }
.bs-form label { display: block; margin-bottom: 8px; font-size: 14px; }
.bs-form input, .bs-form select, .bs-form textarea {
  width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;
}
.bs-form button {
  padding: 12px 16px; background: #0a7; color: #fff; border: 0;
  border-radius: 6px; cursor: pointer; font-weight: 600;
}
.bs-checkbox { display: flex; gap: 8px; align-items: flex-start; }
.bs-hint { font-size: 12px; color: #666; margin-top: -4px; }
.bs-status { min-height: 1.4em; font-size: 14px; }
</style>
```

Podmień `API_BASE` i `SECRET`.

---

## 10. Co widzi rodzic — krok po kroku

1. Wypełnia formularz na WP, wciska **Wyślij**.
2. Widzi komunikat: *„Zgłoszenie czeka na zatwierdzenie..."*. Nic w skrzynce
   jeszcze nie ma.
3. Admin w `/admin/pending-signups` klika **Zatwierdź**.
4. Rodzic dostaje maila:
   - jeśli **nie miał konta** — „dziecko zapisane na wyjazd, kliknij tu
     żeby ustawić hasło" (link z `generateLink type=invite`),
   - jeśli **już miał konto** — „dziecko zapisane, zaloguj się tu".
5. Po ustawieniu hasła rodzic loguje się i widzi dziecko + wyjazd w
   `/parent/children` oraz `/parent/payments`.
6. Jeśli rodzic zignoruje maila — dziecko **zostaje** w bazie, **zostaje**
   zapisane na wyjazd. Admin może wysłać przypomnienie ręcznie z panelu
   (TODO — funkcja „Wyślij ponownie zaproszenie").

---

## 11. Co widzi admin — krok po kroku

1. Powiadomienie (opcjonalnie e-mail / kropka w UI) o nowym zgłoszeniu.
2. Wchodzi na `/admin/pending-signups`, widzi listę.
3. Karta zgłoszenia: dane rodzica + dziecka + wyjazd + uwagi.
4. **Zatwierdź** → wszystko dzieje się automatycznie (konto-invite,
   participant, registration, mail).
5. **Odrzuć** → modal z polem powodu, mail do rodzica z wyjaśnieniem.
6. Po zatwierdzeniu dziecko jest w standardowych miejscach:
   - `/admin/registrations?trip=...` — zapisani na wyjazd,
   - `/admin/payments` — pojawi się gdy rodzic wybierze opcję płatności
     (stop1/stop2/własny transport) — taki sam flow jak obecnie.

---

## 12. Kolejność wdrożenia

1. Migracja SQL (sekcja 2) — uruchom ręcznie na Supabase.
2. Dodaj env vars w Vercel (sekcja 3) i lokalnie w `.env.local`.
3. Utwórz pliki:
   - `src/app/api/public/wp-signup/route.ts`
   - `src/app/api/public/trips/route.ts`
   - `src/lib/actions/pending-signups.ts`
   - `src/app/(protected)/admin/pending-signups/page.tsx`
   - 3 nowe funkcje w `src/lib/email.ts`
4. Dodaj link do panelu admina w sidebarze + badge z liczbą `pending`.
5. Lokalny test endpointu `curl`-em (sekcja 13).
6. Test ścieżki: zgłoszenie → admin zatwierdza → mail do rodzica →
   rodzic ustawia hasło → loguje się → widzi dziecko + wyjazd.
7. Push na `main` (po potwierdzeniu).
8. W WP wklej formularz, podmień `API_BASE` i `SECRET`.
9. Test e2e z prawdziwego maila.

---

## 13. Testy

```bash
# Happy path
curl -X POST https://twoja-apka.vercel.app/api/public/wp-signup \
  -H "Content-Type: application/json" \
  -H "X-Signup-Secret: $WP_SIGNUP_SECRET" \
  -d '{
    "parent": {"email":"test+wp1@example.com","phone":"+48600000000"},
    "child":  {"first_name":"Janek","last_name":"Testowy","birth_date":"2016-06-01"},
    "trip_id": "UUID_REALNEGO_WYJAZDU",
    "rodo_accepted": true,
    "hp": ""
  }'
# 200 { ok:true, pending_id:"..." }

# Brak sekretu → 401
# Honeypot "hp":"spam" → 400
# Duplikat (drugi raz to samo) → 409
# Brak trip_id → 400
# Nieistniejące trip_id → 404
```

Po zatwierdzeniu w panelu admina sprawdź w SQL:

```sql
select id, status, created_participant_id, created_registration_id
from pending_trip_signups order by created_at desc limit 5;

select id, first_name, last_name, parent_id from participants order by created_at desc limit 5;

select id, trip_id, participant_id, status from trip_registrations
order by created_at desc limit 5;
```

---

## 14. Bezpieczeństwo

To co już chroni endpoint publiczny:

- `X-Signup-Secret` (shared secret w nagłówku),
- whitelist Origin w CORS (`WP_ALLOWED_ORIGINS`),
- honeypot (`hp` musi być pusty),
- rate limit 5/min per IP,
- walidacja Zod + RODO checkbox jako `z.literal(true)`,
- **moderacja admina** — nawet jeśli ktoś obejdzie wszystkie powyższe,
  spam nie wpada do produkcyjnych tabel; admin go odrzuca.

Dlatego ten flow jest bezpieczniejszy niż wariant bez moderacji — i pasuje
do realnego procesu klubu (każdy zapis i tak weryfikujesz).

---

## 15. Co dalej (opcjonalnie)

- **Powiadomienie admina** o nowym zgłoszeniu (mail / kropka w UI).
- **Bulk approve** — checkbox „zatwierdź wszystkie zaufane" przy oczywistych
  rodzicach (np. których maile już są w `profiles`).
- **„Wyślij ponownie zaproszenie"** — przycisk przy uczestniku w
  `/admin/registrations`, gdy rodzic nie ma jeszcze konta auth.
- **Auto-przypisanie do grupy** wg wieku dziecka (na podstawie `birth_date`
  i kategorii grup).
- **Tracking źródła** — pole `source` w `pending_trip_signups` można
  rozszerzyć o UTM-y przekazane w body z formularza.
