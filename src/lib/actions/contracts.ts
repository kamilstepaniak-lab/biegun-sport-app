'use server';

import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CONTRACT_TEMPLATE, fillContractTemplate, buildPaymentScheduleText } from '@/lib/contract-template';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers wewnętrzne
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

async function buildContractText(
  tripId: string,
  participantId: string,
  templateText: string
): Promise<string | null> {
  const supabaseAdmin = createAdminClient();

  const { data: trip } = await supabaseAdmin.from('trips').select('*').eq('id', tripId).single();
  if (!trip) return null;

  // Pobierz szablony płatności dla wyjazdu
  const { data: paymentTemplates } = await supabaseAdmin
    .from('trip_payment_templates')
    .select('payment_type, installment_number, is_first_installment, category_name, amount, currency, due_date')
    .eq('trip_id', tripId)
    .order('due_date', { ascending: true, nullsFirst: false });

  const paymentSchedule = buildPaymentScheduleText(paymentTemplates ?? []);

  const { data: participantData } = await supabaseAdmin
    .from('participants')
    .select(`id, first_name, last_name, birth_date, parent_id, profiles:parent_id (id, email, first_name, last_name, address_street, address_zip, address_city, pesel, phone)`)
    .eq('id', participantId)
    .single();
  if (!participantData) return null;

  const parentProfile = (participantData as unknown as {
    profiles: {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      address_street: string | null;
      address_zip: string | null;
      address_city: string | null;
      pesel: string | null;
      phone: string | null;
    } | null;
  }).profiles;

  const parentName = parentProfile
    ? [parentProfile.first_name, parentProfile.last_name].filter(Boolean).join(' ') || parentProfile.email
    : '—';
  const parentEmail = parentProfile?.email ?? '—';
  const parentAddress = parentProfile
    ? [
        parentProfile.address_street,
        [parentProfile.address_zip, parentProfile.address_city].filter(Boolean).join(' '),
      ].filter(Boolean).join(', ') || '—'
    : '—';
  const parentPesel = parentProfile?.pesel ?? '—';
  const parentPhone = parentProfile?.phone ?? '—';

  const childName = `${participantData.first_name} ${participantData.last_name}`;
  const childBirthDate = format(new Date(participantData.birth_date), 'd MMMM yyyy', { locale: pl });
  const tripDeparture = `${format(new Date(trip.departure_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })} — ${trip.departure_location}`;
  const tripReturn = `${format(new Date(trip.return_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })} — ${trip.return_location}`;
  const tripLocation = (trip as Record<string, unknown>).location as string | null ?? '';

  return fillContractTemplate(templateText, {
    trip_title: trip.title,
    trip_location: tripLocation,
    trip_departure: tripDeparture,
    trip_return: tripReturn,
    trip_bank_pln: (trip as Record<string, unknown>).bank_account_pln as string ?? '',
    trip_bank_eur: (trip as Record<string, unknown>).bank_account_eur as string ?? '',
    child_name: childName,
    child_birth_date: childBirthDate,
    parent_name: parentName,
    parent_email: parentEmail,
    parent_address: parentAddress,
    parent_pesel: parentPesel,
    parent_phone: parentPhone,
    payment_schedule: paymentSchedule,
  });
}

