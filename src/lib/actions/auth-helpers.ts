import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// getUser() weryfikuje JWT po stronie Supabase Auth API (~200–400 ms sieci).
// Bez cache() każda akcja serwerowa na danej stronie (getMyChildren,
// getMessagesForParent, getDashboardData × dziecko, getPaymentsForParent…)
// odpalała ten sam round-trip osobno — kilka–kilkanaście razy na jeden render.
// cache() deduplikuje w obrębie JEDNEGO żądania renderu: getUser leci raz,
// klient Supabase tworzony jest raz. Reset następuje między żądaniami
// (kolejny render / mutacja = świeży cache), więc semantyka bezpieczeństwa
// (pełna weryfikacja getUser) zostaje bez zmian.
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // UWAGA bezpieczeństwo: rola MUSI pochodzić wyłącznie z app_metadata
  // (zarządzane przez serwer/Supabase), nigdy z user_metadata (modyfikowalne przez klienta).
  const role = (user?.app_metadata?.role as string) ?? 'parent';
  return { supabase, user, role };
});
