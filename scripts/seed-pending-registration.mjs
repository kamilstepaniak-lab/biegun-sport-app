#!/usr/bin/env node
// Jednorazowy seed: dolozy przykladowe zgloszenie do trip_registration_requests
// zeby mozna bylo obejrzec /admin/registrations z realnymi danymi.
//
// Uruchom:  node scripts/seed-pending-registration.mjs

import { readFileSync } from 'node:fs';

// Lekki parser .env.local — bez zaleznosci.
function loadDotEnv(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // brak pliku — uzyj zmiennych z procesu
  }
}
loadDotEnv('.env.local');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env.');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

async function pickTrip() {
  // Najpierw probujemy znalezc obz letni; jak nie ma — pierwszy dostepny.
  const url =
    `${SUPABASE_URL}/rest/v1/trips?select=id,title,category&order=created_at.desc&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`trips fetch: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length) throw new Error('Nie ma zadnego wyjazdu w bazie.');
  return rows[0];
}

async function insertRequest(tripId) {
  const body = {
    trip_id: tripId,
    child_first_name: 'Jan',
    child_last_name: 'Testowy',
    child_birth_date: '2015-06-12',
    child_height_cm: 142,
    parent_email: 'rodzic.test+seed@example.com',
    parent_phone: '+48 500 600 700',
    raw_payload: {
      trip_id: tripId,
      source: 'seed-script',
      child: { first_name: 'Jan', last_name: 'Testowy', birth_date: '2015-06-12', height_cm: 142 },
      parent: { email: 'rodzic.test+seed@example.com', phone: '+48 500 600 700' },
    },
  };

  const url = `${SUPABASE_URL}/rest/v1/trip_registration_requests`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (txt.includes('uq_trr_pending_dedup')) {
      console.log('Istnieje juz identyczne pending — pomijam.');
      return null;
    }
    throw new Error(`insert: ${res.status} ${txt}`);
  }
  return (await res.json())[0];
}

const trip = await pickTrip();
console.log(`Wyjazd: ${trip.title} (${trip.id})`);
const row = await insertRequest(trip.id);
if (row) {
  console.log(`Dodano zgloszenie id=${row.id}, status=${row.status}`);
} else {
  console.log('Brak nowego wpisu (dedup).');
}
