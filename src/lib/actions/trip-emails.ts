'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import {
  sendTripEmail,
  buildTripDetailsHtml,
  type TripEmailData,
  type PaymentLineItem,
} from '@/lib/email';
import { logActivity } from './activity-logs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';


// ─── Podgląd e-maila (do edytora w dialogu wyjazdu) ──────────────────────────

/**
 * Pobiera szablon trip_info z bazy (lub używa domyślnego),
 * wypełnia zmienne danymi wyjazdu i zwraca gotowy HTML treści maila.
 * Używane przez dialog "Generuj wiadomość" żeby admin widział co wyśle.
 */
export async function getTripEmailPreview(tripId: string): Promise<{
  html?: string;
  subject?: string;
  error?: string;
}> {
  const supabaseAdmin = createAdminClient();

  // Pobierz dane wyjazdu — próbuj z nowymi kolumnami, jeśli błąd (migracja nie uruchomiona) — fallback bez nich
  const { data: tripFull, error: tripFullError } = await supabaseAdmin
    .from('trips')
    .select(`
      title, description, location,
      departure_datetime, departure_location,
      departure_stop2_datetime, departure_stop2_location,
      return_datetime, return_location,
      return_stop2_datetime, return_stop2_location,
      bank_account_pln, bank_account_eur,
      declaration_deadline, packing_list, additional_info
    `)
    .eq('id', tripId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let trip: any = tripFull;
  if (tripFullError || !tripFull) {
    // Fallback — kolumny packing_list/additional_info mogą jeszcze nie istnieć w bazie
    const { data: tripBasic } = await supabaseAdmin
      .from('trips')
      .select(`
        title, description, location,
        departure_datetime, departure_location,
        departure_stop2_datetime, departure_stop2_location,
        return_datetime, return_location,
        return_stop2_datetime, return_stop2_location,
        bank_account_pln, bank_account_eur,
        declaration_deadline
      `)
      .eq('id', tripId)
      .single();
    trip = tripBasic;
  }

  if (!trip) return { error: 'Nie znaleziono wyjazdu' };

  // Pobierz szablony płatności
  const { data: paymentTemplates } = await supabaseAdmin
    .from('trip_payment_templates')
    .select('payment_type, installment_number, amount, currency, due_date, payment_method')
    .eq('trip_id', tripId)
    .order('installment_number', { ascending: true });

  // Pobierz szablon trip_info z bazy (lub użyj domyślnego)
  const { data: templateRow } = await supabaseAdmin
    .from('email_templates')
    .select('subject, body_html')
    .eq('id', 'trip_info')
    .maybeSingle();

  const defaultSubject = `${trip.title} – informacja o wyjeździe`;
  const defaultBody = `<p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;">Informacja o wyjeździe 🏔️</p><p style="font-size:14px;color:#374151;margin:0 0 10px;">Szanowni Rodzice,</p><p style="font-size:14px;color:#374151;margin:0 0 16px;">Przekazujemy informacje o planowanym wyjeździe <strong>${trip.title}</strong>.</p>{{szczegoly_wyjazdu}}<p style="font-size:14px;color:#374151;margin:16px 0 10px;">W razie pytań prosimy o kontakt.<br>Pozdrawiamy,<br><strong>Zespół BiegunSport</strong></p>`;

  const templateSubject = templateRow?.subject
    ? templateRow.subject.replaceAll('{{wyjazd}}', trip.title)
    : defaultSubject;

  let templateBody = templateRow?.body_html || defaultBody;

  // Wygeneruj blok HTML z detalami wyjazdu
  const payments: PaymentLineItem[] = (paymentTemplates || []).map((pt) => ({
    payment_type: pt.payment_type,
    installment_number: pt.installment_number,
    amount: pt.amount,
    currency: pt.currency,
    due_date: pt.due_date,
    payment_method: pt.payment_method,
  }));

  const tripDetailsHtml = buildTripDetailsHtml(trip as TripEmailData, payments, `${APP_URL}/parent/trips`);

  // Zastąp zmienne
  templateBody = templateBody
    .replaceAll('{{wyjazd}}', trip.title)
    .replaceAll('{{szczegoly_wyjazdu}}', tripDetailsHtml);

  return {
    html: templateBody,
    subject: templateSubject,
  };
}

/**
 * Wysyła e-mail informacyjny o wyjeździe do wszystkich rodziców
 * dzieci przypisanych do grup powiązanych z tym wyjazdem.
 *
 * Jeśli customBodyHtml i customSubject są podane — wysyła dokładnie ten HTML
 * (z wrapperem BiegunSport) do wszystkich rodziców.
 *
 * Jeśli nie podano — generuje HTML automatycznie per-odbiorca (z filtrowaniem
 * płatności wg rocznika dziecka).
 */
export async function sendTripInfoEmailToGroup(
  tripId: string,
  customSubject?: string,
  customBodyHtml?: string,
): Promise<{
  success?: boolean;
  sent?: number;
  skipped?: number;
  error?: string;
}> {
  const { user, role } = await getAuthUser();
  const supabaseAdmin = createAdminClient();

  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  // Pobierz dane wyjazdu (tytuł zawsze potrzebny)
  const { data: trip, error: tripError } = await supabaseAdmin
    .from('trips')
    .select(`
      title, description, location,
      departure_datetime, departure_location,
      departure_stop2_datetime, departure_stop2_location,
      return_datetime, return_location,
      return_stop2_datetime, return_stop2_location,
      bank_account_pln, bank_account_eur,
      declaration_deadline, packing_list, additional_info
    `)
    .eq('id', tripId)
    .single();

  if (tripError || !trip) return { error: 'Nie znaleziono wyjazdu' };

  // Pobierz szablony płatności (potrzebne tylko w trybie auto)
  const { data: paymentTemplates } = customBodyHtml
    ? { data: null }
    : await supabaseAdmin
        .from('trip_payment_templates')
        .select('payment_type, installment_number, amount, currency, due_date, payment_method, birth_year_from, birth_year_to')
        .eq('trip_id', tripId)
        .order('installment_number', { ascending: true });

  // Pobierz grupy powiązane z wyjazdem
  const { data: tripGroups } = await supabaseAdmin
    .from('trip_groups')
    .select('group_id')
    .eq('trip_id', tripId);

  if (!tripGroups || tripGroups.length === 0) {
    return { error: 'Wyjazd nie ma przypisanych grup' };
  }

  const groupIds = tripGroups.map((tg) => tg.group_id);

  // Pobierz wszystkich uczestników z tych grup wraz z danymi rodziców
  const { data: participantGroups } = await supabaseAdmin
    .from('participant_groups')
    .select(`
      participant:participants (
        id, first_name, last_name, birth_date,
        parent:profiles!parent_id (id, email, first_name)
      )
    `)
    .in('group_id', groupIds);

  if (!participantGroups || participantGroups.length === 0) {
    return { error: 'Brak uczestników w grupach wyjazdu' };
  }

  // Deduplikuj po parent_id — jeden mail na rodzica (może mieć kilka dzieci)
  const parentsSeen = new Set<string>();
  const toSend: Array<{
    parentEmail: string;
    parentFirstName: string;
    childName: string;
    birthYear: number | null;
  }> = [];

  for (const pg of participantGroups) {
    const participant = pg.participant as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      birth_date: string | null;
      parent: { id: string; email: string; first_name: string } | null;
    } | null;

    if (!participant?.parent?.email) continue;

    const parentId = participant.parent.id;
    if (parentsSeen.has(parentId)) continue;
    parentsSeen.add(parentId);

    toSend.push({
      parentEmail: participant.parent.email,
      parentFirstName: participant.parent.first_name || '',
      childName: `${participant.first_name} ${participant.last_name}`,
      birthYear: participant.birth_date
        ? new Date(participant.birth_date).getFullYear()
        : null,
    });
  }

  let sent = 0;
  let skipped = 0;

  const subject = customSubject || `${trip.title} – informacja o wyjeździe`;
  // Link do listy wyjazdów rodzica w aplikacji
  const tripsAppUrl = `${APP_URL}/parent/trips`;

  for (const recipient of toSend) {
    try {
      if (customBodyHtml) {
        // Tryb: wyślij edytowany HTML admina
        await sendTripEmail(recipient.parentEmail, subject, customBodyHtml, tripId);
      } else {
        // Tryb: generuj HTML per-odbiorca (z filtrowaniem płatności wg rocznika)
        const emailPaymentLines: PaymentLineItem[] = (paymentTemplates || [])
          .filter((pt) => {
            if (pt.payment_type !== 'season_pass') return true;
            if (!recipient.birthYear) return true;
            if (pt.birth_year_from && recipient.birthYear < pt.birth_year_from) return false;
            if (pt.birth_year_to && recipient.birthYear > pt.birth_year_to) return false;
            return true;
          })
          .map((pt) => ({
            payment_type: pt.payment_type,
            installment_number: pt.installment_number,
            amount: pt.amount,
            currency: pt.currency,
            due_date: pt.due_date,
            payment_method: pt.payment_method,
          }));

        const tripDetailsHtml = buildTripDetailsHtml(trip as TripEmailData, emailPaymentLines, tripsAppUrl);
        const autoBodyHtml = `<p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;">Informacja o wyjeździe 🏔️</p><p style="font-size:14px;color:#374151;margin:0 0 10px;">Drogi/a ${recipient.parentFirstName || 'Rodzicu'},</p><p style="font-size:14px;color:#374151;margin:0 0 16px;">Przekazujemy informacje o planowanym wyjeździe <strong>${trip.title}</strong> dla <strong>${recipient.childName}</strong>.</p>${tripDetailsHtml}`;

        await sendTripEmail(recipient.parentEmail, subject, autoBodyHtml, tripId);
      }
      sent++;
    } catch (err) {
      console.error(`sendTripInfoEmailToGroup: failed for ${recipient.parentEmail}`, err);
      skipped++;
    }
  }

  // Activity log
  logActivity(user.id, user.email ?? undefined, 'trip_email_sent', {
    tripId,
    tripTitle: trip.title,
    subject,
    sent,
    skipped,
  }).catch(console.error);

  return { success: true, sent, skipped };
}
