'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notificationSchema, type NotificationInput } from '@/lib/validations/notification';
import { sendBulkEmails, verifyGmailConnection } from '@/lib/gmail';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Brak autoryzacji' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { error: 'Brak uprawnień administratora' };
  return { user };
}

/**
 * Pobiera adresy email odbiorców na podstawie konfiguracji powiadomienia.
 * Zwraca { email, profileId } dla każdego unikalnego odbiorcy.
 */
async function resolveRecipients(
  data: NotificationInput
): Promise<{ email: string; profileId: string }[]> {
  const admin = createAdminClient();

  let query = admin.from('profiles').select('id, email').eq('role', 'parent');

  switch (data.target_type) {
    case 'all':
      // wszyscy rodzice – bez dodatkowych filtrów
      break;

    case 'group':
      // rodzice uczestników należących do danej grupy
      if (!data.target_group_id) return [];
      {
        const { data: participantGroups } = await admin
          .from('participant_groups')
          .select('participant_id')
          .eq('group_id', data.target_group_id);

        const participantIds = participantGroups?.map((pg) => pg.participant_id) ?? [];
        if (participantIds.length === 0) return [];

        const { data: participants } = await admin
          .from('participants')
          .select('parent_id')
          .in('id', participantIds);

        const parentIds = [...new Set(participants?.map((p) => p.parent_id) ?? [])];
        if (parentIds.length === 0) return [];

        query = query.in('id', parentIds);
      }
      break;

    case 'trip':
      // rodzice uczestników zapisanych na dany wyjazd
      if (!data.target_trip_id) return [];
      {
        const { data: registrations } = await admin
          .from('trip_registrations')
          .select('participant_id')
          .eq('trip_id', data.target_trip_id)
          .eq('status', 'active');

        const participantIds = registrations?.map((r) => r.participant_id) ?? [];
        if (participantIds.length === 0) return [];

        const { data: participants } = await admin
          .from('participants')
          .select('parent_id')
          .in('id', participantIds);

        const parentIds = [...new Set(participants?.map((p) => p.parent_id) ?? [])];
        if (parentIds.length === 0) return [];

        query = query.in('id', parentIds);
      }
      break;

    case 'individual':
      if (!data.target_user_id) return [];
      query = query.eq('id', data.target_user_id);
      break;
  }

  const { data: profiles } = await query;
  return (profiles ?? []).map((p) => ({ email: p.email, profileId: p.id }));
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Tworzy powiadomienie (wersja robocza)
 */
export async function createNotification(formData: NotificationInput) {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };
  const { user } = authResult;

  const result = notificationSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const admin = createAdminClient();

  // Oblicz liczbę odbiorców przed zapisem
  const recipients = await resolveRecipients(result.data);

  const { data, error } = await admin
    .from('notifications')
    .insert({
      ...result.data,
      status: 'draft',
      created_by: user!.id,
      recipient_count: recipients.length,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createNotification error:', error);
    return { error: 'Nie udało się utworzyć powiadomienia' };
  }

  revalidatePath('/admin/notifications');
  return { success: true, id: data.id, recipientCount: recipients.length };
}

/**
 * Pobiera listę powiadomień
 */
export async function getNotifications() {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { error: 'Nie udało się pobrać powiadomień' };
  return { data };
}

/**
 * Zatwierdza powiadomienie (admin może następnie je wysłać)
 */
export async function approveNotification(notificationId: string) {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };
  const { user } = authResult;

  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .update({
      status: 'approved',
      approved_by: user!.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('status', 'draft');

  if (error) return { error: 'Nie udało się zatwierdzić powiadomienia' };

  revalidatePath('/admin/notifications');
  return { success: true };
}

/**
 * Wysyła zatwierdzone powiadomienie przez Gmail do wszystkich odbiorców.
 * Zapisuje logi wysyłki w tabeli notification_logs.
 */
export async function sendNotification(notificationId: string) {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };

  const admin = createAdminClient();

  // Pobierz powiadomienie
  const { data: notification, error: fetchError } = await admin
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (fetchError || !notification) {
    return { error: 'Nie znaleziono powiadomienia' };
  }

  if (notification.status !== 'approved') {
    return { error: 'Powiadomienie musi być zatwierdzone przed wysłaniem' };
  }

  if (notification.channel === 'sms') {
    return { error: 'Wysyłanie SMS nie jest jeszcze obsługiwane' };
  }

  // Rozwiąż odbiorców
  const recipients = await resolveRecipients(notification as NotificationInput);

  if (recipients.length === 0) {
    return { error: 'Brak odbiorców dla tego powiadomienia' };
  }

  // Wyślij emaile przez Gmail
  const emailRecipients = recipients.map((r) => r.email);
  const results = await sendBulkEmails(
    emailRecipients,
    notification.subject,
    notification.body
  );

  // Zapisz logi wysyłki
  const logs = results.map((result) => {
    const recipient = recipients.find((r) => r.email === result.email)!;
    return {
      notification_id: notificationId,
      recipient_id: recipient.profileId,
      recipient_email: result.email,
      channel: 'email' as const,
      status: result.success ? ('sent' as const) : ('failed' as const),
      sent_at: new Date().toISOString(),
      error_message: result.error ?? null,
    };
  });

  await admin.from('notification_logs').insert(logs);

  const sentCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const overallStatus = failedCount === 0 ? 'sent' : sentCount > 0 ? 'sent' : 'failed';

  // Zaktualizuj status powiadomienia
  await admin
    .from('notifications')
    .update({
      status: overallStatus,
      sent_at: new Date().toISOString(),
      recipient_count: recipients.length,
    })
    .eq('id', notificationId);

  revalidatePath('/admin/notifications');
  return { success: true, sentCount, failedCount };
}

/**
 * Pobiera logi wysyłki dla konkretnego powiadomienia
 */
export async function getNotificationLogs(notificationId: string) {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('notification_logs')
    .select('*')
    .eq('notification_id', notificationId)
    .order('sent_at', { ascending: false });

  if (error) return { error: 'Nie udało się pobrać logów' };
  return { data };
}

/**
 * Usuwa powiadomienie w statusie draft
 */
export async function deleteNotification(notificationId: string) {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };

  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('status', 'draft');

  if (error) return { error: 'Nie udało się usunąć powiadomienia. Można usuwać tylko wersje robocze.' };

  revalidatePath('/admin/notifications');
  return { success: true };
}

/**
 * Weryfikuje połączenie z Gmail (do panelu ustawień)
 */
export async function checkGmailConnection() {
  const authResult = await requireAdmin();
  if (authResult.error) return { error: authResult.error };

  return verifyGmailConnection();
}
