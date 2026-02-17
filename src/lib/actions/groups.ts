'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { Group, ParticipantWithParent } from '@/types';

export async function getGroups(): Promise<Group[]> {
  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from('groups')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Groups fetch error:', error);
    return [];
  }

  return groups;
}

export async function getSelectableGroups(): Promise<Group[]> {
  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from('groups')
    .select('*')
    .eq('is_selectable_by_parent', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Groups fetch error:', error);
    return [];
  }

  return groups;
}

export async function getGroup(id: string): Promise<Group | null> {
  const supabase = await createClient();

  const { data: group, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Group fetch error:', error);
    return null;
  }

  return group;
}

export async function getGroupParticipants(groupId: string): Promise<ParticipantWithParent[]> {
  const supabase = await createClient();

  const { data: participants, error } = await supabase
    .from('participant_groups')
    .select(`
      participant:participants (
        *,
        parent:profiles!parent_id (*)
      )
    `)
    .eq('group_id', groupId);

  if (error) {
    console.error('Group participants fetch error:', error);
    return [];
  }

  return participants
    .map((p: { participant: ParticipantWithParent | ParticipantWithParent[] | null }) => {
      if (Array.isArray(p.participant)) {
        return p.participant[0];
      }
      return p.participant;
    })
    .filter((p): p is ParticipantWithParent => p !== null && p !== undefined);
}

