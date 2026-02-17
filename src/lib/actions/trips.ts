'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createPaymentsForRegistration } from './payments';
import type {
  Trip,
  TripWithGroups,
  TripWithPaymentTemplates,
  TripStatus,
  CreateTripInput,
  CreatePaymentTemplateInput,
  Group,
} from '@/types';

export async function getTrips(): Promise<TripWithPaymentTemplates[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Admin widzi wszystkie, rodzic tylko published
  let query = supabase
    .from('trips')
    .select(`
      *,
      trip_groups (
        group:groups (*)
      ),
      payment_templates:trip_payment_templates (*)
    `)
    .order('departure_datetime', { ascending: true });

  if (profile?.role !== 'admin') {
    query = query.eq('status', 'published');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Trips fetch error:', error);
    return [];
  }

  const result = trips.map((t: Trip & { trip_groups: { group: Group }[]; payment_templates: unknown[] }) => ({
    ...t,
    groups: t.trip_groups?.map((tg) => tg.group) || [],
    payment_templates: t.payment_templates || [],
  }));

  return JSON.parse(JSON.stringify(result)) as TripWithPaymentTemplates[];
}

export async function getTrip(id: string): Promise<TripWithPaymentTemplates | null> {
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_groups (
        group:groups (*)
      ),
      payment_templates:trip_payment_templates (*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Trip fetch error:', error);
    return null;
  }

  const result = {
    ...trip,
    groups: trip.trip_groups?.map((tg: { group: Group }) => tg.group) || [],
  };

  // Serializuj do plain objects dla Client Components
  return JSON.parse(JSON.stringify(result)) as TripWithPaymentTemplates;
}

