import { createClient } from '@/lib/supabase/server';

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string) ?? (user?.user_metadata?.role as string) ?? 'parent';
  return { supabase, user, role };
}
