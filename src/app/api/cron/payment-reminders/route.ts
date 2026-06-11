import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { queuePaymentReminderEmail } from '@/lib/system-email';

// Cron job — uruchamiany codziennie przez Vercel Cron
// Wysyła przypomnienie do rodziców gdy do terminu płatności zostały 3 dni
// a płatność nadal nie jest opłacona

// Wydłużony limit czasu funkcji — wysyłka maili przez SMTP bywa wolna,
// przy szczycie (wiele płatności z tym samym terminem) sekwencyjna pętla
// mogłaby przekroczyć domyślny timeout.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Weryfikacja sekretu — chroni endpoint przed nieautoryzowanym wywołaniem
  const authHeader = request.headers.get('authorization');
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Data dziś i za 3 dni (format YYYY-MM-DD)
  const today = new Date();
  const in3days = new Date(today);
  in3days.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split('T')[0];
  const in3daysStr = in3days.toISOString().split('T')[0];

  // Pobierz tylko nieopłacone płatności z terminem dokładnie za 3 dni —
  // filtrowanie po due_date robi baza (zamiast ściągać wszystkie nieopłacone).
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, payment_type, installment_number, due_date, manual_title,
      participant:participants!payments_participant_id_fkey (
        first_name, last_name, birth_date,
        parent:profiles!parent_id (email, first_name)
      ),
      registration:trip_registrations (
        participation_status,
        trip:trips (title)
      )
    `)
    .in('status', ['pending', 'partially_paid', 'overdue', 'partially_paid_overdue'])
    .eq('parent_visible', true)
    .eq('due_date', in3daysStr);

  if (error) {
    console.error('Cron payment-reminders: DB error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const sentIds: string[] = [];

  for (const payment of (payments || [])) {
    const reg = payment.registration as unknown as {
      participation_status: string;
      trip: { title: string } | null;
    } | null;
    const directParticipant = payment.participant as unknown as {
      first_name: string;
      last_name: string;
      parent: { email: string; first_name: string } | null;
    } | null;

    // Płatności wyjazdowe wysyłamy tylko dla potwierdzonych uczestników.
    // Płatności ręczne nie mają registration_id, więc wystarczy przypisanie do dziecka.
    if (reg && reg.participation_status !== 'confirmed') {
      skipped++;
      continue;
    }

    // Wysyłamy tylko gdy termin to dokładnie za 3 dni
    if (payment.due_date !== in3daysStr) {
      skipped++;
      continue;
    }

    const parent = directParticipant?.parent;
    const participant = directParticipant;
    const paymentTitle = reg?.trip?.title || payment.manual_title || 'Płatność ręczna';

    if (!parent?.email || !participant) {
      skipped++;
      continue;
    }

    const paymentLabel = payment.payment_type === 'installment'
      ? `Rata ${payment.installment_number}`
      : payment.payment_type === 'season_pass'
      ? 'Karnet'
      : payment.payment_type === 'manual'
      ? 'Płatność ręczna'
      : 'Pełna opłata';

    try {
      await queuePaymentReminderEmail(
        parent.email,
        parent.first_name || '',
        `${participant.first_name} ${participant.last_name}`,
        paymentTitle,
        payment.amount,
        payment.currency,
        payment.due_date,
        paymentLabel,
        { paymentId: payment.id },
      );
      sentIds.push(payment.id);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${parent.email}: ${msg}`);
    }
  }

  // Znacznik widoczny na /admin/payments („przyp. wysłano d.MM") — wspólny
  // z ręcznym przyciskiem przypomnienia (sendPaymentReminders).
  if (sentIds.length > 0) {
    const { error: markError } = await supabase
      .from('payments')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .in('id', sentIds);
    if (markError) console.error('Cron payment-reminders: mark error', markError);
  }

  console.log(`Cron payment-reminders [${todayStr}]: sent=${sent}, skipped=${skipped}, errors=${errors.length}`);

  return NextResponse.json({
    ok: true,
    date: todayStr,
    reminderDate: in3daysStr,
    sent,
    skipped,
    errors,
  });
}
