'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { logActivity } from './activity-logs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface CreateTokenParams {
  tripId: string;
  parentEmail: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentPhone?: string;
  participantId?: string;
  participantName?: string; // jeśli uczestnik jeszcze nie istnieje w bazie
  action: 'confirm' | 'decline' | 'register';
  expiresInDays?: number;
}

/**
 * Tworzy token potwierdzający i zwraca URL do wstawienia w email.
 * Używaj w akcjach admina przy wysyłaniu emaili o wyjeździe.
 */
export async function createRegistrationToken(params: CreateTokenParams): Promise<{
  token?: string;
  url?: string;
  error?: string;
}> {
  const { user, role } = await getAuthUser();
  const admin = createAdminClient();

  if (!user) return { error: 'Brak autoryzacji' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays || 7));

  const { data: tokenRecord, error } = await admin
    .from('registration_tokens')
    .insert({
      parent_email: params.parentEmail,
      parent_first_name: params.parentFirstName,
      parent_last_name: params.parentLastName,
      parent_phone: params.parentPhone,
      participant_id: params.participantId,
      participant_name: params.participantName,
      trip_id: params.tripId,
      action: params.action,
      expires_at: expiresAt.toISOString(),
      sent_by: user.id,
    })
    .select('token')
    .single();

  if (error || !tokenRecord) {
    console.error('Błąd tworzenia tokenu:', error);
    return { error: 'Nie udało się wygenerować linku' };
  }

  const url = `${APP_URL}/confirm/${tokenRecord.token}`;

  return { token: tokenRecord.token, url };
}

/**
 * Pobiera wszystkie tokeny dla danego wyjazdu (panel admina).
 */
export async function getTripTokens(tripId: string) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Brak autoryzacji' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('registration_tokens')
    .select('id, token, parent_email, participant_name, participant_id, action, status, created_at, expires_at, used_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) return { error: 'Błąd pobierania tokenów' };

  return { tokens: data };
}

/**
 * Unieważnia token.
 */
export async function revokeToken(tokenId: string) {
  const { user, role } = await getAuthUser();
  const admin = createAdminClient();

  if (!user) return { error: 'Brak autoryzacji' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  await admin
    .from('registration_tokens')
    .update({ status: 'expired' })
    .eq('id', tokenId);

  return { success: true };
}

/**
 * Generuje tokeny dla wszystkich rodziców w wyjeździe i zwraca tablicę {email, url}.
 * Używane przy masowej wysyłce - admin wysyła 1 email do każdego rodzica z linkiem confirm.
 */
export async function createTokensForTripParents(tripId: string): Promise<{
  tokens?: Array<{ email: string; participantName: string; url: string }>;
  error?: string;
}> {
  const { user, role } = await getAuthUser();
  const admin = createAdminClient();

  if (!user) return { error: 'Brak autoryzacji' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  // Pobierz wszystkich uczestników w wyjeździe z danymi rodziców
  const { data: registrations, error } = await admin
    .from('trip_registrations')
    .select(`
      id,
      participant_id,
      participants(
        id, first_name, last_name,
        profiles!participants_parent_id_fkey(id, email, first_name, last_name, phone)
      )
    `)
    .eq('trip_id', tripId)
    .eq('status', 'active');

  if (error || !registrations) {
    return { error: 'Błąd pobierania uczestników' };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const results: Array<{ email: string; participantName: string; url: string }> = [];

  for (const reg of registrations) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participant = reg.participants as any;
    if (!participant) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = participant.profiles as any;
    if (!parent?.email) continue;

    const { data: tokenRecord } = await admin
      .from('registration_tokens')
      .insert({
        parent_email: parent.email,
        parent_first_name: parent.first_name,
        parent_last_name: parent.last_name,
        parent_phone: parent.phone,
        participant_id: participant.id,
        trip_id: tripId,
        action: 'confirm',
        expires_at: expiresAt.toISOString(),
        sent_by: user.id,
      })
      .select('token')
      .single();

    if (tokenRecord) {
      results.push({
        email: parent.email,
        participantName: `${participant.first_name} ${participant.last_name}`,
        url: `${APP_URL}/confirm/${tokenRecord.token}`,
      });
    }
  }

  return { tokens: results };
}
