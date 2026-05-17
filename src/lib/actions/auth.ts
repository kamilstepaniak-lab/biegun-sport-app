'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/validations/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { getLoginBlockMinutes, recordLoginFailure, clearLoginFailures } from '@/lib/rate-limit';

async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function login(formData: LoginInput) {
  const supabase = await createClient();

  // Walidacja
  const result = loginSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { email, password } = result.data;

  // Ochrona przed brute-force — blokada po zbyt wielu nieudanych próbach
  const ip = await getClientIp();
  const blockMinutes = getLoginBlockMinutes(ip);
  if (blockMinutes > 0) {
    return {
      error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${blockMinutes} min.`,
    };
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    recordLoginFailure(ip);
    if (error.message === 'Invalid login credentials') {
      return { error: 'Nieprawidłowy email lub hasło' };
    }
    return { error: error.message };
  }

  clearLoginFailures(ip);
  revalidatePath('/', 'layout');

  const role = signInData?.user?.app_metadata?.role as string | undefined;
  const redirectPath = role === 'admin' ? '/admin/groups' : '/parent/children';
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

  // Zapis zgody RODO — admin client, bo gdy włączone jest potwierdzanie e-mail
  // konto nie ma jeszcze sesji i RLS zablokowałoby zapis przez klienta usera.
  const adminClient = createAdminClient();
  const { error: consentError } = await adminClient
    .from('profiles')
    .update({ rodo_accepted_at: new Date().toISOString() })
    .eq('id', authData.user.id);
  if (consentError) {
    console.error('RODO consent save error:', consentError);
  }

  // Jeśli sesja jest null — Supabase czeka na potwierdzenie emaila (Confirm email: ON)
  // W tym przypadku Supabase sam wysyła maila z linkiem — nie wysyłamy powitalnego żeby nie było 2 maili
  if (!authData.session) {
    return { emailConfirmationRequired: true };
  }

  // Confirm email: OFF — użytkownik od razu zalogowany, wyślij powitalny
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

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();

  const callbackUrl = new URL(
    '/api/auth/callback',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  );
  if (next) callbackUrl.searchParams.set('next', next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return { error: 'Nie udało się zalogować przez Google' };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function sendMagicLink(email: string) {
  const supabase = await createClient();

  const callbackUrl = new URL(
    '/api/auth/callback',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: false, // nie tworzy nowych kont - tylko istniejące
    },
  });

  if (error) {
    if (error.message.includes('not found') || error.message.includes('User not found')) {
      return { error: 'Nie znaleziono konta z tym adresem email' };
    }
    return { error: 'Nie udało się wysłać linku. Spróbuj ponownie.' };
  }

  return { success: true };
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
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Hasło musi mieć minimum 8 znaków' };
  }

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

// cache() deduplikuje wywołania w ramach jednego renderowania —
// layout + page + komponenty mogą wołać getUserProfile() bez dodatkowych zapytań
// getSession() czyta JWT z ciasteczka lokalnie (~0ms) — middleware już zweryfikował sesję
export const getUserProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile ?? null;
});
