'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { profileSchema, type ProfileInput } from '@/lib/validations/profile';
import type { Profile } from '@/types';

export async function updateProfile(formData: ProfileInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Walidacja
  const result = profileSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { first_name, last_name, phone, secondary_email, secondary_phone } = result.data;

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name,
      last_name,
      phone,
      secondary_email: secondary_email || null,
      secondary_phone: secondary_phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('Profile update error:', error);
    return { error: 'Nie udało się zaktualizować profilu' };
  }

  revalidatePath('/parent/profile');
  revalidatePath('/admin/settings');
  return { success: true };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }

  return profile;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }

  return profile;
}
