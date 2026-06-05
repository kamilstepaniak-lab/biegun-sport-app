import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('parent pages use the dedicated parent page header', () => {
  const pages = [
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

test('parent trips has its own full-width mountain header layout', () => {
  const tripsShell = read('src/app/(protected)/parent/trips/parent-trips-shell.tsx');
  const globals = read('src/app/globals.css');
  const mountains = read('public/parent-hero-mountains.svg');

  assert.doesNotMatch(tripsShell, /ParentPageHeader/);
  assert.match(tripsShell, /parent-trips-hero/);
  assert.match(globals, /:not\(\.parent-trips-hero\)/);
  assert.match(tripsShell, /parent-hero-mountains\.svg/);
  assert.match(tripsShell, /lg:min-h-\[285px\]/);
  assert.match(tripsShell, /bg-gradient-to-b from-transparent via-\[#f8fbff\]\/80 to-\[#f8fafc\]/);
  assert.doesNotMatch(tripsShell, /showAllOption=\{false\}/);
  assert.match(tripsShell, /htmlFor="parent-trip-search"/);
  assert.match(tripsShell, /Wpisz nazwę wyjazdu/);
  assert.doesNotMatch(tripsShell, /placeholder=/);
  assert.doesNotMatch(tripsShell, /bg-blue-600 text-white/);
  assert.match(mountains, /viewBox="0 0 1500 420"/);
  assert.match(mountains, /id="peakLight"/);
  assert.doesNotMatch(mountains, /V36Z/);
});
