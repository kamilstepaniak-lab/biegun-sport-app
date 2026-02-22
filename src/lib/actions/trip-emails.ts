'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendRegistrationConfirmationEmail, type TripEmailData, type PaymentLineItem } from '@/lib/email';

/**
 * Wysyła e-mail informacyjny o wyjeździe do wszystkich rodziców
 * dzieci przypisanych do grup powiązanych z tym wyjazdem.
 *
 * Używane gdy admin tworzy wyjazd i chce poinformować rodziców.
 */
export async function sendTripInfoEmailToGroup(tripId: string): Promise<{
  success?: boolean;
  sent?: number;
  skipped?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  // Sprawdź uprawnienia admina
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { error: 'Brak uprawnień' };

  // Pobierz dane wyjazdu
  const { data: trip, error: tripError } = await supabaseAdmin
    .from('trips')
    .select(`
      title, description, location,
      departure_datetime, departure_location,
      departure_stop2_datetime, departure_stop2_location,
      return_datetime, return_location,
      return_stop2_datetime, return_stop2_location,
      bank_account_pln, bank_account_eur
    `)
    .eq('id', tripId)
    .single();

  if (tripError || !trip) return { error: 'Nie znaleziono wyjazdu' };

  // Pobierz szablony płatności
  const { data: paymentTemplates } = await supabaseAdmin
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

    // Jeśli już wysyłamy do tego rodzica, pomiń (wyślemy z pierwszym dzieckiem)
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

  for (const recipient of toSend) {
    // Filtruj szablony płatności dla tego dziecka (wg rocznika dla karnetów)
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

    try {
      await sendRegistrationConfirmationEmail(
        recipient.parentEmail,
        recipient.parentFirstName,
        recipient.childName,
        trip as TripEmailData,
        emailPaymentLines,
      );
      sent++;
    } catch (err) {
      console.error(`sendTripInfoEmailToGroup: failed for ${recipient.parentEmail}`, err);
      skipped++;
    }
  }

  return { success: true, sent, skipped };
}
