'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { logActivity } from './activity-logs';

export interface AppMessage {
  id: string;
  title: string;
  body: string;
  created_at: string;
  sender_id: string;
  is_read: boolean;
}

export interface AdminMessage {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  sender_id: string;
  target_group_ids: string[] | null;
  read_count: number;
  audience_count: number;
}

export interface MessageReadDetail {
  user_id: string;
  name: string;
  email: string;
  is_read: boolean;
  read_at: string | null;
}

// Zwraca zbiór id grup, do których należą dzieci danego rodzica
async function getParentGroupIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  parentId: string
): Promise<Set<string>> {
  const { data: kids } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('parent_id', parentId);

  const kidIds = (kids || []).map((k: { id: string }) => k.id);
  if (kidIds.length === 0) return new Set();

  const { data: pgs } = await supabaseAdmin
    .from('participant_groups')
    .select('group_id')
    .in('participant_id', kidIds);

  return new Set((pgs || []).map((p: { group_id: string }) => p.group_id));
}

function messageMatchesGroups(
  targetGroupIds: string[] | null,
  parentGroupIds: Set<string>
): boolean {
  if (!targetGroupIds || targetGroupIds.length === 0) return true;
  return targetGroupIds.some((g) => parentGroupIds.has(g));
}

// cache() — layout (badge nieprzeczytanych) i strona „Moje dzieci" dzielą jedno zapytanie.
export const getMessagesForParent = cache(async (): Promise<AppMessage[]> => {
  const { user } = await getAuthUser();
  const supabaseAdmin = createAdminClient();

  if (!user) return [];

  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('id, title, body, created_at, sender_id, target_group_ids')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error || !messages || messages.length === 0) return [];

  const parentGroupIds = await getParentGroupIds(supabaseAdmin, user.id);

  const visible = messages
    .filter((m: { target_group_ids: string[] | null }) =>
      messageMatchesGroups(m.target_group_ids, parentGroupIds)
    )
    .slice(0, 20);

  if (visible.length === 0) return [];

  const messageIds = visible.map((m: { id: string }) => m.id);
  const { data: reads } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .eq('user_id', user.id)
    .in('message_id', messageIds);

  const readSet = new Set((reads || []).map((r: { message_id: string }) => r.message_id));

  return visible.map(
    (m: { id: string; title: string; body: string; created_at: string; sender_id: string }) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      created_at: m.created_at,
      sender_id: m.sender_id,
      is_read: readSet.has(m.id),
    })
  );
});

export async function markMessageRead(messageId: string): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const supabaseAdmin = createAdminClient();

  // Admini mogą oznaczać dowolną wiadomość. Rodzic — tylko te, które są
  // skierowane do jego grup (lub wiadomości globalne bez target_group_ids).
  if (role !== 'admin') {
    const { data: msg } = await supabaseAdmin
      .from('messages')
      .select('id, target_group_ids')
      .eq('id', messageId)
      .maybeSingle();

    if (!msg) return { error: 'Wiadomość nie istnieje' };

    const parentGroupIds = await getParentGroupIds(supabaseAdmin, user.id);
    if (!messageMatchesGroups(msg.target_group_ids, parentGroupIds)) {
      return { error: 'Brak dostępu do tej wiadomości' };
    }
  }

  const { error } = await supabaseAdmin
    .from('message_reads')
    .upsert(
      { message_id: messageId, user_id: user.id },
      { onConflict: 'message_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('markMessageRead error:', error);
    return { error: error.message };
  }

  return { success: true };
}

function normalizeGroupIds(targetGroupIds?: string[] | null): string[] | null {
  if (!targetGroupIds || targetGroupIds.length === 0) return null;
  return targetGroupIds;
}

export async function createMessage(
  title: string,
  body: string,
  targetGroupIds?: string[] | null
): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  if (!title.trim() || !body.trim()) return { error: 'Tytuł i treść są wymagane' };

  const supabaseAdmin = createAdminClient();
  const normalized = normalizeGroupIds(targetGroupIds);
  const { error } = await supabaseAdmin.from('messages').insert({
    title: title.trim(),
    body: body.trim(),
    sender_id: user.id,
    target_group_ids: normalized,
  });

  if (error) {
    console.error('createMessage error:', error);
    return { error: error.message };
  }

  logActivity(user.id, user.email, 'message_created', {
    title: title.trim(),
    targetGroupIds: normalized,
  }).catch(console.error);

  revalidatePath('/admin/messages');
  return { success: true };
}

