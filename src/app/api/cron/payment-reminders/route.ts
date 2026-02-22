import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendPaymentReminderEmail } from '@/lib/email';

// Cron job — uruchamiany codziennie przez Vercel Cron
// Wysyła przypomnienie do rodziców gdy do terminu płatności zostały 3 dni
// a płatność nadal nie jest opłacona

export async function GET(request: NextRequest) {
  // Weryfikacja sekretu — chroni endpoint przed nieautoryzowanym wywołaniem
  const authHeader = request.headers.get('authorization');
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.CRON_SECRET && authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Data dziś i za 3 dni (format YYYY-MM-DD)
  const today = new Date();
  const in3days = new Date(today);
  in3days.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split('T')[0];
  const in3daysStr = in3days.toISOString().split('T')[0];

  // Znajdź płatności których termin upływa za 3 dni i które nie są opłacone
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, payment_type, installment_number, due_date,
      registration:trip_registrations (
        participation_status,
        participant:participants (
          first_name, last_name, birth_date,
          parent:profiles!parent_id (email, first_name)
        ),
        trip:trips (title)
      )
    `)
    .eq('due_date', in3daysStr)
    .in('status', ['pending', 'partially_paid', 'overdue', 'partially_paid_overdue'])
    .neq('status', 'cancelled');

  if (error) {
    console.error('Cron payment-reminders: DB error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const payment of (payments || [])) {
    const reg = payment.registration as unknown as {
      participation_status: string;
      participant: {
        first_name: string;
        last_name: string;
        parent: { email: string; first_name: string } | null;
      } | null;
      trip: { title: string } | null;
    } | null;

    // Pomijaj dzieci które nie jadą
    if (!reg || reg.participation_status !== 'confirmed') {
      skipped++;
      continue;
    }

    const parent = reg.participant?.parent;
    const participant = reg.participant;
    const trip = reg.trip;

    if (!parent?.email || !participant || !trip) {
      skipped++;
      continue;
    }

    const paymentLabel = payment.payment_type === 'installment'
      ? `Rata ${payment.installment_number}`
      : payment.payment_type === 'season_pass'
      ? 'Karnet'
      : 'Pełna opłata';

    try {
      await sendPaymentReminderEmail(
        parent.email,
        parent.first_name || '',
        `${participant.first_name} ${participant.last_name}`,
        trip.title,
        payment.amount,
        payment.currency,
        payment.due_date,
        paymentLabel,
      );
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${parent.email}: ${msg}`);
    }
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