async function nextContractNumber(): Promise<string> {
  const supabaseAdmin = createAdminClient();
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from('trip_contracts')
    .select('id', { count: 'exact', head: true })
    .not('contract_number', 'is', null)
    .like('contract_number', `%/${year}`);
  return `${(count ?? 0) + 1}/${year}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Zapisz wzór umowy dla wyjazdu (draft)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveTripContractTemplate(
  tripId: string,
  templateText: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('trip_contract_templates')
    .upsert(
      {
        trip_id: tripId,
        template_text: templateText,
        updated_at: new Date().toISOString(),
        created_by: user.id,
      },
      { onConflict: 'trip_id', ignoreDuplicates: false }
    );

  if (error) {
    console.error('saveTripContractTemplate error:', error);
    return { error: 'Nie udało się zapisać wzoru' };
  }

  revalidatePath(`/admin/trips/${tripId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Zatwierdź wzór umowy (is_active = true) — od teraz rodzice dostają umowy
// ─────────────────────────────────────────────────────────────────────────────

export async function activateTripContractTemplate(
  tripId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();

  // Sprawdź czy wzór istnieje
  const { data: template } = await supabaseAdmin
    .from('trip_contract_templates')
    .select('id, is_active')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (!template) return { error: 'Najpierw zapisz wzór umowy' };

  const { error } = await supabaseAdmin
    .from('trip_contract_templates')
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
      activated_by: user.id,
    })
    .eq('trip_id', tripId);

  if (error) {
    console.error('activateTripContractTemplate error:', error);
    return { error: 'Nie udało się aktywować wzoru' };
  }

  revalidatePath(`/admin/trips/${tripId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Dezaktywuj wzór umowy
// ─────────────────────────────────────────────────────────────────────────────

export async function deactivateTripContractTemplate(
  tripId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('trip_contract_templates')
    .update({ is_active: false })
    .eq('trip_id', tripId);

  if (error) return { error: 'Nie udało się dezaktywować wzoru' };

  revalidatePath(`/admin/trips/${tripId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pobierz wzór umowy dla wyjazdu
// ─────────────────────────────────────────────────────────────────────────────

export async function getTripContractTemplate(tripId: string) {
  const user = await requireAdmin();
  if (!user) return null;

  const supabaseAdmin = createAdminClient();

  const { data } = await supabaseAdmin
    .from('trip_contract_templates')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pobierz wzory umów dla wielu wyjazdów (mapa tripId -> template)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTripContractTemplatesMap(
  tripIds: string[]
): Promise<Record<string, { is_active: boolean; template_text: string } | null>> {
  if (tripIds.length === 0) return {};
  const user = await requireAdmin();
  if (!user) return {};

  const supabaseAdmin = createAdminClient();

  const { data } = await supabaseAdmin
    .from('trip_contract_templates')
    .select('trip_id, is_active, template_text')
    .in('trip_id', tripIds);

  const map: Record<string, { is_active: boolean; template_text: string } | null> = {};
  for (const id of tripIds) map[id] = null;
  for (const row of data ?? []) {
    map[row.trip_id] = { is_active: row.is_active, template_text: row.template_text };
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper wewnętrzny: Utwórz umowę dla uczestnika z aktywnego wzoru
// Wywoływany gdy rodzic potwierdza wyjazd (participation_status = confirmed)
// ─────────────────────────────────────────────────────────────────────────────

export async function createContractForParticipantIfNeeded(
  tripId: string,
  participantId: string,
  registrationId: string,
  createdBy: string
): Promise<void> {
  const supabaseAdmin = createAdminClient();

  // 1. Sprawdź czy wyjazd ma aktywny wzór umowy
  const { data: template } = await supabaseAdmin
    .from('trip_contract_templates')
    .select('id, template_text, is_active')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .maybeSingle();

  if (!template) return; // brak aktywnego wzoru — wyjazd nie wymaga umów

  // 2. Sprawdź czy umowa już istnieje — nie nadpisuj
  const { data: existing } = await supabaseAdmin
    .from('trip_contracts')
    .select('id')
    .eq('trip_id', tripId)
    .eq('participant_id', participantId)
    .maybeSingle();

  if (existing) return;

  // 3. Wypełnij wzór danymi uczestnika
  const contractText = await buildContractText(tripId, participantId, template.template_text);
  if (!contractText) return;

  // 4. Numer umowy
  const contractNumber = await nextContractNumber();

  // 5. Insert
  const { error } = await supabaseAdmin
    .from('trip_contracts')
    .insert({
      trip_id: tripId,
      participant_id: participantId,
      registration_id: registrationId,
      contract_text: contractText,
      contract_number: contractNumber,
      created_by: createdBy,
    });

  if (error) {
    console.error('createContractForParticipantIfNeeded error:', error);
    return;
  }

  revalidatePath('/parent/contracts');
  revalidatePath(`/admin/trips/${tripId}/contracts`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pobierz umowy dla konkretnego wyjazdu
// ─────────────────────────────────────────────────────────────────────────────

export async function getContractsForTrip(tripId: string) {
  const user = await requireAdmin();
  if (!user) return [];

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('trip_contracts')
    .select(`
      *,
      participants!participant_id (
        id,
        first_name,
        last_name,
        birth_date,
        parent_id,
        profiles:parent_id (
          id,
          email,
          first_name,
          last_name
        )
      ),
      trips!trip_id (
        id,
        title,
        departure_datetime,
        return_datetime
      )
    `)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getContractsForTrip error:', error);
    return [];
  }

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pobierz wszystkie umowy
// ─────────────────────────────────────────────────────────────────────────────

export async function getContractsForAdmin() {
  const user = await requireAdmin();
  if (!user) return [];

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('trip_contracts')
    .select(`
      *,
      participants!participant_id (
        id,
        first_name,
        last_name,
        profiles:parent_id (
          id,
          email,
          first_name,
          last_name
        )
      ),
      trips!trip_id (
        id,
        title,
        departure_datetime,
        return_datetime
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getContractsForAdmin error:', error);
    return [];
  }

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rodzic: Pobierz swoje umowy
// ─────────────────────────────────────────────────────────────────────────────

export async function getContractsForParent() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: children } = await supabase
    .from('participants')
    .select('id')
    .eq('parent_id', user.id);

  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  const { data, error } = await supabase
    .from('trip_contracts')
    .select(`
      *,
      participants!participant_id (
        id,
        first_name,
        last_name,
        birth_date
      ),
      trips!trip_id (
        id,
        title,
        departure_datetime,
        return_datetime,
        departure_location,
        return_location
      )
    `)
    .in('participant_id', childIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getContractsForParent error:', error);
    return [];
  }

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rodzic: Zaakceptuj umowę
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptContract(
  contractId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const { data: contract } = await supabase
    .from('trip_contracts')
    .select('id, accepted_at, participant_id')
    .eq('id', contractId)
    .single();

  if (!contract) return { error: 'Umowa nie istnieje' };
  if (contract.accepted_at) return { error: 'Umowa już zaakceptowana' };

  // Sprawdź że uczestnik należy do tego rodzica
  const { data: participant } = await supabase
    .from('participants')
    .select('parent_id')
    .eq('id', contract.participant_id)
    .single();

  if (!participant || participant.parent_id !== user.id) {
    return { error: 'Brak uprawnień do akceptacji tej umowy' };
  }

  const { error } = await supabase
    .from('trip_contracts')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_parent_id: user.id,
    })
    .eq('id', contractId);

  if (error) {
    console.error('acceptContract error:', error);
    return { error: 'Nie udało się zaakceptować umowy' };
  }

  revalidatePath('/parent/contracts');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Usuń umowy (bulk)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteContractsAdmin(
  contractIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };
  if (contractIds.length === 0) return { success: true };

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('trip_contracts')
    .delete()
    .in('id', contractIds);

  if (error) {
    console.error('deleteContractsAdmin error:', error);
    return { error: 'Nie udało się usunąć umów' };
  }

  revalidatePath('/admin/contracts');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pobierz konkretną umowę (podgląd)
// ─────────────────────────────────────────────────────────────────────────────

export async function getContractById(contractId: string) {
  const user = await requireAdmin();
  if (!user) return null;

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('trip_contracts')
    .select(`
      *,
      participants!participant_id (
        id,
        first_name,
        last_name,
        birth_date,
        parent_id,
        profiles:parent_id (
          id,
          email,
          first_name,
          last_name
        )
      ),
      trips!trip_id (
        id,
        title,
        departure_datetime,
        return_datetime
      )
    `)
    .eq('id', contractId)
    .single();

  if (error) {
    console.error('getContractById error:', error);
    return null;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Podgląd wypełnionego wzoru (dla edytora)
// ─────────────────────────────────────────────────────────────────────────────

export async function previewContractTemplate(
  tripId: string,
  templateText: string
): Promise<{ contractText: string; participantName: string } | null> {
  const user = await requireAdmin();
  if (!user) return null;

  const supabaseAdmin = createAdminClient();

  // Pobierz pierwszego aktywnego uczestnika do podglądu
  const { data: registrations } = await supabaseAdmin
    .from('trip_registrations')
    .select(`
      id,
      participant_id,
      participants!inner (
        id,
        first_name,
        last_name,
        birth_date,
        parent_id,
        profiles:parent_id (
          id,
          email,
          first_name,
          last_name,
          address_street,
          address_zip,
          address_city,
          pesel,
          phone
        )
      )
    `)
    .eq('trip_id', tripId)
    .eq('status', 'active')
    .limit(1);

  const { data: trip } = await supabaseAdmin.from('trips').select('*').eq('id', tripId).single();
  if (!trip) return null;

  // Pobierz szablony płatności (tak samo jak w buildContractText)
  const { data: paymentTemplates } = await supabaseAdmin
    .from('trip_payment_templates')
    .select('payment_type, installment_number, is_first_installment, category_name, amount, currency, due_date')
    .eq('trip_id', tripId)
    .order('due_date', { ascending: true, nullsFirst: false });

  const paymentSchedule = buildPaymentScheduleText(paymentTemplates ?? []);
  const tripBankPln = (trip as Record<string, unknown>).bank_account_pln as string ?? '';
  const tripBankEur = (trip as Record<string, unknown>).bank_account_eur as string ?? '';

  const tripDeparture = `${format(new Date(trip.departure_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })} — ${trip.departure_location}`;
  const tripReturn = `${format(new Date(trip.return_datetime), 'EEEE, d MMMM yyyy, HH:mm', { locale: pl })} — ${trip.return_location}`;
  const tripLocation = (trip as Record<string, unknown>).location as string | null ?? '';

  if (!registrations || registrations.length === 0) {
    // Placeholder
    const contractText = fillContractTemplate(templateText, {
      trip_title: trip.title,
      trip_location: tripLocation,
      trip_departure: tripDeparture,
      trip_return: tripReturn,
      trip_bank_pln: tripBankPln,
      trip_bank_eur: tripBankEur,
      child_name: '[IMIĘ I NAZWISKO UCZESTNIKA]',
      child_birth_date: '[DATA URODZENIA]',
      parent_name: '[IMIĘ I NAZWISKO OPIEKUNA]',
      parent_email: '[E-MAIL OPIEKUNA]',
      parent_address: '[ADRES OPIEKUNA]',
      parent_pesel: '[PESEL OPIEKUNA]',
      parent_phone: '[TELEFON OPIEKUNA]',
      payment_schedule: paymentSchedule,
    });
    return { contractText, participantName: '' };
  }

  const reg = registrations[0];
  const participant = reg.participants as unknown as {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    parent_id: string;
    profiles: {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      address_street: string | null;
      address_zip: string | null;
      address_city: string | null;
      pesel: string | null;
      phone: string | null;
    } | null;
  };

  const parentProfile = participant.profiles;
  const parentName = parentProfile
    ? [parentProfile.first_name, parentProfile.last_name].filter(Boolean).join(' ') || parentProfile.email
    : '—';
  const parentEmail = parentProfile?.email ?? '—';
  const parentAddress = parentProfile
    ? [
        parentProfile.address_street,
        [parentProfile.address_zip, parentProfile.address_city].filter(Boolean).join(' '),
      ].filter(Boolean).join(', ') || '—'
    : '—';
  const parentPesel = parentProfile?.pesel ?? '—';
  const parentPhone = parentProfile?.phone ?? '—';
  const childName = `${participant.first_name} ${participant.last_name}`;
  const childBirthDate = format(new Date(participant.birth_date), 'd MMMM yyyy', { locale: pl });

  const contractText = fillContractTemplate(templateText, {
    trip_title: trip.title,
    trip_location: tripLocation,
    trip_departure: tripDeparture,
    trip_return: tripReturn,
    trip_bank_pln: tripBankPln,
    trip_bank_eur: tripBankEur,
    child_name: childName,
    child_birth_date: childBirthDate,
    parent_name: parentName,
    parent_email: parentEmail,
    parent_address: parentAddress,
    parent_pesel: parentPesel,
    parent_phone: parentPhone,
    payment_schedule: paymentSchedule,
  });

  return { contractText, participantName: childName };
}
