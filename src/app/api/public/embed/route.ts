import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Nagłówki CORS dla embedów
function corsHeaders(origin: string | null, allowedOrigins?: string[] | null) {
  const headers = new Headers();

  if (!allowedOrigins || allowedOrigins.length === 0) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else {
    headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

// OPTIONS — preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin, null);
  return new NextResponse(null, { status: 204, headers });
}

// GET /api/public/embed?key=xxx — pobierz konfigurację formularza
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const origin = request.headers.get('origin');

  if (!key) {
    return NextResponse.json({ error: 'Brak klucza formularza' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: form, error } = await admin
    .from('trip_embed_forms')
    .select(`
      id, public_key, title, description, button_text, success_message,
      require_phone, require_child_birth_date, require_child_school,
      custom_fields, max_registrations, current_registrations, is_active,
      allowed_origins,
      trips(name, departure_datetime, location, status)
    `)
    .eq('public_key', key)
    .single();

  if (error || !form) {
    return NextResponse.json({ error: 'Formularz nie znaleziony' }, { status: 404 });
  }

  if (!form.is_active) {
    return NextResponse.json({ error: 'Formularz jest nieaktywny' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trip = form.trips as any;
  if (trip?.status === 'archived') {
    return NextResponse.json({ error: 'Wyjazd jest już zakończony' }, { status: 410 });
  }

  const isFull = form.max_registrations !== null &&
    form.current_registrations >= form.max_registrations;

  const headers = corsHeaders(origin, form.allowed_origins);

  return NextResponse.json({
    formId: form.id,
    title: form.title || trip?.name,
    description: form.description,
    buttonText: form.button_text,
    successMessage: form.success_message,
    fields: {
      requirePhone: form.require_phone,
      requireBirthDate: form.require_child_birth_date,
      requireSchool: form.require_child_school,
      customFields: form.custom_fields,
    },
    trip: trip
      ? {
          name: trip.name,
          date: trip.departure_datetime,
          location: trip.location,
        }
      : null,
    isFull,
    spotsLeft: form.max_registrations
      ? Math.max(0, form.max_registrations - form.current_registrations)
      : null,
  }, { headers });
}

// POST /api/public/embed — wyślij zgłoszenie z formularza
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    const body = await request.json();
    const {
      formId,
      parentEmail,
      parentFirstName,
      parentLastName,
      parentPhone,
      childFirstName,
      childLastName,
      childBirthDate,
      childSchool,
      customFieldValues,
    } = body;

    // Walidacja wymaganych pól
    if (!formId || !parentEmail || !parentFirstName || !parentLastName ||
        !childFirstName || !childLastName) {
      return NextResponse.json({ error: 'Wypełnij wszystkie wymagane pola' }, { status: 400 });
    }

    // Podstawowa walidacja emaila
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return NextResponse.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Pobierz formularz
    const { data: form, error: formError } = await admin
      .from('trip_embed_forms')
      .select('id, trip_id, is_active, max_registrations, current_registrations, allowed_origins, success_message')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Nieprawidłowy formularz' }, { status: 404 });
    }

    if (!form.is_active) {
      return NextResponse.json({ error: 'Formularz jest nieaktywny' }, { status: 403 });
    }

    if (form.max_registrations !== null && form.current_registrations >= form.max_registrations) {
      return NextResponse.json({ error: 'Brak wolnych miejsc' }, { status: 409 });
    }

    // Sprawdź CORS
    if (form.allowed_origins && form.allowed_origins.length > 0 && origin) {
      if (!form.allowed_origins.includes(origin)) {
        return NextResponse.json({ error: 'Niedozwolone źródło' }, { status: 403 });
      }
    }

    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') || 'unknown';

    // Zapisz zgłoszenie
    const { data: submission, error: subError } = await admin
      .from('embed_form_submissions')
      .insert({
        form_id: formId,
        trip_id: form.trip_id,
        parent_email: parentEmail.toLowerCase().trim(),
        parent_first_name: parentFirstName.trim(),
        parent_last_name: parentLastName.trim(),
        parent_phone: parentPhone?.trim(),
        child_first_name: childFirstName.trim(),
        child_last_name: childLastName.trim(),
        child_birth_date: childBirthDate || null,
        child_school: childSchool?.trim(),
        custom_field_values: customFieldValues || {},
        source_origin: origin,
        ip_address: ipAddress,
      })
      .select('id')
      .single();

    if (subError || !submission) {
      console.error('Embed submit error:', subError);
      return NextResponse.json({ error: 'Błąd zapisywania zgłoszenia' }, { status: 500 });
    }

    // Przetwórz zgłoszenie — znajdź/utwórz konto i zapisz dziecko
    const processResult = await processEmbedSubmission(submission.id, form.trip_id, {
      parentEmail: parentEmail.toLowerCase().trim(),
      parentFirstName: parentFirstName.trim(),
      parentLastName: parentLastName.trim(),
      parentPhone: parentPhone?.trim(),
      childFirstName: childFirstName.trim(),
      childLastName: childLastName.trim(),
      childBirthDate,
      childSchool: childSchool?.trim(),
    });

    if (processResult.duplicate) {
      const headers = corsHeaders(origin, form.allowed_origins);
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'To dziecko jest już zapisane na ten wyjazd.',
      }, { headers });
    }

    // Zwiększ licznik rejestracji
    await admin
      .from('trip_embed_forms')
      .update({ current_registrations: form.current_registrations + 1 })
      .eq('id', formId);

    const headers = corsHeaders(origin, form.allowed_origins);
    return NextResponse.json({
      success: true,
      message: form.success_message,
      isNewAccount: processResult.isNewAccount,
    }, { headers });

  } catch (error) {
    console.error('Embed form error:', error);
    const headers = corsHeaders(origin, null);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500, headers });
  }
}

