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
  organizer_notes: z.string().trim().max(1000).nullable().optional(),
});

function parseAllowedOrigins(): string[] {
  const raw = process.env.WIDGET_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) return false;
  return allowed.some((a) => {
    if (a === '*') return true;
    if (a.startsWith('*.')) {
      const suffix = a.slice(1);
      try {
        const host = new URL(origin).host;
        return host.endsWith(suffix.slice(1));
      } catch {
        return false;
      }
    }
    return a === origin;
  });
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && originAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (!originAllowed(origin)) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403, headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400, headers },
    );
  }
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, registration_form_enabled')
    .eq('id', data.trip_id)
    .maybeSingle();

  if (tripErr) return NextResponse.json({ error: 'db_error' }, { status: 500, headers });
  if (!trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404, headers });
  if (!trip.registration_form_enabled) {
    return NextResponse.json({ error: 'registrations_closed' }, { status: 403, headers });
  }

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
    return NextResponse.json(
      { id: existing.id, status: 'pending', deduped: true },
      { status: 200, headers },
    );
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
      organizer_notes: data.organizer_notes || null,
      raw_payload: body as object,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('widget trip_registration_requests insert error:', insertErr);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers });
  }

  return NextResponse.json({ id: inserted.id, status: 'pending' }, { status: 201, headers });
}
