'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_BANK_ACCOUNT_PLN, DEFAULT_BANK_ACCOUNT_EUR } from '@/lib/constants/bank-accounts';
import { getAuthUser } from './auth-helpers';

export interface BankAccounts {
  bank_account_pln: string;
  bank_account_eur: string;
}

// Wspólne konto bankowe dla całej aplikacji.
// Źródło prawdy: tabela app_settings. Fallback: zmienne środowiskowe.
export async function getBankAccounts(): Promise<BankAccounts> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['bank_account_pln', 'bank_account_eur']);

  const map = new Map((data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]));

  return {
    bank_account_pln: map.get('bank_account_pln') || DEFAULT_BANK_ACCOUNT_PLN,
    bank_account_eur: map.get('bank_account_eur') || DEFAULT_BANK_ACCOUNT_EUR,
  };
}

export async function updateBankAccounts(input: BankAccounts) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin.from('app_settings').upsert([
    { key: 'bank_account_pln', value: input.bank_account_pln.trim(), updated_at: now },
    { key: 'bank_account_eur', value: input.bank_account_eur.trim(), updated_at: now },
  ]);

  if (error) {
    console.error('updateBankAccounts error:', error);
    return { error: 'Nie udało się zapisać kont bankowych' };
  }

  revalidatePath('/admin/settings');
  revalidatePath('/parent/payments');
  return { success: true };
}
