'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { profileSchema, type ProfileInput } from '@/lib/validations/profile';
import type { Profile } from '@/types';
import { logActivity } from './activity-logs';

export async function updateProfile(formData: ProfileInput) {
  const { supabase, user } = await getAuthUser();
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
  const { supabase, user } = await getAuthUser();
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
  newPassword: string,
  currentPassword?: string,
): Promise<{ error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Hasło musi mieć co najmniej 8 znaków' };
  }
  if (!currentPassword) {
    return { error: 'Podaj aktualne hasło, aby je zmienić' };
  }

  const { supabase, user } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (!user.email) return { error: 'Brak adresu e-mail w koncie' };

  // Weryfikacja aktualnego hasła — próba ponownego zalogowania
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: 'Aktualne hasło jest nieprawidłowe' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: 'Nie udało się zmienić hasła. Spróbuj ponownie.' };

  logActivity(user.id, user.email, 'profile_updated', { fields: ['password'] }).catch(console.error);

  return {};
}

export async function deleteMyAccount(): Promise<{ error?: string }> {
  const { user } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const supabaseAdmin = createAdminClient();

  // 1. Pobierz dzieci rodzica
  const { data: children } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('parent_id', user.id);

  const childIds = children?.map((c: { id: string }) => c.id) || [];

  if (childIds.length > 0) {
    // 2. Pobierz rejestracje dzieci
    const { data: registrations } = await supabaseAdmin
      .from('trip_registrations')
      .select('id')
      .in('participant_id', childIds);

    const regIds = registrations?.map((r: { id: string }) => r.id) || [];

    if (regIds.length > 0) {
      // 3. Usuń płatności i transakcje
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .in('registration_id', regIds);

      const paymentIds = payments?.map((p: { id: string }) => p.id) || [];

      if (paymentIds.length > 0) {
        await supabaseAdmin.from('payment_transactions').delete().in('payment_id', paymentIds);
        await supabaseAdmin.from('payments').delete().in('registration_id', regIds);
      }

      // 4. Usuń rejestracje
      await supabaseAdmin.from('trip_registrations').delete().in('participant_id', childIds);
    }

    // 5. Usuń dzieci
    await supabaseAdmin.from('participants').delete().eq('parent_id', user.id);
  }

  // 6. Usuń profil
  await supabaseAdmin.from('profiles').delete().eq('id', user.id);

  // 7. Usuń konto auth
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { error: 'Nie udało się usunąć konta. Skontaktuj się z administratorem.' };
  }

  return {};
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { supabase, user, role } = await getAuthUser();
  if (!user) return null;

  // Rodzic może pobrać tylko swój profil
  if (role !== 'admin' && user.id !== id) return null;

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
