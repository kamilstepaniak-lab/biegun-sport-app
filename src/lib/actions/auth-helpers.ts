import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// getClaims() weryfikuje JWT i zwraca jego payload.
//   • Klucze ASYMMETRIC (ES256/RS256) włączone w Supabase → podpis sprawdzany
//     LOKALNIE (JWKS pobierany raz i cache'owany) — zero round-tripów do Auth API.
//   • Klucze SYMMETRIC (legacy HS256) → getClaims sam robi fallback na getUser()
//     po sieci. Czyli zanim włączysz asymmetric keys, działa jak wcześniej;
//     po włączeniu automatycznie przyspiesza, bez zmian w kodzie.
//
// Dodatkowo cache() deduplikuje w obrębie jednego renderu (wszystkie akcje
// serwerowe danej strony dzielą jedno wywołanie).
//
// Bezpieczeństwo: rola WYŁĄCZNIE z app_metadata (server-managed), nigdy z
// user_metadata (modyfikowalne przez klienta). Tożsamość bierzemy z
// zweryfikowanego payloadu JWT (claims.sub).
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const user = claims
    ? {
        id: claims.sub,
        email: claims.email,
        app_metadata: claims.app_metadata ?? {},
        user_metadata: claims.user_metadata ?? {},
      }
    : null;

  const role = (user?.app_metadata?.role as string) ?? 'parent';
  return { supabase, user, role };
});
