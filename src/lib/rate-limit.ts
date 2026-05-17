// ── Prosty limiter prób logowania (ochrona przed brute-force) ───────────────
// Stan trzymany w pamięci procesu. W środowisku serverless jest per-instancja
// (nie współdzielony między instancjami) — dla docelowej skali (200 klientów,
// niski ruch) to wystarczające zabezpieczenie, działające w parze z wbudowanym
// rate-limitingiem Supabase Auth. Przy znacznie większym ruchu warto przenieść
// licznik do współdzielonego magazynu (np. Vercel KV / Upstash Redis).

interface FailureEntry {
  count: number;
  firstAt: number;
}

const WINDOW_MS = 10 * 60 * 1000; // 10 minut
const MAX_FAILURES = 8; // po tylu nieudanych próbach — blokada na resztę okna

const failures = new Map<string, FailureEntry>();

/**
 * Zwraca liczbę minut blokady (0 = brak blokady).
 */
export function getLoginBlockMinutes(ip: string): number {
  const entry = failures.get(ip);
  if (!entry) return 0;

  const elapsed = Date.now() - entry.firstAt;
  if (elapsed > WINDOW_MS) {
    failures.delete(ip);
    return 0;
  }
  if (entry.count >= MAX_FAILURES) {
    return Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 60000));
  }
  return 0;
}

/**
 * Odnotowuje nieudaną próbę logowania z danego IP.
 */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = failures.get(ip);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    failures.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count++;
  }

  // Okazjonalne sprzątanie wygasłych wpisów
  if (failures.size > 5000) {
    for (const [key, value] of failures) {
      if (now - value.firstAt > WINDOW_MS) failures.delete(key);
    }
  }
}

/**
 * Czyści licznik po udanym logowaniu.
 */
export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}
