'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';

interface EmbedFormSettings {
  title?: string;
  description?: string;
  buttonText?: string;
  successMessage?: string;
  requirePhone?: boolean;
  requireBirthDate?: boolean;
  maxRegistrations?: string;
  isActive?: boolean;
}

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}

export async function createEmbedForm(tripId: string, settings: EmbedFormSettings) {
  const user = await checkAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const admin = createAdminClient();

  const maxReg = settings.maxRegistrations && parseInt(settings.maxRegistrations) > 0
    ? parseInt(settings.maxRegistrations)
    : null;

  const { data, error } = await admin
    .from('trip_embed_forms')
    .insert({
      trip_id: tripId,
      title: settings.title || null,
      description: settings.description || null,
      button_text: settings.buttonText || 'Zapisz dziecko',
      success_message: settings.successMessage || 'Dziękujemy za rejestrację!',
      require_phone: settings.requirePhone ?? true,
      require_child_birth_date: settings.requireBirthDate ?? false,
      max_registrations: maxReg,
    })
    .select('*')
    .single();

  if (error) {
    console.error('createEmbedForm error:', error);
    return { error: 'Nie udało się utworzyć formularza' };
  }

  return { form: data };
}

export async function updateEmbedForm(formId: string, settings: EmbedFormSettings) {
  const user = await checkAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (settings.title !== undefined) updates.title = settings.title || null;
  if (settings.description !== undefined) updates.description = settings.description || null;
  if (settings.buttonText !== undefined) updates.button_text = settings.buttonText;
  if (settings.successMessage !== undefined) updates.success_message = settings.successMessage;
  if (settings.requirePhone !== undefined) updates.require_phone = settings.requirePhone;
  if (settings.requireBirthDate !== undefined) updates.require_child_birth_date = settings.requireBirthDate;
  if (settings.isActive !== undefined) updates.is_active = settings.isActive;
  if (settings.maxRegistrations !== undefined) {
    updates.max_registrations = settings.maxRegistrations && parseInt(settings.maxRegistrations) > 0
      ? parseInt(settings.maxRegistrations)
      : null;
  }

  const { data, error } = await admin
    .from('trip_embed_forms')
    .update(updates)
    .eq('id', formId)
    .select('*')
    .single();

  if (error) {
    console.error('updateEmbedForm error:', error);
    return { error: 'Nie udało się zaktualizować formularza' };
  }

  return { form: data };
}

export async function getEmbedFormSubmissions(formId: string) {
  const user = await checkAdmin();
  if (!user) return { error: 'Brak uprawnień' };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('embed_form_submissions')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false });

  if (error) return { error: 'Błąd pobierania zgłoszeń' };
  return { submissions: data };
}
