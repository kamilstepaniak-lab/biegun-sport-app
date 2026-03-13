'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';

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
  sender_id: string;
  read_count: number;
}

export async function getMessagesForParent(): Promise<AppMessage[]> {
  const { user } = await getAuthUser();
  const supabaseAdmin = createAdminClient();

  if (!user) return [];

  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('id, title, body, created_at, sender_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !messages) return [];

  if (messages.length === 0) return [];

  const messageIds = messages.map((m: { id: string }) => m.id);
  const { data: reads } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .eq('user_id', user.id)
    .in('message_id', messageIds);

  const readSet = new Set((reads || []).map((r: { message_id: string }) => r.message_id));

  return messages.map(
    (m: { id: string; title: string; body: string; created_at: string; sender_id: string }) => ({
      ...m,
      is_read: readSet.has(m.id),
    })
  );
}

export async function markMessageRead(messageId: string): Promise<{ success?: boolean; error?: string }> {
  const { user } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const supabaseAdmin = createAdminClient();
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

export async function createMessage(
  title: string,
  body: string
): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  if (!title.trim() || !body.trim()) return { error: 'Tytuł i treść są wymagane' };

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from('messages').insert({
    title: title.trim(),
    body: body.trim(),
    sender_id: user.id,
  });

  if (error) {
    console.error('createMessage error:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/messages');
  return { success: true };
}

export async function deleteMessage(messageId: string): Promise<{ success?: boolean; error?: string }> {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from('messages').delete().eq('id', messageId);

  if (error) {
    console.error('deleteMessage error:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/messages');
  return { success: true };
}

export async function getAdminMessages(): Promise<AdminMessage[]> {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const supabaseAdmin = createAdminClient();
  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('id, title, body, created_at, sender_id')
    .order('created_at', { ascending: false });

  if (error || !messages) return [];

  if (messages.length === 0) return [];

  // Count reads per message
  const messageIds = messages.map((m: { id: string }) => m.id);
  const { data: reads } = await supabaseAdmin
    .from('message_reads')
    .select('message_id')
    .in('message_id', messageIds);

  const readCountMap = new Map<string, number>();
  (reads || []).forEach((r: { message_id: string }) => {
    readCountMap.set(r.message_id, (readCountMap.get(r.message_id) || 0) + 1);
  });

  return messages.map(
    (m: { id: string; title: string; body: string; created_at: string; sender_id: string }) => ({
      ...m,
      read_count: readCountMap.get(m.id) || 0,
    })
  );
}
