'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { profileSchema, type ProfileInput } from '@/lib/validations/profile';
import type { Profile } from '@/types';
import { logActivity } from './activity-logs';

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

  const { first_name, last_name, phone, secondary_email, secondary_phone,
          address_street, address_zip, address_city, pesel } = result.data;

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name,
      last_name,
      phone,
      secondary_email: secondary_email || null,
      secondary_phone: secondary_phone || null,
      address_street: address_street || null,
      address_zip: address_zip || null,
      address_city: address_city || null,
      pesel: pesel || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('Profile update error:', error);
    return { error: 'Nie udało się zaktualizować profilu' };
  }

  // Activity log
  const updatedFields = Object.keys(result.data).filter(
    (k) => result.data[k as keyof typeof result.data] !== undefined
  );
  logActivity(user.id, user.email, 'profile_updated', { fields: updatedFields }).catch(console.error);

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

export async function changePassword(
  newPassword: string
): Promise<{ error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Hasło musi mieć co najmniej 8 znaków' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: 'Nie udało się zmienić hasła. Spróbuj ponownie.' };

  return {};
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
