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

test('all parent headers share one full-width mountain layout', () => {
  const header = read('src/components/parent/parent-page-header.tsx');
  const tripsShell = read('src/app/(protected)/parent/trips/parent-trips-shell.tsx');
  const globals = read('src/app/globals.css');
  const mountains = read('public/parent-hero-mountains.svg');

  // Wspólny komponent jest źródłem wyglądu gór i jest pełnoszerokościowy.
  assert.match(header, /parent-page-hero/);
  assert.match(header, /parent-hero-mountains\.svg/);
  assert.match(header, /bg-gradient-to-b from-transparent via-\[#f8fbff\]\/80 to-\[#f8fafc\]/);
  assert.match(header, /tools\?: React\.ReactNode/);
  assert.match(header, /hideIcon\?: boolean/);
  assert.match(globals, /:not\(\.parent-page-hero\)/);
  assert.doesNotMatch(header, /bg-blue-600 text-white/);

  // Wyjazdy korzystają ze wspólnego nagłówka i wpinają wyszukiwarkę jako narzędzie.
  assert.match(tripsShell, /ParentPageHeader/);
  assert.match(tripsShell, /hideIcon/);
  assert.match(tripsShell, /rounded-none border-0/);
  assert.match(tripsShell, /htmlFor="parent-trip-search"/);
  assert.match(tripsShell, /Wpisz nazwę wyjazdu/);
  assert.match(tripsShell, /className="h-12/);
  assert.doesNotMatch(tripsShell, /placeholder=/);

  assert.match(mountains, /viewBox="0 0 1500 420"/);
  assert.match(mountains, /id="peakLight"/);
  assert.doesNotMatch(mountains, /V36Z/);
});