export async function updateMessage(
  messageId: string,
  title: string,
  body: string,
  targetGroupIds?: string[] | null
): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  if (!title.trim() || !body.trim()) return { error: 'Tytuł i treść są wymagane' };

  const supabaseAdmin = createAdminClient();
  const normalized = normalizeGroupIds(targetGroupIds);
  const { error } = await supabaseAdmin
    .from('messages')
    .update({
      title: title.trim(),
      body: body.trim(),
      target_group_ids: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (error) {
    console.error('updateMessage error:', error);
    return { error: error.message };
  }

  logActivity(user.id, user.email, 'message_updated', {
    messageId,
    title: title.trim(),
    targetGroupIds: normalized,
  }).catch(console.error);

  revalidatePath('/admin/messages');
  return { success: true };
}

export async function deleteMessage(messageId: string): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  const { data: snapshot } = await supabaseAdmin
    .from('messages')
    .select('title, target_group_ids')
    .eq('id', messageId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('messages').delete().eq('id', messageId);

  if (error) {
    console.error('deleteMessage error:', error);
    return { error: error.message };
  }

  logActivity(user.id, user.email, 'message_deleted', {
    messageId,
    title: snapshot?.title,
  }).catch(console.error);

  revalidatePath('/admin/messages');
  return { success: true };
}

// Zwraca id rodziców będących odbiorcami wiadomości (globalnej lub grupowej)
async function getAudienceParentIds(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  targetGroupIds: string[] | null
): Promise<string[]> {
  if (!targetGroupIds || targetGroupIds.length === 0) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'parent');
    return (data || []).map((p: { id: string }) => p.id);
  }

  const { data: pgs } = await supabaseAdmin
    .from('participant_groups')
    .select('participant_id')
    .in('group_id', targetGroupIds);

  const partIds = [...new Set((pgs || []).map((p: { participant_id: string }) => p.participant_id))];
  if (partIds.length === 0) return [];

  const { data: parts } = await supabaseAdmin
    .from('participants')
    .select('parent_id')
    .in('id', partIds);

  return [...new Set((parts || []).map((p: { parent_id: string }) => p.parent_id))];
}

export async function getAdminMessages(): Promise<AdminMessage[]> {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const supabaseAdmin = createAdminClient();
  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('id, title, body, created_at, updated_at, sender_id, target_group_ids')
    .order('created_at', { ascending: false });

  if (error || !messages || messages.length === 0) return [];

  const messageIds = messages.map((m: { id: string }) => m.id);
  const { data: reads } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .in('message_id', messageIds);

  const readCountMap = new Map<string, number>();
  (reads || []).forEach((r: { message_id: string }) => {
    readCountMap.set(r.message_id, (readCountMap.get(r.message_id) || 0) + 1);
  });

  // Liczność widowni: globalna liczona raz, grupowe per zestaw grup
  const { count: globalAudience } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'parent');

  const result: AdminMessage[] = [];
  for (const m of messages as Array<{
    id: string;
    title: string;
    body: string;
    created_at: string;
    updated_at: string;
    sender_id: string;
    target_group_ids: string[] | null;
  }>) {
    let audience = globalAudience || 0;
    if (m.target_group_ids && m.target_group_ids.length > 0) {
      const parentIds = await getAudienceParentIds(supabaseAdmin, m.target_group_ids);
      audience = parentIds.length;
    }
    result.push({
      id: m.id,
      title: m.title,
      body: m.body,
      created_at: m.created_at,
      updated_at: m.updated_at,
      sender_id: m.sender_id,
      target_group_ids: m.target_group_ids,
      read_count: readCountMap.get(m.id) || 0,
      audience_count: audience,
    });
  }

  return result;
}

export async function getMessageReadDetails(
  messageId: string
): Promise<MessageReadDetail[]> {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const supabaseAdmin = createAdminClient();

  const { data: message } = await supabaseAdmin
    .from('messages')
    .select('target_group_ids')
    .eq('id', messageId)
    .single();

  if (!message) return [];

  const parentIds = await getAudienceParentIds(
    supabaseAdmin,
    message.target_group_ids as string[] | null
  );
  if (parentIds.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', parentIds);

  const { data: reads } = await supabaseAdmin
    .from('message_reads')
    .select('user_id, read_at')
    .eq('message_id', messageId)
    .in('user_id', parentIds);

  const readMap = new Map<string, string>();
  (reads || []).forEach((r: { user_id: string; read_at: string }) => {
    readMap.set(r.user_id, r.read_at);
  });

  const details: MessageReadDetail[] = (profiles || []).map(
    (p: { id: string; first_name: string | null; last_name: string | null; email: string }) => ({
      user_id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
      email: p.email,
      is_read: readMap.has(p.id),
      read_at: readMap.get(p.id) || null,
    })
  );

  // Najpierw przeczytane (wg daty), potem nieprzeczytani alfabetycznie
  return details.sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? -1 : 1;
    if (a.is_read && b.is_read) return (b.read_at || '').localeCompare(a.read_at || '');
    return a.name.localeCompare(b.name, 'pl');
  });
}