export async function getGroupsWithCounts(): Promise<(Group & { participantCount: number })[]> {
  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      *,
      participant_groups (count)
    `)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Groups fetch error:', error);
    return [];
  }

  return groups.map((g: Group & { participant_groups: { count: number }[] }) => ({
    ...g,
    participantCount: g.participant_groups?.[0]?.count || 0,
  }));
}

export interface ParticipantInGroup {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  height_cm: number | null;
  notes: string | null;
  parent: {
    email: string;
    phone: string;
    secondary_email: string | null;
    secondary_phone: string | null;
  };
}

export interface GroupWithParticipants extends Group {
  participantCount: number;
  participants: ParticipantInGroup[];
}

export async function getGroupsWithParticipants(): Promise<GroupWithParticipants[]> {
  const supabase = await createClient();

  // Pobierz wszystkie grupy
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .order('display_order', { ascending: true });

  if (groupsError || !groups) {
    console.error('Groups fetch error:', groupsError);
    return [];
  }

  // Dla każdej grupy pobierz uczestników
  const result = await Promise.all(
    groups.map(async (group: Group) => {
      const { data: participantGroups, error: pgError } = await supabase
        .from('participant_groups')
        .select(`
          participant:participants (
            id,
            first_name,
            last_name,
            birth_date,
            height_cm,
            notes,
            parent:profiles!parent_id (
              email,
              phone,
              secondary_email,
              secondary_phone
            )
          )
        `)
        .eq('group_id', group.id);

      console.log(`Group ${group.name} (${group.id}):`, {
        participantGroups,
        error: pgError,
        count: participantGroups?.length
      });

      const participants: ParticipantInGroup[] = (participantGroups || [])
        .map((pg: unknown) => {
          const participantData = pg as { participant: unknown };
          let participant = participantData.participant;

          if (Array.isArray(participant)) {
            participant = participant[0];
          }

          if (!participant || typeof participant !== 'object') return null;

          const p = participant as {
            id: string;
            first_name: string;
            last_name: string;
            birth_date: string;
            height_cm: number | null;
            notes: string | null;
            parent: unknown;
          };

          // Handle parent which could be array or object
          let parentData = p.parent;
          if (Array.isArray(parentData)) {
            parentData = parentData[0];
          }

          const parent = parentData as {
            email: string;
            phone: string;
            secondary_email: string | null;
            secondary_phone: string | null;
          } | null;

          return {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
            height_cm: p.height_cm,
            notes: p.notes,
            parent: parent || { email: '', phone: '', secondary_email: null, secondary_phone: null },
          } as ParticipantInGroup;
        })
        .filter((p): p is ParticipantInGroup => p !== null && p !== undefined)
        .sort((a: ParticipantInGroup, b: ParticipantInGroup) => a.last_name.localeCompare(b.last_name, 'pl'));

      return {
        ...group,
        participantCount: participants.length,
        participants,
      };
    })
  );

  // Serializuj dla Client Components
  return JSON.parse(JSON.stringify(result));
}

// Usuń wielu uczestników naraz
export async function deleteParticipants(participantIds: string[]) {
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

  // Sprawdź czy uczestnicy nie mają aktywnych rejestracji
  const { data: registrations } = await supabaseAdmin
    .from('trip_registrations')
    .select('id, participant_id')
    .in('participant_id', participantIds)
    .eq('status', 'active');

  if (registrations && registrations.length > 0) {
    const participantsWithRegistrations = [...new Set(registrations.map(r => r.participant_id))];
    return {
      error: `Nie można usunąć ${participantsWithRegistrations.length} uczestników z aktywnymi rejestracjami na wyjazdy`
    };
  }

  // Usuń przypisania do grup
  const { error: groupsError } = await supabaseAdmin
    .from('participant_groups')
    .delete()
    .in('participant_id', participantIds);

  if (groupsError) {
    console.error('Delete participant groups error:', groupsError);
    return { error: 'Nie udało się usunąć przypisań do grup' };
  }

  // Usuń uczestników
  const { error: deleteError } = await supabaseAdmin
    .from('participants')
    .delete()
    .in('id', participantIds);

  if (deleteError) {
    console.error('Delete participants error:', deleteError);
    return { error: 'Nie udało się usunąć uczestników' };
  }

  revalidatePath('/admin/groups');
  return { success: true, deleted: participantIds.length };
}

// Dodaj nową grupę
export async function createGroup(name: string) {
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

  // Sprawdź czy grupa o takiej nazwie już istnieje
  const { data: existing } = await supabaseAdmin
    .from('groups')
    .select('id')
    .ilike('name', name.trim())
    .single();

  if (existing) {
    return { error: 'Grupa o takiej nazwie już istnieje' };
  }

  // Znajdź najwyższy display_order
  const { data: maxOrder } = await supabaseAdmin
    .from('groups')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const newOrder = (maxOrder?.display_order || 0) + 1;

  const { data: newGroup, error } = await supabaseAdmin
    .from('groups')
    .insert({
      name: name.trim(),
      display_order: newOrder,
      is_selectable_by_parent: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Create group error:', error);
    return { error: 'Nie udało się utworzyć grupy' };
  }

  revalidatePath('/admin/groups');
  revalidatePath('/admin/trips');
  return { success: true, data: newGroup };
}

// Usuń grupę (usuwa też powiązania z uczestnikami i wyjazdami)
export async function deleteGroup(groupId: string) {
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

  // Usuń przypisania uczestników do tej grupy
  const { error: participantGroupsError } = await supabaseAdmin
    .from('participant_groups')
    .delete()
    .eq('group_id', groupId);

  if (participantGroupsError) {
    console.error('Delete participant_groups error:', participantGroupsError);
  }

  // Usuń przypisania wyjazdów do tej grupy
  const { error: tripGroupsError } = await supabaseAdmin
    .from('trip_groups')
    .delete()
    .eq('group_id', groupId);

  if (tripGroupsError) {
    console.error('Delete trip_groups error:', tripGroupsError);
  }

  // Usuń grupę
  const { error } = await supabaseAdmin
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    console.error('Delete group error:', error);
    return { error: 'Nie udało się usunąć grupy' };
  }

  revalidatePath('/admin/groups');
  revalidatePath('/admin/trips');
  return { success: true };
}

// Zmień nazwę grupy
export async function renameGroup(groupId: string, newName: string) {
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

  // Sprawdź czy inna grupa o takiej nazwie już istnieje
  const { data: existing } = await supabaseAdmin
    .from('groups')
    .select('id')
    .ilike('name', newName.trim())
    .neq('id', groupId)
    .single();

  if (existing) {
    return { error: 'Grupa o takiej nazwie już istnieje' };
  }

  const { error } = await supabaseAdmin
    .from('groups')
    .update({ name: newName.trim() })
    .eq('id', groupId);

  if (error) {
    console.error('Rename group error:', error);
    return { error: 'Nie udało się zmienić nazwy grupy' };
  }

  revalidatePath('/admin/groups');
  revalidatePath('/admin/trips');
  return { success: true };
}
