'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { participantSchema, type ParticipantInput } from '@/lib/validations/participant';
import type { Participant, ParticipantWithGroup, ParticipantFull, Group } from '@/types';

export async function getMyChildren(): Promise<ParticipantWithGroup[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Pobierz uczestników wraz z grupą — 1 zapytanie zamiast 1+2N
  const { data: participants, error } = await supabase
    .from('participants')
    .select(`
      *,
      participant_groups (
        group:groups (*)
      )
    `)
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Participants fetch error:', error);
    return [];
  }

  const result = participants.map((p: Participant & { participant_groups: { group: Group }[] | { group: Group } | null }) => {
    let group = null;
    const pg = p.participant_groups;
    if (pg) {
      if (Array.isArray(pg) && pg.length > 0) {
        group = pg[0]?.group ?? null;
      } else if (!Array.isArray(pg) && typeof pg === 'object') {
        group = (pg as { group: Group }).group ?? null;
      }
    }
    const { participant_groups: _pg, ...rest } = p as typeof p & { participant_groups: unknown };
    void _pg;
    return { ...rest, group };
  });

  // Serializuj do plain objects dla Client Components
  return JSON.parse(JSON.stringify(result));
}

export async function getParticipant(id: string): Promise<ParticipantWithGroup | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Sprawdź rolę użytkownika
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Najpierw pobierz uczestnika
  let participantQuery = supabase
    .from('participants')
    .select('*')
    .eq('id', id);

  // Rodzic może widzieć tylko swoje dzieci
  if (profile?.role !== 'admin') {
    participantQuery = participantQuery.eq('parent_id', user.id);
  }

  const { data: participant, error: participantError } = await participantQuery.single();

  if (participantError || !participant) {
    console.error('Participant fetch error:', participantError);
    return null;
  }

  // Oddzielnie pobierz przypisanie do grupy
  const { data: participantGroup, error: pgError } = await supabase
    .from('participant_groups')
    .select('group_id')
    .eq('participant_id', id)
    .maybeSingle();

  let group = null;

  if (participantGroup?.group_id) {
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', participantGroup.group_id)
      .single();

    group = groupData;
  }

  const result = {
    ...participant,
    group,
  };

  // Serializuj do plain objects
  return JSON.parse(JSON.stringify(result));
}

export async function getParticipantFull(id: string): Promise<ParticipantFull | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  let query = supabase
    .from('participants')
    .select(`
      *,
      parent:profiles!parent_id (*),
      participant_groups (
        group:groups (*)
      ),
      custom_fields:participant_custom_fields (*)
    `)
    .eq('id', id);

  if (profile?.role !== 'admin') {
    query = query.eq('parent_id', user.id);
  }

  const { data: participant, error } = await query.single();

  if (error) {
    console.error('Participant fetch error:', error);
    return null;
  }

  // Obsłuż przypadek gdy participant_groups jest obiektem lub tablicą
  let group = null;
  const pg = participant.participant_groups;

  if (pg) {
    if (Array.isArray(pg) && pg.length > 0) {
      // Jeśli to tablica (wiele grup)
      group = pg[0]?.group || null;
    } else if (!Array.isArray(pg) && typeof pg === 'object') {
      // Jeśli to obiekt (jedna grupa - Supabase zwraca obiekt dla relacji 1:1)
      group = (pg as { group: unknown }).group || null;
    }
  }

  const result = {
    ...participant,
    group,
  };

  // Serializuj do plain objects
  return JSON.parse(JSON.stringify(result));
}

export async function createParticipant(formData: ParticipantInput & { custom_fields?: Record<string, string> }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Walidacja
  const result = participantSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { first_name, last_name, birth_date, height_cm, group_id } = result.data;
  const { custom_fields } = formData;

  // Utwórz uczestnika
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .insert({
      parent_id: user.id,
      first_name,
      last_name,
      birth_date,
      height_cm: height_cm || null,
    })
    .select()
    .single();

  if (participantError) {
    console.error('Participant create error:', participantError);
    return { error: 'Nie udało się dodać dziecka' };
  }

  // Przypisz do grupy jeśli wybrana
  if (group_id) {
    const { error: groupError } = await supabase
      .from('participant_groups')
      .insert({
        participant_id: participant.id,
        group_id,
        assigned_by: user.id,
      });

    if (groupError) {
      console.error('Group assignment error:', groupError);
      // Kontynuuj mimo błędu przypisania grupy
    }
  }

  // Zapisz custom fields
  if (custom_fields && Object.keys(custom_fields).length > 0) {
    const customFieldsData = Object.entries(custom_fields).map(([field_name, field_value]) => ({
      participant_id: participant.id,
      field_name,
      field_value,
    }));

    const { error: customFieldsError } = await supabase
      .from('participant_custom_fields')
      .insert(customFieldsData);

    if (customFieldsError) {
      console.error('Custom fields error:', customFieldsError);
    }
  }

  revalidatePath('/parent/children');
  revalidatePath('/admin/participants');
  return { success: true, data: participant };
}

