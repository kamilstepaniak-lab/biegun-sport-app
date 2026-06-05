import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('parent children greeting uses parent first_name from profile', () => {
  const page = read('src/app/(protected)/parent/children/page.tsx');

  assert.match(page, /profile\?\.first_name\?\.trim\(\)/);
  assert.doesNotMatch(page, /profile\?\.full_name/);
});
