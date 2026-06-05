import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('widget collects organizer notes and checks trip status before submit', () => {
  const widget = read('public/embed/widget.js');

  assert.match(widget, /textarea/i);
  assert.match(widget, /organizer_notes/);
  assert.match(widget, /\/api\/public\/trips\//);
});

test('public registration endpoints accept organizer notes', () => {
  const publicPost = read('src/app/api/public/trip-registrations/route.ts');
  const widgetPost = read('src/app/api/public/trip-registrations-widget/route.ts');

  assert.match(publicPost, /organizer_notes/);
  assert.match(widgetPost, /organizer_notes/);
});

test('public trip status endpoint exists', () => {
  assert.equal(
    existsSync(new URL('src/app/api/public/trips/[id]/route.ts', root)),
    true,
  );
});
