'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import type { TripRegistration, RegistrationWithDetails } from '@/types';
import { sendRegistrationConfirmationEmail, type TripEmailData, type PaymentLineItem } from '@/lib/email';
import { logPaymentChange } from './payment-history';
import { logActivity } from './activity-logs';

export async function registerParticipantToTrip(
  tripId: string,
  participantId: string,
  registrationType: 'parent' | 'admin' = 'parent'
) {
  const { supabase, user, role } = await getAuthUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź czy uczestnik istnieje i pobierz jego dane
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select(`
      *,
      participant_groups (group_id)
    `)
    .eq('id', participantId)
    .single();

  if (participantError || !participant) {
    return { error: 'Nie znaleziono uczestnika' };
  }

  const isAdmin = role === 'admin';

  // Rodzic może zapisywać tylko swoje dzieci
  if (!isAdmin && participant.parent_id !== user.id) {
    return { error: 'Nie możesz zapisać tego dziecka' };
  }

  // Pobierz grupy wyjazdu
  const { data: tripGroups } = await supabase
    .from('trip_groups')
    .select('group_id')
    .eq('trip_id', tripId);

  const tripGroupIds = tripGroups?.map((tg) => tg.group_id) || [];
  const participantGroupId = participant.participant_groups?.[0]?.group_id;

  // Sprawdź czy dziecko jest w odpowiedniej grupie (dla rodzica)
  const isOutsideGroup = participantGroupId
    ? !tripGroupIds.includes(participantGroupId)
    : true;

  if (!isAdmin && isOutsideGroup) {
    return { error: 'Dziecko nie jest przypisane do grupy dla tego wyjazdu' };
  }

  // Sprawdź czy już nie jest zapisany
  const { data: existingRegistration } = await supabase
    .from('trip_registrations')
    .select('id')
    .eq('trip_id', tripId)
    .eq('participant_id', participantId)
    .single();

  if (existingRegistration) {
    return { error: 'Uczestnik jest już zapisany na ten wyjazd' };
  }

  // Utwórz rejestrację
  const { data: registration, error: regError } = await supabase
    .from('trip_registrations')
    .insert({
      trip_id: tripId,
      participant_id: participantId,
      registered_by: user.id,
      registration_type: registrationType,
      is_outside_group: isOutsideGroup,
      status: 'active',
    })
    .select()
    .single();

  if (regError) {
    console.error('Registration error:', regError);
    return { error: 'Nie udało się zapisać na wyjazd' };
  }

  // Płatności są tworzone dopiero gdy rodzic wybierze zieloną opcję
  // (Stop 1 / Stop 2 / Własny transport) w updateParticipationStatusByParent.
  // Tutaj tworzymy tylko rejestrację bez płatności.
  const emailPaymentLines: PaymentLineItem[] = [];

  // Wyślij e-mail potwierdzający zapis
  try {
    const { data: tripData } = await supabase
      .from('trips')
      .select('title, description, location, departure_datetime, departure_location, departure_stop2_datetime, departure_stop2_location, return_datetime, return_location, return_stop2_datetime, return_stop2_location, bank_account_pln, bank_account_eur')
      .eq('id', tripId)
      .single();

    const { data: parentData } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', participant.parent_id)
      .single();

    if (tripData && parentData?.email) {
      const childName = `${participant.first_name} ${participant.last_name}`;
      sendRegistrationConfirmationEmail(
        parentData.email,
        parentData.first_name || '',
        childName,
        tripData as TripEmailData,
        emailPaymentLines,
        tripId,
      ).catch(console.error);
    }
  } catch {
    // e-mail nie blokuje zapisu
  }

  // Activity log
  try {
    const { data: tripInfo } = await supabase.from('trips').select('title').eq('id', tripId).single();
    const childName = `${participant.first_name} ${participant.last_name}`;
    logActivity(user.id, user.email, 'registration_created', {
      participantName: childName,
      tripTitle: tripInfo?.title,
      tripId,
      registrationId: registration.id,
    }).catch(console.error);
  } catch {
    // log nie blokuje głównego flow
  }

  revalidatePath('/parent/trips');
  revalidatePath('/parent/calendar');
  revalidatePath('/parent/payments');
  revalidatePath(`/admin/trips/${tripId}/registrations`);
  revalidatePath(`/admin/trips/${tripId}/payments`);

  return { success: true, data: registration };
}

export async function cancelRegistration(registrationId: string) {
  const { supabase, user, role } = await getAuthUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  if (role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  const { error } = await supabase
    .from('trip_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId);

  if (error) {
    return { error: 'Nie udało się anulować zapisu' };
  }

  // Pobierz płatności do audit logu, zanim je anulujesz
  const { data: paymentsToCancel } = await supabase
    .from('payments')
    .select('id, status, amount_paid')
    .eq('registration_id', registrationId)
    .neq('status', 'cancelled');

  // Anuluj płatności
  await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('registration_id', registrationId);

  // Audit log dla każdej anulowanej płatności
  if (paymentsToCancel && paymentsToCancel.length > 0) {
    for (const p of paymentsToCancel) {
      logPaymentChange({
        paymentId: p.id,
        userId: user.id,
        oldStatus: p.status,
        newStatus: 'cancelled',
        oldAmountPaid: p.amount_paid || 0,
        newAmountPaid: p.amount_paid || 0,
        action: 'cancelled',
        note: 'Anulowanie zapisu na wyjazd',
      }).catch(console.error);
    }
  }

  revalidatePath('/admin/trips');
  revalidatePath('/admin/payments');

  return { success: true };
}

export async function getTripRegistrations(tripId: string): Promise<RegistrationWithDetails[]> {
  const supabase = await createClient();

  const { data: registrations, error } = await supabase
    .from('trip_registrations')
    .select(`
      *,
      participant:participants (
        *,
        parent:profiles!parent_id (*)
      ),
      trip:trips (*),
      payments (*)
    `)
    .eq('trip_id', tripId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Registrations fetch error:', error);
    return [];
  }

  return registrations as RegistrationWithDetails[];
}

export async function getMyRegistrations(): Promise<RegistrationWithDetails[]> {
  const { supabase, user } = await getAuthUser();
  if (!user) return [];

  // Pobierz dzieci użytkownika
  const { data: children } = await supabase
    .from('participants')
    .select('id')
    .eq('parent_id', user.id);

  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  const { data: registrations, error } = await supabase
    .from('trip_registrations')
    .select(`
      *,
      participant:participants (
        *,
        parent:profiles!parent_id (*)
      ),
      trip:trips (*),
      payments (*)
    `)
    .in('participant_id', childIds)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Registrations fetch error:', error);
    return [];
  }

  return registrations as RegistrationWithDetails[];
}
