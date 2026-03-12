'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  variables: { key: string; desc: string }[];
  updated_at: string;
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { supabase, user, role } = await getAuthUser();
  if (!user || role !== 'admin') return [];

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('id');

  if (error) {
    console.error('Email templates fetch error:', error);
    return [];
  }

  return data as EmailTemplate[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const { user, role } = await getAuthUser();
  if (!user || role !== 'admin') return null;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(
  id: string,
  subject: string,
  body_html: string,
) {
  const { supabase, user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const { error } = await supabase
    .from('email_templates')
    .update({ subject, body_html, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Update email template error:', error);
    return { error: 'Nie udało się zapisać szablonu' };
  }

  revalidatePath('/admin/settings/email-templates');
  return { success: true };
}
