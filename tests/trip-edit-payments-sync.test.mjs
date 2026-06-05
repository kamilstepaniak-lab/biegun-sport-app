import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const plainOpen = source.indexOf(') {', start);
  const typedOpen = source.indexOf('> {', start);
  const candidates = [plainOpen, typedOpen].filter((idx) => idx !== -1);
  const open = Math.min(...candidates) + 2;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`${name} body not closed`);
}

test('trip pricing edit refreshes payments cache and payment pages', () => {
  const trips = read('src/lib/actions/trips.ts');
  const updateTrip = functionBody(trips, 'updateTrip');

  assert.match(updateTrip, /revalidateTag\('payments'\)/);
  assert.match(updateTrip, /revalidatePath\('\/admin\/payments'\)/);
  assert.match(updateTrip, /revalidatePath\('\/parent\/payments'\)/);
});

test('trip payment sync propagates Supabase write failures', () => {
  const trips = read('src/lib/actions/trips.ts');
  const sync = functionBody(trips, 'syncTripPaymentsAfterPricingChange');

  assert.match(sync, /return\s+\{\s*error:/);
  assert.match(sync, /updatePaymentError|insertPaymentError|cancelPaymentError/);
});
