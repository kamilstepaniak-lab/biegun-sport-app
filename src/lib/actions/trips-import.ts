'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface TripsImportBufferRow {
  id: number;
  tytul_wyjazdu: string | null;
  opis: string | null;
  sekcja: string | null;
  info: string | null;
  data_wyjazdu: string | null;
  miejsce_wyjazdu: string | null;
  godzina_wyjazdu: string | null;
  data_powrotu: string | null;
  miejsce_powrotu: string | null;
  godzina_powrotu: string | null;
  forma_platnosci_1: string | null;
  kwota_1: string | null;
  termin_1: string | null;
  forma_platnosci_2: string | null;
  kwota_2: string | null;
  termin_2: string | null;
  karnety_reguly: string | null;
  forma_platnosci_karnet: string | null;
  status_importu: string;
  blad_opis: string | null;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  errorDetails: string[];
}

// Parsowanie daty z formatu DD.MM.YYYY lub D.M.YYYY na YYYY-MM-DD
function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  // Spróbuj rozpoznać format DD.MM.YYYY lub D.M.YYYY
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Parsowanie godziny z formatu HH:MM lub H:MM
function parseTime(timeStr: string | null): string {
  if (!timeStr) return '08:00';

  // Wyczyść spacje i sprawdź format
  const cleaned = timeStr.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);

  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return '08:00';
}

// Parsowanie formy płatności
function parsePaymentMethod(method: string | null): 'cash' | 'transfer' | 'both' | null {
  if (!method) return 'both';

  const lower = method.toLowerCase().trim();

  if (lower.includes('gotówka') && lower.includes('przelew')) return 'both';
  if (lower.includes('gotówka')) return 'cash';
  if (lower.includes('przelew')) return 'transfer';
  if (lower.includes('both')) return 'both';

  return 'both';
}

// Parsowanie kwoty
function parseAmount(amountStr: string | null): number {
  if (!amountStr) return 0;

  // Usuń spacje, zamień przecinki na kropki
  const cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
  const amount = parseFloat(cleaned);

  return isNaN(amount) ? 0 : amount;
}

// Pobieranie danych z import buffer
export async function getTripsImportBuffer() {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('trips_import_buffer')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching trips import buffer:', error);
    return { data: [], error: error.message };
  }

  return { data: data as TripsImportBufferRow[], error: null };
}

