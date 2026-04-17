import { createClient } from '@/lib/supabase/server';

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // UWAGA bezpieczeństwo: rola MUSI pochodzić wyłącznie z app_metadata
  // (zarządzane przez serwer/Supabase), nigdy z user_metadata (modyfikowalne przez klienta).
  const role = (user?.app_metadata?.role as string) ?? 'parent';
  return { supabase, user, role };
}