async function processEmbedSubmission(
  submissionId: string,
  tripId: string,
  data: {
    parentEmail: string;
    parentFirstName: string;
    parentLastName: string;
    parentPhone?: string;
    childFirstName: string;
    childLastName: string;
    childBirthDate?: string;
    childSchool?: string;
  }
) {
  const admin = createAdminClient();

  try {
    // 1. Znajdź lub utwórz konto rodzica
    let parentProfileId: string;
    let isNewAccount = false;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', data.parentEmail)
      .single();

    if (existingProfile) {
      parentProfileId = existingProfile.id;
    } else {
      // Utwórz nowe konto
      const { data: newUser, error: authError } = await admin.auth.admin.createUser({
        email: data.parentEmail,
        email_confirm: true,
        user_metadata: {
          first_name: data.parentFirstName,
          last_name: data.parentLastName,
          phone: data.parentPhone,
        },
      });

      if (authError || !newUser.user) {
        throw new Error('Błąd tworzenia konta: ' + authError?.message);
      }

      await admin.from('profiles').upsert({
        id: newUser.user.id,
        email: data.parentEmail,
        first_name: data.parentFirstName,
        last_name: data.parentLastName,
        phone: data.parentPhone,
        role: 'parent',
      });

      parentProfileId = newUser.user.id;
      isNewAccount = true;
    }

    // 2. Znajdź lub utwórz uczestnika
    let participantId: string;

    // Szukaj po imieniu + nazwisku + parent_id
    const { data: existingParticipant } = await admin
      .from('participants')
      .select('id')
      .eq('parent_id', parentProfileId)
      .ilike('first_name', data.childFirstName)
      .ilike('last_name', data.childLastName)
      .single();

    if (existingParticipant) {
      participantId = existingParticipant.id;
    } else {
      const { data: newParticipant, error: partError } = await admin
        .from('participants')
        .insert({
          parent_id: parentProfileId,
          first_name: data.childFirstName,
          last_name: data.childLastName,
          birth_date: data.childBirthDate || null,
          school: data.childSchool || null,
        })
        .select('id')
        .single();

      if (partError || !newParticipant) {
        throw new Error('Błąd tworzenia uczestnika');
      }

      participantId = newParticipant.id;
    }

    // 3. Sprawdź czy już jest zapis
    const { data: existingReg } = await admin
      .from('trip_registrations')
      .select('id, status')
      .eq('trip_id', tripId)
      .eq('participant_id', participantId)
      .single();

    if (existingReg?.status === 'active') {
      await admin
        .from('embed_form_submissions')
        .update({ status: 'duplicate' })
        .eq('id', submissionId);
      return { duplicate: true, isNewAccount };
    }

    // 4. Utwórz rejestrację
    let registrationId: string;

    if (existingReg) {
      // Reaktywuj
      const { data: updated } = await admin
        .from('trip_registrations')
        .update({ status: 'active', registered_by: parentProfileId })
        .eq('id', existingReg.id)
        .select('id')
        .single();
      registrationId = updated?.id || existingReg.id;
    } else {
      const { data: newReg, error: regError } = await admin
        .from('trip_registrations')
        .insert({
          trip_id: tripId,
          participant_id: participantId,
          registered_by: parentProfileId,
          registration_type: 'parent',
        })
        .select('id')
        .single();

      if (regError || !newReg) throw new Error('Błąd rejestracji');
      registrationId = newReg.id;
    }

    // 5. Aktualizuj submission
    await admin
      .from('embed_form_submissions')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        result_profile_id: parentProfileId,
        result_participant_id: participantId,
        result_registration_id: registrationId,
      })
      .eq('id', submissionId);

    return { duplicate: false, isNewAccount };
  } catch (error) {
    console.error('processEmbedSubmission error:', error);
    await admin
      .from('embed_form_submissions')
      .update({ status: 'error' })
      .eq('id', submissionId);
    throw error;
  }
}
