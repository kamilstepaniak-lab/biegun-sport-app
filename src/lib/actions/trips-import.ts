'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';
import { createTrip } from './trips';
import type { CreateTripInput, CreatePaymentTemplateInput, AttendanceType, Currency } from '@/types';

// Jeden wiersz z wgranego pliku CSV (klucze = nagłówki kolumn szablonu)
export interface ImportTripRow {
  tytul?: string;
  typ?: string;
  grupa?: string;
  opis?: string;
  data_wyjazdu?: string;
  godzina_wyjazdu?: string;
  miejsce_wyjazdu?: string;
  data_powrotu?: string;
  godzina_powrotu?: string;
  miejsce_powrotu?: string;
  kwota_1?: string;
  waluta_1?: string;
  termin_1?: string;
  kwota_2?: string;
  waluta_2?: string;
  termin_2?: string;
}

export interface BulkImportResult {
  imported: number;
  errors: number;
  details: string[];
}

// DD.MM.YYYY -> YYYY-MM-DD
function parseDate(s?: string): string | null {
  if (!s) return null;
  const parts = s.trim().split('.');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!d || !m || !y || d > 31 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// HH:MM -> HH:MM (domyślnie 08:00)
function parseTime(s?: string): string {
  const m = (s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '08:00';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return '08:00';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseAmount(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseCurrency(s?: string): Currency {
  return (s || '').toLowerCase().includes('eur') ? 'EUR' : 'PLN';
}

function parseAttendance(s?: string): AttendanceType {
  return (s || '').toLowerCase().includes('obow') ? 'mandatory' : 'optional';
}

// Import wyjazdów z wierszy wgranego pliku CSV.
// Każdy wiersz tworzymy przez istniejące createTrip — bez duplikowania logiki.
export async function bulkImportTrips(rows: ImportTripRow[]): Promise<BulkImportResult> {
  const { user, role } = await getAuthUser();
  if (!user) return { imported: 0, errors: 0, details: ['Nie jesteś zalogowany'] };
  if (role !== 'admin') return { imported: 0, errors: 0, details: ['Brak uprawnień'] };

  // Mapa nazwa grupy (lowercase) -> id
  const supabaseAdmin = createAdminClient();
  const { data: groups } = await supabaseAdmin.from('groups').select('id, name');
  const groupMap = new Map<string, string>();
  (groups || []).forEach((g: { id: string; name: string }) => {
    groupMap.set(g.name.toLowerCase().trim(), g.id);
  });

  let imported = 0;
  let errors = 0;
  const details: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = row.tytul?.trim() || `wiersz ${i + 2}`;

    try {
      if (!row.tytul?.trim()) throw new Error('brak tytułu');

      const depDate = parseDate(row.data_wyjazdu);
      const retDate = parseDate(row.data_powrotu);
      if (!depDate) throw new Error('nieprawidłowa data wyjazdu (oczekiwany format DD.MM.RRRR)');
      if (!retDate) throw new Error('nieprawidłowa data powrotu (oczekiwany format DD.MM.RRRR)');

      // Grupa — dopasowanie po nazwie; brak dopasowania nie blokuje importu
      const groupIds: string[] = [];
      if (row.grupa?.trim()) {
        const gid = groupMap.get(row.grupa.toLowerCase().trim());
        if (gid) groupIds.push(gid);
        else details.push(`${label}: grupa "${row.grupa.trim()}" nie istnieje — wyjazd utworzony bez grupy`);
      }

      // Raty
      const payment_templates: CreatePaymentTemplateInput[] = [];
      const a1 = parseAmount(row.kwota_1);
      if (a1 > 0) {
        payment_templates.push({
          payment_type: 'installment',
          installment_number: 1,
          amount: a1,
          currency: parseCurrency(row.waluta_1),
          due_date: parseDate(row.termin_1),
          payment_method: 'transfer',
        });
      }
      const a2 = parseAmount(row.kwota_2);
      if (a2 > 0) {
        payment_templates.push({
          payment_type: 'installment',
          installment_number: 2,
          amount: a2,
          currency: parseCurrency(row.waluta_2),
          due_date: parseDate(row.termin_2),
          payment_method: 'transfer',
        });
      }

      const input: CreateTripInput = {
        title: row.tytul.trim(),
        description: row.opis?.trim() || null,
        departure_datetime: `${depDate}T${parseTime(row.godzina_wyjazdu)}:00`,
        departure_location: row.miejsce_wyjazdu?.trim() || 'Do ustalenia',
        return_datetime: `${retDate}T${parseTime(row.godzina_powrotu)}:00`,
        return_location: row.miejsce_powrotu?.trim() || 'Do ustalenia',
        status: 'draft',
        attendance_type: parseAttendance(row.typ),
        group_ids: groupIds,
        payment_templates,
      };

      const result = await createTrip(input);
      if (result.error) throw new Error(result.error);
      imported++;
    } catch (err) {
      errors++;
      details.push(`${label}: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
    }
  }

  return { imported, errors, details };
}
