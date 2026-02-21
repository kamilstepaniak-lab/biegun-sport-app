'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/validations/auth';
import { sendWelcomeEmail } from '@/lib/email';

export async function login(formData: LoginInput) {
  const supabase = await createClient();

  // Walidacja
  const result = loginSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { email, password } = result.data;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message === 'Invalid login credentials') {
      return { error: 'Nieprawidłowy email lub hasło' };
    }
    return { error: error.message };
  }

  // Pobierz rolę użytkownika
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', email)
    .single();

  revalidatePath('/', 'layout');

  const redirectPath = profile?.role === 'admin' ? '/admin/groups' : '/parent/children';
  redirect(redirectPath);
}

export async function register(formData: RegisterInput) {
  const supabase = await createClient();

  // Walidacja
  const result = registerSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { email, password, firstName, lastName, phone } = result.data;

  // Rejestracja użytkownika
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      },
    },
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Ten email jest już zarejestrowany' };
    }
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'Nie udało się utworzyć konta' };
  }

  // Utwórz profil użytkownika
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: email,
      phone: phone,
      first_name: firstName,
      last_name: lastName,
      role: 'parent',
    });

  if (profileError) {
    console.error('Profile creation error:', profileError);
    // Profil może być utworzony przez trigger, więc ignorujemy błąd duplikatu
    if (!profileError.message.includes('duplicate')) {
      return { error: 'Nie udało się utworzyć profilu' };
    }
  }

  // Wyślij e-mail powitalny (nie blokujemy rejestracji jeśli się nie uda)
  sendWelcomeEmail(email, firstName).catch(console.error);

  revalidatePath('/', 'layout');
  redirect('/parent/children');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function resetPassword(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error('Reset password error:', error);
    return { error: 'Nie udało się wysłać emaila z linkiem do resetu hasła' };
  }

  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('Update password error:', error);
    if (error.message.includes('same_password')) {
      return { error: 'Nowe hasło musi być inne niż obecne' };
    }
    return { error: 'Nie udało się zmienić hasła. Spróbuj ponownie.' };
  }

  return { success: true };
}

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Serializuj do plain objects dla Client Components
  return profile ? JSON.parse(JSON.stringify(profile)) : null;
}
