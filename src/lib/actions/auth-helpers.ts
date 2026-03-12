import { createClient } from '@/lib/supabase/server';

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const role = (user?.app_metadata?.role as string) ?? 'parent';
  return { supabase, user, role };
}
