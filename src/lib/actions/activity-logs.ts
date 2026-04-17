'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';

export type ActivityActionType =
  | 'contract_accepted'
  | 'profile_updated'
  | 'registration_created'
  | 'registration_cancelled'
  | 'trip_email_sent'
  | 'payment_deleted';

/**
 * Loguje zdarzenie aplikacyjne. Wywoływany z server actions.
 * Używa admin client żeby ominąć RLS — nie blokuje głównego flow.
 */
export async function logActivity(
  userId: string,
  userEmail: string | undefined | null,
  actionType: ActivityActionType,
  details?: Record<string, unknown>,
) {
  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      user_email: userEmail ?? null,
      action_type: actionType,
      details: details ?? null,
    });
  } catch (err) {
    console.error('logActivity error:', err);
  }
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function getActivityLogs(days = 30) {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabaseAdmin = createAdminClient();
  const { data } = await supabaseAdmin
    .from('activity_logs')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  return data ?? [];
}

export async function getEmailLogs(days = 30) {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabaseAdmin = createAdminClient();
  const { data } = await supabaseAdmin
    .from('email_logs')
    .select('*')
    .gte('sent_at', since.toISOString())
    .order('sent_at', { ascending: false })
    .limit(500);

  return data ?? [];
}