export async function updateParticipant(
  id: string,
  formData: ParticipantInput & { custom_fields?: Record<string, string> }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź rolę
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Walidacja
  const result = participantSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { first_name, last_name, birth_date, height_cm, group_id } = result.data;
  const { custom_fields } = formData;

  // Aktualizuj uczestnika
  let updateQuery = supabase
    .from('participants')
    .update({
      first_name,
      last_name,
      birth_date,
      height_cm: height_cm || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Rodzic może edytować tylko swoje dzieci
  if (profile?.role !== 'admin') {
    updateQuery = updateQuery.eq('parent_id', user.id);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) {
    console.error('Participant update error:', updateError);
    return { error: 'Nie udało się zaktualizować danych dziecka' };
  }

  // Aktualizuj grupę
  // Najpierw usuń istniejące przypisanie
  const { error: deleteError } = await supabase
    .from('participant_groups')
    .delete()
    .eq('participant_id', id);

  // Przypisz nową grupę jeśli wybrana
  if (group_id) {
    const { error: groupError } = await supabase
      .from('participant_groups')
      .insert({
        participant_id: id,
        group_id,
        assigned_by: user.id,
      })
      .select();

    if (groupError) {
      console.error('Group assignment error:', groupError);
      return { error: 'Nie udało się przypisać do grupy: ' + groupError.message };
    }
  }

  // Aktualizuj custom fields
  if (custom_fields) {
    // Usuń istniejące
    await supabase
      .from('participant_custom_fields')
      .delete()
      .eq('participant_id', id);

    // Dodaj nowe
    if (Object.keys(custom_fields).length > 0) {
      const customFieldsData = Object.entries(custom_fields).map(([field_name, field_value]) => ({
        participant_id: id,
        field_name,
        field_value,
      }));

      await supabase
        .from('participant_custom_fields')
        .insert(customFieldsData);
    }
  }

  revalidatePath('/parent/children');
  revalidatePath(`/parent/children/${id}`);
  revalidatePath('/admin/participants');
  revalidatePath(`/admin/participants/${id}`);
  return { success: true };
}

export async function deleteParticipant(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź rolę
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Pobierz informacje o zapisach na wyjazdy przed usunięciem
  const { data: registrations } = await supabase
    .from('trip_registrations')
    .select(`
      id,
      trip:trips (id, title),
      payments (id, status, amount, amount_paid, currency)
    `)
    .eq('participant_id', id);

  // Usuń uczestnika
  let deleteQuery = supabase
    .from('participants')
    .delete()
    .eq('id', id);

  // Rodzic może usuwać tylko swoje dzieci
  if (profile?.role !== 'admin') {
    deleteQuery = deleteQuery.eq('parent_id', user.id);
  }

  const { error } = await deleteQuery;

  if (error) {
    console.error('Participant delete error:', error);
    return { error: 'Nie udało się usunąć dziecka' };
  }

  revalidatePath('/parent/children');
  revalidatePath('/admin/participants');

  return {
    success: true,
    deletedRegistrations: registrations?.length || 0
  };
}

export async function getParticipantRegistrations(id: string) {
  const supabase = await createClient();

  const { data: registrations, error } = await supabase
    .from('trip_registrations')
    .select(`
      id,
      status,
      created_at,
      trip:trips (id, title, status, departure_datetime),
      payments (id, status, amount, amount_paid, currency)
    `)
    .eq('participant_id', id)
    .eq('status', 'active');

  if (error) {
    console.error('Registrations fetch error:', error);
    return [];
  }

  return registrations;
}

// Admin functions

export async function getAllParticipants(): Promise<ParticipantFull[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Sprawdź czy admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return [];

  const { data: participants, error } = await supabase
    .from('participants')
    .select(`
      *,
      parent:profiles!parent_id (*),
      participant_groups (
        group:groups (*)
      ),
      custom_fields:participant_custom_fields (*)
    `)
    .order('last_name', { ascending: true });

  if (error) {
    console.error('Participants fetch error:', error);
    return [];
  }

  return participants.map((p: Participant & {
    parent: unknown;
    participant_groups: { group: Group }[] | { group: Group };
    custom_fields: unknown[]
  }) => {
    // Obsłuż przypadek gdy participant_groups jest obiektem lub tablicą
    let group = null;
    const pg = p.participant_groups;

    if (pg) {
      if (Array.isArray(pg) && pg.length > 0) {
        group = pg[0]?.group || null;
      } else if (!Array.isArray(pg) && typeof pg === 'object') {
        group = (pg as { group: Group }).group || null;
      }
    }

    return {
      ...p,
      group,
    };
  }) as ParticipantFull[];
}

export async function assignParticipantToGroup(participantId: string, groupId: string | null) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź czy admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  // Usuń istniejące przypisanie
  await supabase
    .from('participant_groups')
    .delete()
    .eq('participant_id', participantId);

  // Przypisz nową grupę
  if (groupId) {
    const { error } = await supabase
      .from('participant_groups')
      .insert({
        participant_id: participantId,
        group_id: groupId,
        assigned_by: user.id,
      });

    if (error) {
      console.error('Group assignment error:', error);
      return { error: 'Nie udało się przypisać do grupy' };
    }
  }

  revalidatePath('/admin/participants');
  revalidatePath('/admin/groups');
  return { success: true };
}

export async function updateParticipantNote(participantId: string, notes: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  // Sprawdź czy admin lub rodzic tego dziecka
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: participant } = await supabase
    .from('participants')
    .select('parent_id')
    .eq('id', participantId)
    .single();

  if (profile?.role !== 'admin' && participant?.parent_id !== user.id) {
    return { error: 'Brak uprawnień' };
  }

  const { error } = await supabase
    .from('participants')
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', participantId);

  if (error) {
    console.error('Note update error:', error);
    return { error: `Nie udało się zapisać notatki: ${error.message}` };
  }

  revalidatePath('/admin/participants');
  revalidatePath('/parent/children');
  return { success: true };
}

// deleteParticipants jest zdefiniowana w groups.ts (lepsza wersja z kontrolą rejestracji)
