'use server';

import { createAdminClient } from '@/lib/supabase/server';

const DEFAULT_PASSWORD = 'biegunsport';

export interface ParentAccountResult {
  email: string;
  firstName: string;
  lastName: string;
  status: 'created' | 'already_exists' | 'reset' | 'error';
  error?: string;
}

export async function resetParentPasswords(): Promise<{
  results: ParentAccountResult[];
  reset: number;
  errors: number;
}> {
  const supabaseAdmin = createAdminClient();

  // Pobierz wszystkich rodziców z tabeli profiles
  const { data: parents, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('role', 'parent');

  if (fetchError) {
    throw new Error(`Nie udało się pobrać listy rodziców: ${fetchError.message}`);
  }

  if (!parents || parents.length === 0) {
    return { results: [], reset: 0, errors: 0 };
  }

  const results: ParentAccountResult[] = [];
  let reset = 0;
  let errors = 0;

  for (const parent of parents) {
    if (!parent.email) {
      results.push({
        email: '(brak emaila)',
        firstName: parent.first_name || '',
        lastName: parent.last_name || '',
        status: 'error',
        error: 'Brak adresu email',
      });
      errors++;
      continue;
    }

    // Pobierz użytkownika z auth.users po emailu
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      results.push({
        email: parent.email,
        firstName: parent.first_name || '',
        lastName: parent.last_name || '',
        status: 'error',
        error: listError.message,
      });
      errors++;
      continue;
    }

    const authUser = listData.users.find(u => u.email === parent.email);

    if (!authUser) {
      // Konto nie istnieje — utwórz je
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: parent.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });
      if (createError) {
        results.push({
          email: parent.email,
          firstName: parent.first_name || '',
          lastName: parent.last_name || '',
          status: 'error',
          error: createError.message,
        });
        errors++;
      } else {
        results.push({
          email: parent.email,
          firstName: parent.first_name || '',
          lastName: parent.last_name || '',
          status: 'reset',
        });
        reset++;
      }
      continue;
    }

    // Konto istnieje — zaktualizuj hasło
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: DEFAULT_PASSWORD }
    );

    if (updateError) {
      results.push({
        email: parent.email,
        firstName: parent.first_name || '',
        lastName: parent.last_name || '',
        status: 'error',
        error: updateError.message,
      });
      errors++;
    } else {
      results.push({
        email: parent.email,
        firstName: parent.first_name || '',
        lastName: parent.last_name || '',
        status: 'reset',
      });
      reset++;
    }
  }

  return { results, reset, errors };
}

export async function createParentAccounts(): Promise<{
  results: ParentAccountResult[];
  created: number;
  alreadyExists: number;
  errors: number;
}> {
  const supabaseAdmin = createAdminClient();

  // Pobierz wszystkich rodziców z tabeli profiles
  const { data: parents, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('role', 'parent');

  if (fetchError) {
    throw new Error(`Nie udało się pobrać listy rodziców: ${fetchError.message}`);
  }

  if (!parents || parents.length === 0) {
    return { results: [], created: 0, alreadyExists: 0, errors: 0 };
  }

  const results: ParentAccountResult[] = [];
  let created = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const parent of parents) {
    if (!parent.email) {
      results.push({
        email: '(brak emaila)',
        firstName: parent.first_name || '',
        lastName: parent.last_name || '',
        status: 'error',
        error: 'Brak adresu email',
      });
      errors++;
      continue;
    }

    // Spróbuj utworzyć konto w Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: parent.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true, // od razu potwierdzone, bez emaila weryfikacyjnego
      user_metadata: {
        first_name: parent.first_name,
        last_name: parent.last_name,
      },
    });

    if (error) {
      // Jeśli użytkownik już istnieje — to OK
      if (error.message.includes('already been registered') || error.message.includes('already exists') || error.message.includes('User already registered')) {
        results.push({
          email: parent.email,
          firstName: parent.first_name || '',
          lastName: parent.last_name || '',
          status: 'already_exists',
        });
        alreadyExists++;
      } else {
        results.push({
          email: parent.email,
          firstName: parent.first_name || '',
          lastName: parent.last_name || '',
          status: 'error',
          error: error.message,
        });
        errors++;
      }
      continue;
    }

    // Zaktualizuj profil żeby ID było zgodne z nowym auth.users ID
    if (data.user && data.user.id !== parent.id) {
      const newId = data.user.id;
      const oldId = parent.id;

      // 1. Najpierw zaktualizuj parent_id w participants (dzieci)
      await supabaseAdmin
        .from('participants')
        .update({ parent_id: newId })
        .eq('parent_id', oldId);

      // 2. Wstaw nowy profil z nowym ID
      await supabaseAdmin.from('profiles').insert({
        id: newId,
        email: parent.email,
        first_name: parent.first_name,
        last_name: parent.last_name,
        role: 'parent',
      });

      // 3. Usuń stary profil
      await supabaseAdmin.from('profiles').delete().eq('id', oldId);
    }

    results.push({
      email: parent.email,
      firstName: parent.first_name || '',
      lastName: parent.last_name || '',
      status: 'created',
    });
    created++;
  }

  return { results, created, alreadyExists, errors };
}
