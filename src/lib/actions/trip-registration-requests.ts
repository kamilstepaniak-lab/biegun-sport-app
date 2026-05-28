'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { createExternalChild } from './external-children';
import { registerParticipantToTrip } from './registrations';

type Status = 'pending' | 'approved' | 'rejected';

export type TripRegistrationRequestRow = {
  id: string;
  trip_id: string;
  trip_title: string | null;
  child_first_name: string;
  child_last_name: string;
  child_birth_date: string;
  child_height_cm: number | null;
  parent_email: string;
  parent_phone: string | null;
  status: Status;
  submitted_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  created_participant_id: string | null;
};

export async function listTripRegistrationRequests(filter?: {
  status?: Status | 'all';
  tripId?: string;
  search?: string;
}): Promise<{ data?: TripRegistrationRequestRow[]; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  let q = admin
    .from('trip_registration_requests')
    .select(
      'id, trip_id, child_first_name, child_last_name, child_birth_date, child_height_cm, parent_email, parent_phone, status, submitted_at, processed_at, rejection_reason, created_participant_id, trips(title)'
    )
    .order('submitted_at', { ascending: false });

  if (filter?.status && filter.status !== 'all') q = q.eq('status', filter.status);
  if (filter?.tripId) q = q.eq('trip_id', filter.tripId);
  if (filter?.search && filter.search.trim()) {
    const s = `%${filter.search.trim()}%`;
    q = q.or(`child_first_name.ilike.${s},child_last_name.ilike.${s},parent_email.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };

  type Row = {
    id: string;
    trip_id: string;
    child_first_name: string;
    child_last_name: string;
    child_birth_date: string;
    child_height_cm: number | null;
    parent_email: string;
    parent_phone: string | null;
    status: Status;
    submitted_at: string;
    processed_at: string | null;
    rejection_reason: string | null;
    created_participant_id: string | null;
    trips: { title: string | null } | null;
  };

  const rows: TripRegistrationRequestRow[] = (data as unknown as Row[] | null ?? []).map((r) => ({
    id: r.id,
    trip_id: r.trip_id,
    trip_title: r.trips?.title ?? null,
    child_first_name: r.child_first_name,
    child_last_name: r.child_last_name,
    child_birth_date: r.child_birth_date,
    child_height_cm: r.child_height_cm,
    parent_email: r.parent_email,
    parent_phone: r.parent_phone,
    status: r.status,
    submitted_at: r.submitted_at,
    processed_at: r.processed_at,
    rejection_reason: r.rejection_reason,
    created_participant_id: r.created_participant_id,
  }));

  return { data: rows };
}

export async function countPendingRegistrationRequests(): Promise<number> {
  try {
    const { user, role } = await getAuthUser();
    if (!user || role !== 'admin') return 0;
    const admin = createAdminClient();
    const { count, error } = await admin
      .from('trip_registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) {
      // Migracja jeszcze nie odpalona na bazie — nie kraszuj layoutu.
      console.warn('countPendingRegistrationRequests:', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.warn('countPendingRegistrationRequests fatal:', e);
    return 0;
  }
}

export async function approveRegistrationRequest(requestId: string) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const { data: reqRow, error: reqErr } = await admin
    .from('trip_registration_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqErr || !reqRow) return { error: 'Nie znaleziono zgłoszenia' };
  if (reqRow.status !== 'pending') return { error: 'Zgłoszenie zostało już przetworzone' };

  // 1) Rodzic + dziecko (createExternalChild dba o magic link gdy konto nie istnieje
  //    i przypisuje dziecko do grupy "Bez kategorii" gdy nie podano group_id).
  const createRes = await createExternalChild({
    parent_email: reqRow.parent_email,
    parent_first_name: '',
    parent_last_name: '',
    parent_phone: reqRow.parent_phone ?? '',
    first_name: reqRow.child_first_name,
    last_name: reqRow.child_last_name,
    birth_date: reqRow.child_birth_date,
    height_cm: reqRow.child_height_cm ?? null,
    group_id: null,
  });

  if ('error' in createRes && createRes.error) {
    return { error: createRes.error };
  }
  if (!('data' in createRes) || !createRes.data) {
    return { error: 'Nie udało się utworzyć uczestnika' };
  }
  const participantId = createRes.data.id;

  // 2) Zapis na wyjazd jako admin (registerParticipantToTrip wysyła standardowy mail rejestracyjny).
  const regRes = await registerParticipantToTrip(reqRow.trip_id, participantId, 'admin');
  if ('error' in regRes && regRes.error) {
    return {
      error: `Uczestnik utworzony, ale zapis na wyjazd nie powiódł się: ${regRes.error}`,
    };
  }

  // 3) Update requesta
  const { error: updateErr } = await admin
    .from('trip_registration_requests')
    .update({
      status: 'approved',
      processed_at: new Date().toISOString(),
      processed_by: user.id,
      created_participant_id: participantId,
    })
    .eq('id', requestId);

  if (updateErr) {
    console.error('approveRegistrationRequest update error:', updateErr);
  }

  revalidatePath('/admin/registrations');
  revalidatePath('/admin/participants');
  revalidatePath('/admin/groups');
  return { success: true };
}

export async function rejectRegistrationRequest(
  requestId: string,
  reason: string | null
) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('trip_registration_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason?.trim() || null,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) return { error: error.message };
  revalidatePath('/admin/registrations');
  return { success: true };
}