export async function getAvailableTripsForParent(parentId: string): Promise<TripWithGroups[]> {
  const supabase = await createClient();

  // 1. Pobierz grupy dzieci rodzica
  const { data: childrenGroups, error: childrenError } = await supabase
    .from('participants')
    .select(`
      id,
      first_name,
      participant_groups (group_id)
    `)
    .eq('parent_id', parentId);

  console.log('Parent ID:', parentId);
  console.log('Children groups data:', JSON.stringify(childrenGroups, null, 2));
  console.log('Children error:', childrenError);

  if (!childrenGroups || childrenGroups.length === 0) return [];

  const groupIds = childrenGroups
    .flatMap((c: { participant_groups: { group_id: string }[] | { group_id: string } | null }) => {
      if (!c.participant_groups) return [];
      if (Array.isArray(c.participant_groups)) {
        return c.participant_groups.map((pg) => pg.group_id);
      }
      return [c.participant_groups.group_id];
    })
    .filter(Boolean);

  console.log('Group IDs:', groupIds);

  if (groupIds.length === 0) return [];

  // 2. Pobierz wyjazdy dla tych grup
  const { data: tripGroups } = await supabase
    .from('trip_groups')
    .select('trip_id')
    .in('group_id', groupIds);

  if (!tripGroups || tripGroups.length === 0) return [];

  const tripIds = [...new Set(tripGroups.map((tg: { trip_id: string }) => tg.trip_id))];

  // 3. Pobierz szczegóły wyjazdów
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_groups (
        group:groups (*)
      )
    `)
    .in('id', tripIds)
    .eq('status', 'published')
    .order('departure_datetime', { ascending: true });

  if (error) {
    console.error('Trips fetch error:', error);
    return [];
  }

  const result = trips.map((t: Trip & { trip_groups: { group: Group }[] }) => ({
    ...t,
    groups: t.trip_groups?.map((tg) => tg.group) || [],
  }));

  // Serializuj do plain objects dla Client Components
  return JSON.parse(JSON.stringify(result)) as TripWithGroups[];
}

export async function createTrip(input: CreateTripInput) {
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

  const {
    title,
    description,
    declaration_deadline,
    departure_datetime,
    departure_location,
    departure_stop2_datetime,
    departure_stop2_location,
    return_datetime,
    return_location,
    return_stop2_datetime,
    return_stop2_location,
    bank_account_pln,
    bank_account_eur,
    status,
    group_ids,
    payment_templates,
  } = input;

  // 1. Utwórz wyjazd
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      title,
      description: description || null,
      declaration_deadline: declaration_deadline || null,
      departure_datetime,
      departure_location,
      departure_stop2_datetime: departure_stop2_datetime || null,
      departure_stop2_location: departure_stop2_location || null,
      return_datetime,
      return_location,
      return_stop2_datetime: return_stop2_datetime || null,
      return_stop2_location: return_stop2_location || null,
      bank_account_pln: bank_account_pln || '39 1240 1444 1111 0010 7170 4855',
      bank_account_eur: bank_account_eur || 'PL21 1240 1444 1978 0010 7136 2778',
      status,
      created_by: user.id,
    })
    .select()
    .single();

  if (tripError) {
    console.error('Trip create error:', tripError);
    return { error: 'Nie udało się utworzyć wyjazdu' };
  }

  // 2. Przypisz grupy
  if (group_ids.length > 0) {
    const tripGroupsData = group_ids.map((groupId) => ({
      trip_id: trip.id,
      group_id: groupId,
    }));

    const { error: groupsError } = await supabase
      .from('trip_groups')
      .insert(tripGroupsData);

    if (groupsError) {
      console.error('Trip groups error:', groupsError);
      // Kontynuuj mimo błędu
    }
  }

  // 3. Utwórz szablony płatności
  if (payment_templates.length > 0) {
    const templatesData = payment_templates.map((template: CreatePaymentTemplateInput) => ({
      trip_id: trip.id,
      payment_type: template.payment_type,
      installment_number: template.installment_number || null,
      is_first_installment: template.is_first_installment || false,
      includes_season_pass: template.includes_season_pass || false,
      category_name: template.category_name || null,
      birth_year_from: template.birth_year_from || null,
      birth_year_to: template.birth_year_to || null,
      amount: template.amount,
      currency: template.currency,
      due_date: template.due_date || null,
      payment_method: template.payment_method || null,
    }));

    const { error: templatesError } = await supabase
      .from('trip_payment_templates')
      .insert(templatesData);

    if (templatesError) {
      console.error('Payment templates error:', templatesError);
    }
  }

  revalidatePath('/admin/trips');
  revalidatePath('/admin/calendar');
  revalidatePath('/parent/trips');
  return { success: true, data: trip };
}

export async function updateTrip(id: string, input: Partial<CreateTripInput>) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

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

  const {
    title,
    description,
    declaration_deadline,
    departure_datetime,
    departure_location,
    departure_stop2_datetime,
    departure_stop2_location,
    return_datetime,
    return_location,
    return_stop2_datetime,
    return_stop2_location,
    bank_account_pln,
    bank_account_eur,
    status,
    group_ids,
    payment_templates,
  } = input;

  // 1. Aktualizuj wyjazd (używamy admin client żeby ominąć RLS)
  const updateData: Partial<Trip> = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description || null;
  if (declaration_deadline !== undefined) updateData.declaration_deadline = declaration_deadline || null;
  if (departure_datetime !== undefined) updateData.departure_datetime = departure_datetime;
  if (departure_location !== undefined) updateData.departure_location = departure_location;
  if (departure_stop2_datetime !== undefined) updateData.departure_stop2_datetime = departure_stop2_datetime || null;
  if (departure_stop2_location !== undefined) updateData.departure_stop2_location = departure_stop2_location || null;
  if (return_datetime !== undefined) updateData.return_datetime = return_datetime;
  if (return_location !== undefined) updateData.return_location = return_location;
  if (return_stop2_datetime !== undefined) updateData.return_stop2_datetime = return_stop2_datetime || null;
  if (return_stop2_location !== undefined) updateData.return_stop2_location = return_stop2_location || null;
  if (bank_account_pln !== undefined) updateData.bank_account_pln = bank_account_pln;
  if (bank_account_eur !== undefined) updateData.bank_account_eur = bank_account_eur;
  if (status !== undefined) updateData.status = status;

  const { error: updateError } = await supabaseAdmin
    .from('trips')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    console.error('Trip update error:', updateError);
    return { error: 'Nie udało się zaktualizować wyjazdu' };
  }

  // 2. Aktualizuj grupy jeśli podane (używamy admin client)
  if (group_ids !== undefined) {
    const { error: deleteGroupsError } = await supabaseAdmin
      .from('trip_groups')
      .delete()
      .eq('trip_id', id);

    if (deleteGroupsError) {
      console.error('Delete trip_groups error:', deleteGroupsError);
    }

    if (group_ids.length > 0) {
      const tripGroupsData = group_ids.map((groupId) => ({
        trip_id: id,
        group_id: groupId,
      }));

      const { error: insertGroupsError } = await supabaseAdmin
        .from('trip_groups')
        .insert(tripGroupsData);

      if (insertGroupsError) {
        console.error('Insert trip_groups error:', insertGroupsError);
      }
    }
  }

  // 3. Aktualizuj szablony płatności jeśli podane (używamy admin client)
  if (payment_templates !== undefined) {
    // Usuń wszystkie stare szablony
    const { error: deleteTemplatesError } = await supabaseAdmin
      .from('trip_payment_templates')
      .delete()
      .eq('trip_id', id);

    if (deleteTemplatesError) {
      console.error('Delete payment templates error:', deleteTemplatesError);
      return { error: 'Nie udało się usunąć starych szablonów płatności' };
    }

    // Dodaj nowe szablony (bez pola id - niech baza je wygeneruje)
    if (payment_templates.length > 0) {
      const templatesData = payment_templates.map((template: CreatePaymentTemplateInput) => ({
        trip_id: id,
        payment_type: template.payment_type,
        installment_number: template.installment_number || null,
        is_first_installment: template.is_first_installment || false,
        includes_season_pass: template.includes_season_pass || false,
        category_name: template.category_name || null,
        birth_year_from: template.birth_year_from || null,
        birth_year_to: template.birth_year_to || null,
        amount: template.amount,
        currency: template.currency,
        due_date: template.due_date || null,
        payment_method: template.payment_method || null,
      }));

      const { error: insertTemplatesError } = await supabaseAdmin
        .from('trip_payment_templates')
        .insert(templatesData);

      if (insertTemplatesError) {
        console.error('Insert payment templates error:', insertTemplatesError);
        return { error: 'Nie udało się dodać nowych szablonów płatności' };
      }
    }
  }

  revalidatePath('/admin/trips');
  revalidatePath(`/admin/trips/${id}`);
  revalidatePath('/admin/calendar');
  revalidatePath('/parent/trips');
  return { success: true };
}

export async function updateTripStatus(id: string, status: TripStatus) {
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
    .from('trips')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Trip status update error:', error);
    return { error: 'Nie udało się zmienić statusu' };
  }

  revalidatePath('/admin/trips');
  revalidatePath(`/admin/trips/${id}`);
  revalidatePath('/admin/calendar');
  revalidatePath('/parent/trips');
  return { success: true };
}

export async function deleteTrip(id: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

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

  // Usuń powiązane dane (używamy admin client żeby ominąć RLS)
  try {
    // 1. Usuń płatności powiązane z rejestracjami tego wyjazdu
    const { data: registrations } = await supabaseAdmin
      .from('trip_registrations')
      .select('id')
      .eq('trip_id', id);

    if (registrations && registrations.length > 0) {
      const registrationIds = registrations.map(r => r.id);

      // Pobierz płatności żeby usunąć transakcje
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .in('registration_id', registrationIds);

      if (payments && payments.length > 0) {
        const paymentIds = payments.map(p => p.id);

        // Usuń transakcje płatności
        const { error: txError } = await supabaseAdmin
          .from('payment_transactions')
          .delete()
          .in('payment_id', paymentIds);
        if (txError) console.error('Delete payment_transactions error:', txError);

        // Usuń płatności
        const { error: payError } = await supabaseAdmin
          .from('payments')
          .delete()
          .in('registration_id', registrationIds);
        if (payError) console.error('Delete payments error:', payError);
      }

      // Usuń rejestracje
      const { error: regError } = await supabaseAdmin
        .from('trip_registrations')
        .delete()
        .eq('trip_id', id);
      if (regError) console.error('Delete registrations error:', regError);
    }

    // 2. Usuń szablony płatności
    const { error: templError } = await supabaseAdmin
      .from('trip_payment_templates')
      .delete()
      .eq('trip_id', id);
    if (templError) console.error('Delete templates error:', templError);

    // 3. Usuń przypisania grup
    const { error: grpError } = await supabaseAdmin
      .from('trip_groups')
      .delete()
      .eq('trip_id', id);
    if (grpError) console.error('Delete trip_groups error:', grpError);

    // 4. Usuń wyjazd
    const { error } = await supabaseAdmin
      .from('trips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Trip delete error:', error);
      return { error: 'Nie udało się usunąć wyjazdu' };
    }
  } catch (err) {
    console.error('Delete trip cascade error:', err);
    return { error: 'Błąd podczas usuwania wyjazdu i powiązanych danych' };
  }

  revalidatePath('/admin/trips');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/calendar');
  revalidatePath('/parent/trips');
  revalidatePath('/parent/payments');
  return { success: true };
}

// Typ dla płatności uczestnika
export interface ParticipantPayment {
  id: string;
  payment_type: string;
  installment_number: number | null;
  amount: number;
  currency: string;
  status: string;
  amount_paid: number;
}

// Typy dla uczestników wyjazdu
export interface TripParticipant {
  id: string;
  participant_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  group_name: string;
  parent_email: string;
  parent_phone: string;
  participation_status: 'unconfirmed' | 'confirmed' | 'not_going' | 'other';
  participation_note: string | null;
  registration_id: string | null;
  payments: ParticipantPayment[];
}

export async function getTripParticipants(tripId: string): Promise<TripParticipant[]> {
  const supabase = await createClient();

  // 1. Pobierz wyjazd z grupami
  const { data: trip } = await supabase
    .from('trips')
    .select(`
      id,
      trip_groups (group_id)
    `)
    .eq('id', tripId)
    .single();

  if (!trip) return [];

  const groupIds = trip.trip_groups?.map((tg: { group_id: string }) => tg.group_id) || [];
  if (groupIds.length === 0) return [];

  // 2. Pobierz wszystkie dzieci z tych grup
  const { data: participantGroups } = await supabase
    .from('participant_groups')
    .select(`
      participant:participants (
        id,
        first_name,
        last_name,
        birth_date,
        parent:profiles!parent_id (
          email,
          phone
        )
      ),
      group:groups (
        name
      )
    `)
    .in('group_id', groupIds);

  if (!participantGroups) return [];

  // 3. Pobierz istniejące rejestracje
  const { data: registrations } = await supabase
    .from('trip_registrations')
    .select('id, participant_id, participation_status, participation_note')
    .eq('trip_id', tripId);

  const registrationMap = new Map(
    (registrations || []).map((r: { id: string; participant_id: string; participation_status: string; participation_note: string | null }) => [r.participant_id, r])
  );

  // 4. Pobierz płatności dla wszystkich rejestracji
  const registrationIds = (registrations || []).map((r: { id: string }) => r.id);
  let paymentsMap = new Map<string, ParticipantPayment[]>();

  if (registrationIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('id, registration_id, payment_type, installment_number, amount, currency, status, amount_paid')
      .in('registration_id', registrationIds)
      .neq('status', 'cancelled');

    if (payments) {
      payments.forEach((p: {
        id: string;
        registration_id: string;
        payment_type: string;
        installment_number: number | null;
        amount: number;
        currency: string;
        status: string;
        amount_paid: number;
      }) => {
        const existing = paymentsMap.get(p.registration_id) || [];
        existing.push({
          id: p.id,
          payment_type: p.payment_type,
          installment_number: p.installment_number,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          amount_paid: p.amount_paid || 0,
        });
        paymentsMap.set(p.registration_id, existing);
      });
    }
  }

  // 5. Złóż dane
  const result: TripParticipant[] = (participantGroups || [])
    .map((pg: unknown) => {
      const pgData = pg as { participant: unknown; group: unknown };

      // Handle participant which could be array or object
      let participantRaw = pgData.participant;
      if (Array.isArray(participantRaw)) {
        participantRaw = participantRaw[0];
      }
      if (!participantRaw) return null;

      const participant = participantRaw as {
        id: string;
        first_name: string;
        last_name: string;
        birth_date: string;
        parent: unknown;
      };

      // Handle parent which could be array or object
      let parentRaw = participant.parent;
      if (Array.isArray(parentRaw)) {
        parentRaw = parentRaw[0];
      }
      const parent = (parentRaw as { email: string; phone: string } | null) || { email: '', phone: '' };

      // Handle group which could be array or object
      let groupRaw = pgData.group;
      if (Array.isArray(groupRaw)) {
        groupRaw = groupRaw[0];
      }
      const group = groupRaw as { name: string } | null;

      const registration = registrationMap.get(participant.id) as { id: string; participation_status: string; participation_note: string | null } | undefined;
      const payments = registration ? (paymentsMap.get(registration.id) || []) : [];

      return {
        id: participant.id,
        participant_id: participant.id,
        first_name: participant.first_name,
        last_name: participant.last_name,
        birth_date: participant.birth_date,
        group_name: group?.name || 'Brak grupy',
        parent_email: parent.email || '',
        parent_phone: parent.phone || '',
        participation_status: (registration?.participation_status as 'unconfirmed' | 'confirmed' | 'not_going' | 'other') || 'unconfirmed',
        participation_note: registration?.participation_note || null,
        registration_id: registration?.id || null,
        payments,
      };
    })
    .filter((p: TripParticipant | null): p is TripParticipant => p !== null)
    .sort((a: TripParticipant, b: TripParticipant) => a.last_name.localeCompare(b.last_name, 'pl'));

  return JSON.parse(JSON.stringify(result));
}

export async function updateParticipationStatus(
  tripId: string,
  participantId: string,
  status: 'unconfirmed' | 'confirmed' | 'not_going' | 'other',
  note?: string
) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Gdy admin ustawia "Jedzie" bez notatki o przystanku — domyślnie Przystanek 1
  const finalNote = (status === 'confirmed' && !note) ? '[STOP1]' : (note || null);

  // Sprawdź czy istnieje rejestracja
  const { data: existing } = await supabase
    .from('trip_registrations')
    .select('id')
    .eq('trip_id', tripId)
    .eq('participant_id', participantId)
    .maybeSingle();

  let registrationId: string | null = null;

  if (existing) {
    registrationId = existing.id;
    // Aktualizuj istniejącą
    const { error } = await supabase
      .from('trip_registrations')
      .update({
        participation_status: status,
        participation_note: finalNote,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Update participation error:', error);
      return { error: `Nie udało się zaktualizować statusu: ${error.message}` };
    }
  } else {
    // Utwórz nową rejestrację
    const { error, data } = await supabase
      .from('trip_registrations')
      .insert({
        trip_id: tripId,
        participant_id: participantId,
        registered_by: user.id,
        registration_type: 'admin',
        is_outside_group: false,
        status: 'active',
        participation_status: status,
        participation_note: finalNote,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Create registration error:', error);
      return { error: `Nie udało się utworzyć rejestracji: ${error.message}` };
    }
    registrationId = data?.id || null;
  }

  // Obsługa płatności
  if (status === 'confirmed' && registrationId) {
    // Admin ustawia "Jedzie" — utwórz płatności jeśli nie istnieją
    const { data: existingPayments } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .neq('status', 'cancelled')
      .limit(1);

    if (!existingPayments || existingPayments.length === 0) {
      await createPaymentsForRegistration(registrationId, tripId, participantId);
    }
  } else if ((status === 'not_going' || status === 'unconfirmed') && registrationId) {
    // Admin ustawia "Nie jedzie" lub "Niepotwierdzony" — anuluj oczekujące płatności
    await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled' })
      .eq('registration_id', registrationId)
      .eq('status', 'pending');
  }

  revalidatePath(`/admin/trips/${tripId}/registrations`);
  revalidatePath('/parent/trips');
  revalidatePath('/parent/payments');
  revalidatePath('/admin/payments');
  return { success: true };
}

// Typy dla wyjazdów rodzica z dziećmi
export interface ChildTripStatus {
  child_id: string;
  child_name: string;
  participation_status: 'unconfirmed' | 'confirmed' | 'not_going' | 'other';
  participation_note: string | null;
}

export interface PaymentTemplateForParent {
  id: string;
  payment_type: string;
  installment_number: number | null;
  category_name: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  payment_method: string | null;
}

export interface TripForParent extends TripWithGroups {
  children: ChildTripStatus[];
  departure_stop2_datetime: string | null;
  departure_stop2_location: string | null;
  return_stop2_datetime: string | null;
  return_stop2_location: string | null;
  payment_templates: PaymentTemplateForParent[];
}

export async function getTripsForParentWithChildren(parentId: string, selectedChildId?: string): Promise<TripForParent[]> {
  const supabase = await createClient();

  // 1. Pobierz dzieci rodzica z grupami — jeśli wybrano konkretne, pobierz tylko je
  let childrenQuery = supabase
    .from('participants')
    .select(`
      id,
      first_name,
      last_name,
      participant_groups (group_id)
    `)
    .eq('parent_id', parentId);

  if (selectedChildId) {
    childrenQuery = childrenQuery.eq('id', selectedChildId);
  }

  const { data: children } = await childrenQuery;

  if (!children || children.length === 0) return [];

  // Zbierz group_ids
  const groupIds = children
    .flatMap((c: { participant_groups: { group_id: string }[] | { group_id: string } | null }) => {
      if (!c.participant_groups) return [];
      if (Array.isArray(c.participant_groups)) {
        return c.participant_groups.map((pg) => pg.group_id);
      }
      return [c.participant_groups.group_id];
    })
    .filter(Boolean);

  if (groupIds.length === 0) return [];

  // 2. Pobierz wyjazdy dla tych grup
  const { data: tripGroups } = await supabase
    .from('trip_groups')
    .select('trip_id')
    .in('group_id', groupIds);

  if (!tripGroups || tripGroups.length === 0) return [];

  const tripIds = [...new Set(tripGroups.map((tg: { trip_id: string }) => tg.trip_id))];

  // 3. Pobierz szczegóły wyjazdów wraz z szablonami płatności
  const { data: trips } = await supabase
    .from('trips')
    .select(`
      *,
      trip_groups (
        group:groups (*)
      ),
      trip_payment_templates (
        id,
        payment_type,
        installment_number,
        category_name,
        amount,
        currency,
        due_date,
        payment_method
      )
    `)
    .in('id', tripIds)
    .eq('status', 'published')
    .order('departure_datetime', { ascending: true });

  if (!trips) return [];

  // 4. Pobierz rejestracje dla dzieci tego rodzica
  const childIds = children.map((c: { id: string }) => c.id);
  const { data: registrations } = await supabase
    .from('trip_registrations')
    .select('trip_id, participant_id, participation_status, participation_note')
    .in('participant_id', childIds)
    .in('trip_id', tripIds);

  const registrationMap = new Map<string, { participation_status: string; participation_note: string | null }>();
  (registrations || []).forEach((r: { trip_id: string; participant_id: string; participation_status: string; participation_note: string | null }) => {
    registrationMap.set(`${r.trip_id}-${r.participant_id}`, {
      participation_status: r.participation_status,
      participation_note: r.participation_note,
    });
  });

  // 5. Złóż dane
  const result: TripForParent[] = trips.map((trip: Trip & {
    trip_groups: { group: Group }[];
    trip_payment_templates?: PaymentTemplateForParent[];
  }) => {
    const tripGroupIds = trip.trip_groups?.map((tg) => tg.group?.id) || [];

    // Znajdź dzieci które mogą jechać na ten wyjazd
    const eligibleChildren = children.filter((child: {
      id: string;
      first_name: string;
      last_name: string;
      participant_groups: { group_id: string }[] | { group_id: string } | null
    }) => {
      const childGroupIds: string[] = [];
      if (child.participant_groups) {
        if (Array.isArray(child.participant_groups)) {
          childGroupIds.push(...child.participant_groups.map((pg) => pg.group_id));
        } else {
          childGroupIds.push(child.participant_groups.group_id);
        }
      }
      return childGroupIds.some((gid) => tripGroupIds.includes(gid));
    });

    const childrenStatuses: ChildTripStatus[] = eligibleChildren.map((child: { id: string; first_name: string; last_name: string }) => {
      const reg = registrationMap.get(`${trip.id}-${child.id}`);
      return {
        child_id: child.id,
        child_name: `${child.first_name} ${child.last_name}`,
        participation_status: (reg?.participation_status as 'unconfirmed' | 'confirmed' | 'not_going' | 'other') || 'unconfirmed',
        participation_note: reg?.participation_note || null,
      };
    });

    return {
      ...trip,
      groups: trip.trip_groups?.map((tg) => tg.group) || [],
      children: childrenStatuses,
      payment_templates: trip.trip_payment_templates || [],
    };
  });

  return JSON.parse(JSON.stringify(result));
}

export async function updateParticipationStatusByParent(
  tripId: string,
  participantId: string,
  status: 'unconfirmed' | 'confirmed' | 'not_going' | 'other',
  note?: string
) {
  const supabase = await createClient();
  const { createAdminClient } = await import('@/lib/supabase/server');
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź czy to dziecko tego rodzica
  const { data: participant } = await supabase
    .from('participants')
    .select('parent_id')
    .eq('id', participantId)
    .single();

  if (!participant || participant.parent_id !== user.id) {
    return { error: 'Brak uprawnień' };
  }

  // Sprawdź czy istnieje rejestracja (używamy admin client żeby ominąć RLS)
  const { data: existing } = await supabaseAdmin
    .from('trip_registrations')
    .select('id')
    .eq('trip_id', tripId)
    .eq('participant_id', participantId)
    .maybeSingle();

  let registrationId: string | null = null;

  if (existing) {
    registrationId = existing.id;
    console.log('updateParticipationStatusByParent: Updating existing registration', {
      registrationId: existing.id,
      tripId,
      participantId,
      newStatus: status,
    });

    // Używamy admin client żeby ominąć RLS dla UPDATE
    const { error, data } = await supabaseAdmin
      .from('trip_registrations')
      .update({
        participation_status: status,
        participation_note: note || null,
      })
      .eq('id', existing.id)
      .select();

    console.log('updateParticipationStatusByParent: Update result', { data, error });

    if (error) {
      console.error('updateParticipationStatusByParent: Update error', error);
      return { error: `Nie udało się zaktualizować: ${error.message}` };
    }
  } else {
    // Używamy admin client żeby ominąć RLS dla INSERT
    const { error, data } = await supabaseAdmin
      .from('trip_registrations')
      .insert({
        trip_id: tripId,
        participant_id: participantId,
        registered_by: user.id,
        registration_type: 'parent',
        is_outside_group: false,
        status: 'active',
        participation_status: status,
        participation_note: note || null,
      })
      .select('id')
      .single();

    if (error) {
      return { error: `Nie udało się zapisać: ${error.message}` };
    }
    registrationId = data?.id || null;
  }

  // Użyj admin client do operacji na płatnościach
  const { createAdminClient: createAdminClientInner } = await import('@/lib/supabase/server');
  const supabaseAdminInner = createAdminClientInner();

  if (status === 'confirmed' && registrationId) {
    // Dziecko jedzie (confirmed = przystankiem lub dojazdem własnym) — utwórz płatności jeśli nie istnieją
    // 'other' to tylko wiadomość tekstowa do admina — NIE tworzy płatności
    const { data: existingPayments } = await supabaseAdminInner
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .neq('status', 'cancelled')
      .limit(1);

    if (!existingPayments || existingPayments.length === 0) {
      await createPaymentsForRegistration(registrationId, tripId, participantId);
    }
  } else if ((status === 'not_going' || status === 'unconfirmed') && registrationId) {
    // Dziecko nie jedzie lub cofnięto potwierdzenie — anuluj płatności (pending)
    await supabaseAdminInner
      .from('payments')
      .update({ status: 'cancelled' })
      .eq('registration_id', registrationId)
      .eq('status', 'pending');
  }

  revalidatePath('/parent/trips');
  revalidatePath('/parent/payments');
  revalidatePath('/admin/payments');
  revalidatePath(`/admin/trips/${tripId}/registrations`);
  return { success: true };
}

export async function duplicateTrip(tripId: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

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

  // Pobierz oryginał wraz z grupami i szablonami płatności
  const { data: originalTrip, error: fetchError } = await supabaseAdmin
    .from('trips')
    .select(`
      *,
      trip_groups (group_id),
      payment_templates:trip_payment_templates (*)
    `)
    .eq('id', tripId)
    .single();

  if (fetchError || !originalTrip) {
    console.error('Fetch trip error:', fetchError);
    return { error: 'Nie znaleziono wyjazdu' };
  }

  // Przygotuj nowe daty (przesuń o rok do przodu)
  const originalDeparture = new Date(originalTrip.departure_datetime);
  const originalReturn = new Date(originalTrip.return_datetime);

  originalDeparture.setFullYear(originalDeparture.getFullYear() + 1);
  originalReturn.setFullYear(originalReturn.getFullYear() + 1);

  // Utwórz kopię wyjazdu
  const { data: newTrip, error: createError } = await supabaseAdmin
    .from('trips')
    .insert({
      title: `${originalTrip.title} (kopia)`,
      description: originalTrip.description,
      departure_datetime: originalDeparture.toISOString(),
      departure_location: originalTrip.departure_location,
      departure_stop2_datetime: originalTrip.departure_stop2_datetime
        ? new Date(new Date(originalTrip.departure_stop2_datetime).setFullYear(
            new Date(originalTrip.departure_stop2_datetime).getFullYear() + 1
          )).toISOString()
        : null,
      departure_stop2_location: originalTrip.departure_stop2_location,
      return_datetime: originalReturn.toISOString(),
      return_location: originalTrip.return_location,
      return_stop2_datetime: originalTrip.return_stop2_datetime
        ? new Date(new Date(originalTrip.return_stop2_datetime).setFullYear(
            new Date(originalTrip.return_stop2_datetime).getFullYear() + 1
          )).toISOString()
        : null,
      return_stop2_location: originalTrip.return_stop2_location,
      bank_account_pln: originalTrip.bank_account_pln,
      bank_account_eur: originalTrip.bank_account_eur,
      status: 'draft', // Kopia zawsze jako szkic
      created_by: user.id,
    })
    .select()
    .single();

  if (createError || !newTrip) {
    console.error('Create trip error:', createError);
    return { error: 'Nie udało się utworzyć kopii' };
  }

  // Skopiuj przypisania grup
  if (originalTrip.trip_groups && originalTrip.trip_groups.length > 0) {
    const tripGroupsData = originalTrip.trip_groups.map((tg: { group_id: string }) => ({
      trip_id: newTrip.id,
      group_id: tg.group_id,
    }));

    const { error: groupsError } = await supabaseAdmin
      .from('trip_groups')
      .insert(tripGroupsData);

    if (groupsError) {
      console.error('Copy trip_groups error:', groupsError);
    }
  }

  // Skopiuj szablony płatności (z przesuniętymi terminami)
  if (originalTrip.payment_templates && originalTrip.payment_templates.length > 0) {
    const templatesData = originalTrip.payment_templates.map((pt: {
      payment_type: string;
      installment_number: number | null;
      is_first_installment: boolean;
      includes_season_pass: boolean;
      category_name: string | null;
      birth_year_from: number | null;
      birth_year_to: number | null;
      amount: number;
      currency: string;
      due_date: string | null;
      payment_method: string | null;
    }) => ({
      trip_id: newTrip.id,
      payment_type: pt.payment_type,
      installment_number: pt.installment_number,
      is_first_installment: pt.is_first_installment,
      includes_season_pass: pt.includes_season_pass,
      category_name: pt.category_name,
      birth_year_from: pt.birth_year_from ? pt.birth_year_from + 1 : null, // Przesuń roczniki
      birth_year_to: pt.birth_year_to ? pt.birth_year_to + 1 : null,
      amount: pt.amount,
      currency: pt.currency,
      due_date: pt.due_date
        ? new Date(new Date(pt.due_date).setFullYear(
            new Date(pt.due_date).getFullYear() + 1
          )).toISOString().split('T')[0]
        : null,
      payment_method: pt.payment_method,
    }));

    const { error: templatesError } = await supabaseAdmin
      .from('trip_payment_templates')
      .insert(templatesData);

    if (templatesError) {
      console.error('Copy payment templates error:', templatesError);
    }
  }

  revalidatePath('/admin/trips');
  revalidatePath('/admin/calendar');
  revalidatePath('/parent/trips');
  return { success: true, data: newTrip };
}