// Główna funkcja importu
export async function runTripsImport(): Promise<ImportResult> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  // Sprawdź uprawnienia
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, imported: 0, errors: 0, errorDetails: ['Nie jesteś zalogowany'] };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { success: false, imported: 0, errors: 0, errorDetails: ['Brak uprawnień administratora'] };
  }

  // Pobierz rekordy do importu
  const { data: records, error: fetchError } = await supabaseAdmin
    .from('trips_import_buffer')
    .select('*')
    .eq('status_importu', 'oczekuje')
    .order('id', { ascending: true });

  if (fetchError || !records) {
    return { success: false, imported: 0, errors: 0, errorDetails: [fetchError?.message || 'Błąd pobierania danych'] };
  }

  if (records.length === 0) {
    return { success: true, imported: 0, errors: 0, errorDetails: ['Brak rekordów do zaimportowania'] };
  }

  // Pobierz istniejące grupy
  const { data: existingGroups } = await supabaseAdmin
    .from('groups')
    .select('id, name');

  const groupMap = new Map<string, string>();
  (existingGroups || []).forEach((g: { id: string; name: string }) => {
    groupMap.set(g.name.toLowerCase().trim(), g.id);
  });

  let imported = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const record of records as TripsImportBufferRow[]) {
    try {
      // Walidacja podstawowych danych
      if (!record.tytul_wyjazdu) {
        throw new Error('Brak tytułu wyjazdu');
      }

      const departureDate = parseDate(record.data_wyjazdu);
      const returnDate = parseDate(record.data_powrotu);

      if (!departureDate) {
        throw new Error('Nieprawidłowa data wyjazdu');
      }
      if (!returnDate) {
        throw new Error('Nieprawidłowa data powrotu');
      }

      const departureTime = parseTime(record.godzina_wyjazdu);
      const returnTime = parseTime(record.godzina_powrotu);

      // Znajdź lub utwórz grupę z sekcja
      let groupId: string | null = null;
      if (record.sekcja) {
        const sekcjaLower = record.sekcja.toLowerCase().trim();

        if (groupMap.has(sekcjaLower)) {
          groupId = groupMap.get(sekcjaLower)!;
        } else {
          // Utwórz nową grupę
          const { data: newGroup, error: groupError } = await supabaseAdmin
            .from('groups')
            .insert({ name: record.sekcja.trim() })
            .select('id')
            .single();

          if (groupError || !newGroup) {
            console.error('Error creating group:', groupError);
          } else {
            groupId = newGroup.id;
            if (groupId) {
              groupMap.set(sekcjaLower, groupId);
            }
          }
        }
      }

      // Przygotuj opis (łączymy opis + info)
      let description = record.opis || '';
      if (record.info) {
        description = description ? `${description}\n\n${record.info}` : record.info;
      }

      // Utwórz wyjazd
      const { data: trip, error: tripError } = await supabaseAdmin
        .from('trips')
        .insert({
          title: record.tytul_wyjazdu.trim(),
          description: description || null,
          departure_datetime: `${departureDate}T${departureTime}:00`,
          departure_location: record.miejsce_wyjazdu?.trim() || 'Do ustalenia',
          return_datetime: `${returnDate}T${returnTime}:00`,
          return_location: record.miejsce_powrotu?.trim() || 'Do ustalenia',
          status: 'draft',
          created_by: user.id,
          bank_account_pln: '39 1240 1444 1111 0010 7170 4855',
          bank_account_eur: 'PL21 1240 1444 1978 0010 7136 2778',
        })
        .select('id')
        .single();

      if (tripError || !trip) {
        throw new Error(`Błąd tworzenia wyjazdu: ${tripError?.message}`);
      }

      // Przypisz grupę do wyjazdu
      if (groupId) {
        await supabaseAdmin
          .from('trip_groups')
          .insert({ trip_id: trip.id, group_id: groupId });
      }

      // Utwórz szablony płatności
      const paymentTemplates: Array<{
        trip_id: string;
        payment_type: string;
        installment_number: number | null;
        amount: number;
        currency: string;
        due_date: string | null;
        payment_method: string | null;
      }> = [];

      // Rata 1
      const amount1 = parseAmount(record.kwota_1);
      if (amount1 > 0) {
        paymentTemplates.push({
          trip_id: trip.id,
          payment_type: 'installment',
          installment_number: 1,
          amount: amount1,
          currency: 'PLN',
          due_date: parseDate(record.termin_1),
          payment_method: parsePaymentMethod(record.forma_platnosci_1),
        });
      }

      // Rata 2
      const amount2 = parseAmount(record.kwota_2);
      if (amount2 > 0) {
        paymentTemplates.push({
          trip_id: trip.id,
          payment_type: 'installment',
          installment_number: 2,
          amount: amount2,
          currency: 'PLN',
          due_date: parseDate(record.termin_2),
          payment_method: parsePaymentMethod(record.forma_platnosci_2),
        });
      }

      // Karnet (jeśli jest)
      if (record.karnety_reguly) {
        // Parsuj reguły karnetów (format: "rocznik 2015-2016: 200 PLN, rocznik 2017-2018: 180 PLN")
        const karnetRules = record.karnety_reguly.split(',').map(r => r.trim());

        for (const rule of karnetRules) {
          // Spróbuj wyciągnąć roczniki i kwotę
          const match = rule.match(/(\d{4})[^\d]*(\d{4})?[^\d]*(\d+)/);
          if (match) {
            const yearFrom = parseInt(match[1], 10);
            const yearTo = match[2] ? parseInt(match[2], 10) : yearFrom;
            const karnetAmount = parseInt(match[3], 10);

            if (karnetAmount > 0) {
              paymentTemplates.push({
                trip_id: trip.id,
                payment_type: 'season_pass',
                installment_number: null,
                amount: karnetAmount,
                currency: 'PLN',
                due_date: null,
                payment_method: parsePaymentMethod(record.forma_platnosci_karnet),
              });
            }
          }
        }
      }

      // Wstaw szablony płatności
      if (paymentTemplates.length > 0) {
        const { error: templatesError } = await supabaseAdmin
          .from('trip_payment_templates')
          .insert(paymentTemplates);

        if (templatesError) {
          console.error('Error creating payment templates:', templatesError);
        }
      }

      // Oznacz jako zaimportowany
      await supabaseAdmin
        .from('trips_import_buffer')
        .update({
          status_importu: 'zaimportowano',
          blad_opis: null,
        })
        .eq('id', record.id);

      imported++;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd';
      errorDetails.push(`Rekord ${record.id} (${record.tytul_wyjazdu || 'bez tytułu'}): ${errorMessage}`);

      // Oznacz jako błąd
      await supabaseAdmin
        .from('trips_import_buffer')
        .update({
          status_importu: 'blad',
          blad_opis: errorMessage,
        })
        .eq('id', record.id);

      errors++;
    }
  }

  revalidatePath('/admin/trips');
  revalidatePath('/admin/trips/import');

  return {
    success: errors === 0,
    imported,
    errors,
    errorDetails,
  };
}

// Resetowanie statusu importu (do ponownego importu)
export async function resetTripsImportStatus(recordIds?: number[]) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Nie jesteś zalogowany' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Brak uprawnień' };
  }

  let query = supabaseAdmin
    .from('trips_import_buffer')
    .update({
      status_importu: 'oczekuje',
      blad_opis: null,
    });

  if (recordIds && recordIds.length > 0) {
    query = query.in('id', recordIds);
  }

  const { error } = await query;

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin/trips/import');
  return { success: true };
}
