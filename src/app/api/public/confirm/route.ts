import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createPaymentsForRegistration } from '@/lib/actions/payments';
import { createContractForParticipantIfNeeded } from '@/lib/actions/contracts';

// POST /api/public/confirm
// Body: { token: string, action?: 'confirm' | 'decline' }
//
// Link mailowy potwierdzenia udziału — działa bez logowania.
// Zakładamy, że rodzic i dziecko ISTNIEJĄ już w bazie (link wysyłany tylko
// do znanych rodziców). Nie tworzymy kont ani nowych uczestników.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action: overrideAction } = body;

    if (!token) {
      return NextResponse.json({ error: 'Brak tokenu' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Pobierz token
    const { data: tokenRecord, error: tokenError } = await admin
      .from('registration_tokens')
      .select('*, trips(title, departure_datetime)')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 404 });
    }

    if (tokenRecord.status === 'used') {
      return NextResponse.json({ error: 'Ten link był już użyty', alreadyUsed: true }, { status: 409 });
    }

    if (tokenRecord.status === 'expired' || new Date(tokenRecord.expires_at) < new Date()) {
      await admin.from('registration_tokens').update({ status: 'expired' }).eq('id', tokenRecord.id);
      return NextResponse.json({ error: 'Link wygasł. Skontaktuj się z organizatorem.' }, { status: 410 });
    }

    const action = (overrideAction || tokenRecord.action) === 'decline' ? 'decline' : 'confirm';

    // --- Znajdź konto rodzica (musi istnieć) ---
    const { data: parentProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', tokenRecord.parent_email)
      .single();

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Nie znaleziono konta dla tego adresu. Skontaktuj się z organizatorem.' },
        { status: 404 },
      );
    }
    const parentProfileId = parentProfile.id;

    // --- Uczestnik musi istnieć i należeć do tego rodzica ---
    const participantId = tokenRecord.participant_id;
    if (!participantId) {
      return NextResponse.json({ error: 'Brak danych uczestnika' }, { status: 400 });
    }

    const { data: participant } = await admin
      .from('participants')
      .select('id, parent_id')
      .eq('id', participantId)
      .single();

    if (!participant || participant.parent_id !== parentProfileId) {
      return NextResponse.json({ error: 'Nieprawidłowe dane uczestnika' }, { status: 400 });
    }

    let resultRegistrationId: string | null = null;

    // Znajdź istniejącą rejestrację
    const { data: existingReg } = await admin
      .from('trip_registrations')
      .select('id')
      .eq('trip_id', tokenRecord.trip_id)
      .eq('participant_id', participantId)
      .maybeSingle();

    if (action === 'confirm') {
      const confirmedAt = new Date().toISOString();

      if (existingReg) {
        resultRegistrationId = existingReg.id;
        await admin
          .from('trip_registrations')
          .update({
            status: 'active',
            participation_status: 'confirmed',
            participation_note: '[STOP1]',
            confirmed_at: confirmedAt,
          })
          .eq('id', existingReg.id);
      } else {
        const { data: newReg, error: regError } = await admin
          .from('trip_registrations')
          .insert({
            trip_id: tokenRecord.trip_id,
            participant_id: participantId,
            registered_by: parentProfileId,
            registration_type: 'parent',
            status: 'active',
            participation_status: 'confirmed',
            participation_note: '[STOP1]',
            confirmed_at: confirmedAt,
          })
          .select('id')
          .single();

        if (regError || !newReg) {
          console.error('Błąd rejestracji:', regError);
          return NextResponse.json({ error: 'Nie udało się zapisać na wyjazd' }, { status: 500 });
        }
        resultRegistrationId = newReg.id;
      }

      if (!resultRegistrationId) {
        return NextResponse.json({ error: 'Nie udało się zapisać na wyjazd' }, { status: 500 });
      }

      // Utwórz płatności jeśli jeszcze nie istnieją
      const { data: existingPayments } = await admin
        .from('payments')
        .select('id')
        .eq('registration_id', resultRegistrationId)
        .neq('status', 'cancelled')
        .limit(1);

      if (!existingPayments || existingPayments.length === 0) {
        await createPaymentsForRegistration(
          resultRegistrationId,
          tokenRecord.trip_id,
          participantId,
          confirmedAt,
        );
      }

      // Utwórz umowę jeśli wyjazd ma włączony system umów
      await createContractForParticipantIfNeeded(
        tokenRecord.trip_id,
        participantId,
        resultRegistrationId,
        parentProfileId,
      );
    } else {
      // decline — dziecko nie jedzie
      if (existingReg) {
        resultRegistrationId = existingReg.id;
        await admin
          .from('trip_registrations')
          .update({ participation_status: 'not_going', confirmed_at: null })
          .eq('id', existingReg.id);

        // Anuluj oczekujące płatności
        await admin
          .from('payments')
          .update({ status: 'cancelled' })
          .eq('registration_id', existingReg.id)
          .eq('status', 'pending');
      }
    }

    // Oznacz token jako użyty
    await admin.from('registration_tokens').update({
      status: 'used',
      used_at: new Date().toISOString(),
      result_registration_id: resultRegistrationId,
      result_profile_id: parentProfileId,
    }).eq('id', tokenRecord.id);

    return NextResponse.json({
      success: true,
      action,
      trip: tokenRecord.trips,
      parentEmail: tokenRecord.parent_email,
    });
  } catch (error) {
    console.error('Confirm token error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// GET /api/public/confirm?token=xxx — pobierz info o tokenie
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Brak tokenu' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tokenRecord, error } = await admin
    .from('registration_tokens')
    .select('action, status, expires_at, parent_email, participant_name, participant_id, trip_id, trips(title, departure_datetime, location)')
    .eq('token', token)
    .single();

  if (error || !tokenRecord) {
    return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 404 });
  }

  // Pobierz imię uczestnika jeśli mamy participant_id
  let participantName = tokenRecord.participant_name;
  if (tokenRecord.participant_id && !participantName) {
    const { data: participant } = await admin
      .from('participants')
      .select('first_name, last_name')
      .eq('id', tokenRecord.participant_id)
      .single();
    if (participant) {
      participantName = `${participant.first_name} ${participant.last_name}`;
    }
  }

  const isExpired = tokenRecord.status === 'expired' || new Date(tokenRecord.expires_at) < new Date();

  return NextResponse.json({
    action: tokenRecord.action === 'decline' ? 'decline' : 'confirm',
    status: isExpired ? 'expired' : tokenRecord.status,
    parentEmail: tokenRecord.parent_email,
    participantName,
    trip: tokenRecord.trips,
  });
}
