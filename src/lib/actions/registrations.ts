'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { TripRegistration, RegistrationWithDetails } from '@/types';
import { sendRegistrationConfirmationEmail } from '@/lib/email';

export async function registerParticipantToTrip(
  tripId: string,
  participantId: string,
  registrationType: 'parent' | 'admin' = 'parent'
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
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

  // Sprawdź uprawnienia
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

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

  // Pobierz szablony płatności
  const { data: paymentTemplates } = await supabase
    .from('trip_payment_templates')
    .select('*')
    .eq('trip_id', tripId);

  if (paymentTemplates && paymentTemplates.length > 0) {
    const birthYear = new Date(participant.birth_date).getFullYear();
    const paymentsToCreate = [];

    for (const template of paymentTemplates) {
      if (template.payment_type === 'installment') {
        paymentsToCreate.push({
          registration_id: registration.id,
          template_id: template.id,
          payment_type: 'installment',
          installment_number: template.installment_number,
          original_amount: template.amount,
          amount: template.amount,
          currency: template.currency,
          due_date: template.due_date,
          status: 'pending',
        });

        // Jeśli rata 1 ma dołączony karnet
        if (template.is_first_installment && template.includes_season_pass) {
          const seasonPass = paymentTemplates.find(
            (t) =>
              t.payment_type === 'season_pass' &&
              t.birth_year_from &&
              t.birth_year_to &&
              t.birth_year_from <= birthYear &&
              t.birth_year_to >= birthYear
          );

          if (seasonPass) {
            paymentsToCreate.push({
              registration_id: registration.id,
              template_id: seasonPass.id,
              payment_type: 'season_pass',
              installment_number: null,
              original_amount: seasonPass.amount,
              amount: seasonPass.amount,
              currency: seasonPass.currency,
              due_date: template.due_date,
              status: 'pending',
            });
          }
        }
      }
    }

    if (paymentsToCreate.length > 0) {
      const supabaseAdmin = createAdminClient();
      const { error: paymentsError } = await supabaseAdmin.from('payments').insert(paymentsToCreate);
      if (paymentsError) {
        console.error('Payments insert error:', paymentsError);
      }
    }
  }

  // Wyślij e-mail potwierdzający zapis
  try {
    const { data: tripData } = await supabase
      .from('trips')
      .select('title, departure_datetime, location')
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
        tripData.title,
        tripData.departure_datetime,
        tripData.location || '',
      ).catch(console.error);
    }
  } catch {
    // e-mail nie blokuje zapisu
  }

  revalidatePath('/parent/trips');
  revalidatePath('/parent/payments');
  revalidatePath(`/admin/trips/${tripId}/registrations`);
  revalidatePath(`/admin/trips/${tripId}/payments`);

  return { success: true, data: registration };
}

export async function cancelRegistration(registrationId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  const { error } = await supabase
    .from('trip_registrations')
    .update({ status: 'cancelled' })
    .eq('id', registrationId);

  if (error) {
    return { error: 'Nie udało się anulować zapisu' };
  }

  // Anuluj też płatności
  await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('registration_id', registrationId);

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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
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
