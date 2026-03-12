import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// POST /api/public/confirm
// Body: { token: string, action?: 'confirm' | 'decline' }
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
      .select('*, trips(name, departure_datetime)')
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

    const action = overrideAction || tokenRecord.action;

    // --- Znajdź lub utwórz konto rodzica ---
    let parentProfileId: string;

    // Sprawdź czy profil istnieje po emailu
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', tokenRecord.parent_email)
      .single();

    if (existingProfile) {
      parentProfileId = existingProfile.id;
    } else {
      // Utwórz nowe konto Supabase Auth + profil
      const { data: newAuthUser, error: authError } = await admin.auth.admin.createUser({
        email: tokenRecord.parent_email,
        email_confirm: true, // potwierdź email od razu
        user_metadata: {
          first_name: tokenRecord.parent_first_name,
          last_name: tokenRecord.parent_last_name,
          phone: tokenRecord.parent_phone,
        },
      });

      if (authError || !newAuthUser.user) {
        console.error('Błąd tworzenia konta:', authError);
        return NextResponse.json({ error: 'Nie udało się przetworzyć żądania' }, { status: 500 });
      }

      // Profil powinien być utworzony przez trigger, ale upewnijmy się
      await admin.from('profiles').upsert({
        id: newAuthUser.user.id,
        email: tokenRecord.parent_email,
        first_name: tokenRecord.parent_first_name,
        last_name: tokenRecord.parent_last_name,
        phone: tokenRecord.parent_phone,
        role: 'parent',
      });

      parentProfileId = newAuthUser.user.id;
    }

    let resultRegistrationId: string | null = null;

    if (action === 'confirm' || action === 'register') {
      // Znajdź lub utwórz uczestnika
      let participantId = tokenRecord.participant_id;

      if (!participantId && tokenRecord.participant_name) {
        // Nowy uczestnik — utwórz podstawowy profil
        const nameParts = tokenRecord.participant_name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: newParticipant, error: participantError } = await admin
          .from('participants')
          .insert({
            parent_id: parentProfileId,
            first_name: firstName,
            last_name: lastName,
          })
          .select('id')
          .single();

        if (participantError || !newParticipant) {
          console.error('Błąd tworzenia uczestnika:', participantError);
          return NextResponse.json({ error: 'Nie udało się zapisać uczestnika' }, { status: 500 });
        }

        participantId = newParticipant.id;
      }

      if (!participantId) {
        return NextResponse.json({ error: 'Brak danych uczestnika' }, { status: 400 });
      }

      // Sprawdź czy rejestracja już istnieje
      const { data: existingReg } = await admin
        .from('trip_registrations')
        .select('id, status')
        .eq('trip_id', tokenRecord.trip_id)
        .eq('participant_id', participantId)
        .single();

      if (existingReg) {
        if (existingReg.status === 'active') {
          resultRegistrationId = existingReg.id;
        } else {
          // Reaktywuj anulowaną
          const { data: reactivated } = await admin
            .from('trip_registrations')
            .update({ status: 'active' })
            .eq('id', existingReg.id)
            .select('id')
            .single();
          resultRegistrationId = reactivated?.id || existingReg.id;
        }
      } else {
        // Utwórz nową rejestrację
        const { data: newReg, error: regError } = await admin
          .from('trip_registrations')
          .insert({
            trip_id: tokenRecord.trip_id,
            participant_id: participantId,
            registered_by: parentProfileId,
            registration_type: 'parent',
          })
          .select('id')
          .single();

        if (regError || !newReg) {
          console.error('Błąd rejestracji:', regError);
          return NextResponse.json({ error: 'Nie udało się zapisać na wyjazd' }, { status: 500 });
        }

        resultRegistrationId = newReg.id;
      }
    } else if (action === 'decline') {
      // Anuluj rejestrację jeśli istnieje
      if (tokenRecord.participant_id) {
        await admin
          .from('trip_registrations')
          .update({ status: 'cancelled' })
          .eq('trip_id', tokenRecord.trip_id)
          .eq('participant_id', tokenRecord.participant_id);
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
      isNewAccount: !existingProfile,
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
    .select('action, status, expires_at, parent_email, participant_name, participant_id, trip_id, trips(name, departure_datetime, location)')
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
    action: tokenRecord.action,
    status: isExpired ? 'expired' : tokenRecord.status,
    parentEmail: tokenRecord.parent_email,
    participantName,
    trip: tokenRecord.trips,
  });
}
