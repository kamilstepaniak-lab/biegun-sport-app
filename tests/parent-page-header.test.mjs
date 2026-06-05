import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('parent pages use the dedicated parent page header', () => {
  const pages = [
    'src/app/(protected)/parent/trips/parent-trips-shell.tsx',
    'src/app/(protected)/parent/payments/page.tsx',
    'src/app/(protected)/parent/calendar/page.tsx',
    'src/app/(protected)/parent/contracts/page.tsx',
    'src/app/(protected)/parent/children/page.tsx',
    'src/app/(protected)/parent/messages/page.tsx',
    'src/app/(protected)/parent/profile/page.tsx',
    'src/app/(protected)/parent/owu/page.tsx',
    'src/app/(protected)/parent/children/add/page.tsx',
    'src/app/(protected)/parent/children/[id]/page.tsx',
  ];

  for (const pagePath of pages) {
    const page = read(pagePath);
    assert.match(page, /ParentPageHeader/);
    assert.doesNotMatch(page, /<PageHeader/);
  }
});

test('child guard can defer child selection UI to the parent page header', () => {
  const childGuard = read('src/components/parent/child-guard.tsx');

  assert.match(childGuard, /showSelector\?: boolean/);
  assert.match(childGuard, /showSelector = true/);

  const tripsPage = read('src/app/(protected)/parent/trips/parent-trips-shell.tsx');
  assert.match(tripsPage, /showSelector=\{false\}/);
});
