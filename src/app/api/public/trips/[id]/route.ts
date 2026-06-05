import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
      try {
        const base = a.slice(2);
        const host = new URL(origin).host;
        return host === base || host.endsWith(`.${base}`);
      } catch {
        return false;
      }
    }
    return a === origin;
  });
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (origin && !originAllowed(origin)) {
    return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403, headers });
  }

  const { id } = await params;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: 'trip_not_found' }, { status: 404, headers });
  }

  const admin = createAdminClient();
  const { data: trip, error } = await admin
    .from('trips')
    .select('id, title, registration_form_enabled')
    .eq('id', parsed.data)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500, headers });
  if (!trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404, headers });

  return NextResponse.json(
    {
      id: trip.id,
      title: trip.title,
      registration_form_enabled: Boolean(trip.registration_form_enabled),
      is_open: Boolean(trip.registration_form_enabled),
    },
    { status: 200, headers },
  );
}
