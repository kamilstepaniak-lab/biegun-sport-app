'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

const STORAGE_KEY = 'biegun_selected_child';
const PROTECTED_PATHS = ['/parent/trips', '/parent/payments', '/parent/calendar'];

function loadFromStorage(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.id && parsed.name) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveChildToStorage(id: string, name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
  } catch { /* ignore */ }
}

export function clearChildFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Komponent montowany w layoucie rodzica.
 * Gdy user nawiguje do strony wymagającej dziecka bez ?child= w URL,
 * automatycznie dodaje ?child= z localStorage (jeśli jest zapisane).
 * Gdy user jest na stronie z ?child= — zapisuje to do localStorage.
 */
export function ChildUrlSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const isProtectedPath = PROTECTED_PATHS.some(p => pathname.startsWith(p));
    if (!isProtectedPath) return;

    const childInUrl = searchParams.get('child');
    const childNameInUrl = searchParams.get('childName');

    if (childInUrl && childNameInUrl) {
      // Mamy dziecko w URL — zapisz do localStorage
      saveChildToStorage(childInUrl, childNameInUrl);
      return;
    }

    if (!childInUrl) {
      // Brak dziecka w URL — sprawdź localStorage
      const stored = loadFromStorage();
      if (stored) {
        // Dodaj ?child= do URL bez przeładowania strony
        const params = new URLSearchParams(searchParams.toString());
        params.set('child', stored.id);
        params.set('childName', stored.name);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, [pathname, searchParams, router]);

  return null;
}
