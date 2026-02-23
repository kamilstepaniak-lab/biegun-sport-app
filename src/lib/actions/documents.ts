'use server';

import { revalidatePath } from 'next/cache';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { GLOBAL_DOCUMENTS } from '@/lib/global-documents';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

/**
 * Pobiera treść dokumentu globalnego.
 * Jeśli istnieje nadpisana wersja w bazie, zwraca ją.
 * W przeciwnym razie zwraca domyślną treść z kodu.
 */
export async function getGlobalDocument(id: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('global_documents')
      .select('content')
      .eq('id', id)
      .single();
    if (data?.content) return data.content;
  } catch {
    // tabela może jeszcze nie istnieć — fallback na domyślną treść
  }
  const doc = GLOBAL_DOCUMENTS.find((d) => d.id === id);
  return doc?.defaultContent ?? '';
}

/**
 * Pobiera wszystkie dokumenty dodane ręcznie przez admina (nie ma ich w GLOBAL_DOCUMENTS).
 */
export async function getDynamicDocuments(): Promise<{ id: string; title: string; content: string }[]> {
  try {
    const supabase = await createClient();
    const staticIds = GLOBAL_DOCUMENTS.map((d) => d.id);
    const { data } = await supabase
      .from('global_documents')
      .select('id, title, content')
      .not('id', 'in', `(${staticIds.join(',')})`)
      .order('updated_at', { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Zapisuje (lub nadpisuje) treść dokumentu globalnego w bazie.
 * Wymaga roli admin.
 */
export async function saveGlobalDocument(
  id: string,
  content: string
): Promise<{ error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  const title = GLOBAL_DOCUMENTS.find((d) => d.id === id)?.title ?? id;

  const { error } = await supabaseAdmin.from('global_documents').upsert(
    { id, title, content, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );

  if (error) return { error: error.message };

  revalidatePath('/admin/contracts');
  revalidatePath('/parent/contracts');
  return {};
}

/**
 * Tworzy nowy dokument (dodany ręcznie przez admina).
 * Wymaga roli admin.
 */
export async function createDynamicDocument(
  title: string,
  content: string
): Promise<{ error?: string; id?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  if (!title.trim()) return { error: 'Tytuł jest wymagany' };

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin.from('global_documents').insert({
    id,
    title: title.trim(),
    content: content.trim(),
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/contracts');
  revalidatePath('/parent/contracts');
  return { id };
}

/**
 * Aktualizuje tytuł i treść dokumentu dynamicznego.
 * Wymaga roli admin.
 */
export async function updateDynamicDocument(
  id: string,
  title: string,
  content: string
): Promise<{ error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('global_documents')
    .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/contracts');
  revalidatePath('/parent/contracts');
  return {};
}

/**
 * Usuwa dokument dynamiczny z bazy.
 * Wymaga roli admin.
 */
export async function deleteDynamicDocument(id: string): Promise<{ error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from('global_documents').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/contracts');
  revalidatePath('/parent/contracts');
  return {};
}

/**
 * Przywraca domyślną treść dokumentu statycznego (usuwa nadpisanie z bazy).
 * Wymaga roli admin.
 */
export async function resetGlobalDocument(id: string): Promise<{ error?: string }> {
  const user = await requireAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from('global_documents').delete().eq('id', id);

  revalidatePath('/admin/contracts');
  revalidatePath('/parent/contracts');
  return {};
}
