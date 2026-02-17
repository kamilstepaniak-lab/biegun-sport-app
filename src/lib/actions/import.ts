'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface ImportBufferRow {
  id: number;
  id_dziecka_csv: string | null;
  nazwisko_dziecka: string | null;
  imie_dziecka: string | null;
  data_urodzenia: string | null;
  mail_1: string | null;
  mail_2: string | null;
  telefon_1: string | null;
  telefon_2: string | null;
  sekcja: string | null;
  status_importu: string | null;
  blad_opis: string | null;
}

export interface ImportStats {
  total: number;
  imported: number;
  errors: number;
  skipped: number;
  newParents: number;
  newGroups: number;
  details: { id: number; name: string; status: string; error?: string }[];
}

// Parsuj datę z formatu DD.MM.YYYY lub D.M.YYYY na YYYY-MM-DD
function parseDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();

  // Obsługuj format DD.MM.YYYY / D.M.YYYY
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];

    if (year.length === 4 && !isNaN(Number(day)) && !isNaN(Number(month))) {
      const isoDate = `${year}-${month}-${day}`;
      // Waliduj datę
      const d = new Date(isoDate);
      if (!isNaN(d.getTime())) {
        return isoDate;
      }
    }
  }

  return null;
}

// Generuj losowe hasło
function generatePassword(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Normalizuj numer telefonu - zostaw tylko cyfry
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export async function getImportBufferData() {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('import_buffer')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching import_buffer:', error);
    return [];
  }

  return (data || []) as ImportBufferRow[];
}

export async function getImportBufferStats() {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from('import_buffer')
    .select('status_importu');

  if (error) {
    console.error('Error fetching import_buffer stats:', error);
    return { total: 0, oczekuje: 0, zaimportowano: 0, blad: 0 };
  }

  if (!data) return { total: 0, oczekuje: 0, zaimportowano: 0, blad: 0 };

  const stats = {
    total: data.length,
    oczekuje: data.filter(r => r.status_importu === 'oczekuje').length,
    zaimportowano: data.filter(r => r.status_importu === 'zaimportowano').length,
    blad: data.filter(r => r.status_importu === 'blad').length,
  };

  console.log('Import buffer stats:', stats);
  return stats;
}

export async function runImport(): Promise<ImportStats> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  // Sprawdź uprawnienia
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { total: 0, imported: 0, errors: 0, skipped: 0, newParents: 0, newGroups: 0, details: [] };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { total: 0, imported: 0, errors: 0, skipped: 0, newParents: 0, newGroups: 0, details: [] };
  }

  // 1. Pobierz rekordy do importu
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('import_buffer')
    .select('*')
    .eq('status_importu', 'oczekuje')
    .order('id', { ascending: true });

  if (fetchError || !rows || rows.length === 0) {
    return { total: 0, imported: 0, errors: 0, skipped: 0, newParents: 0, newGroups: 0, details: [] };
  }

  const records = rows as ImportBufferRow[];

  // 2. Pobierz istniejące grupy
  const { data: existingGroups } = await supabaseAdmin
    .from('groups')
    .select('id, name');

  const groupMap = new Map<string, string>();
  (existingGroups || []).forEach((g: { id: string; name: string }) => {
    groupMap.set(g.name.toUpperCase(), g.id);
  });

  // 3. Zbierz unikalne sekcje i utwórz brakujące grupy
  const uniqueSections = [...new Set(
    records
      .map(r => r.sekcja?.trim().toUpperCase())
      .filter((s): s is string => !!s)
  )];

  let newGroupsCount = 0;
  for (const section of uniqueSections) {
    if (!groupMap.has(section)) {
      const { data: newGroup, error: groupError } = await supabaseAdmin
        .from('groups')
        .insert({
          name: section,
          description: null,
          display_order: (existingGroups?.length || 0) + newGroupsCount + 1,
          is_selectable_by_parent: true,
        })
        .select('id')
        .single();

      if (groupError) {
        console.error(`Error creating group ${section}:`, groupError);
        continue;
      }

      if (newGroup) {
        groupMap.set(section, newGroup.id);
        newGroupsCount++;
      }
    }
  }

  // 4. Zbierz unikalne emaile i sprawdź istniejących rodziców
  const uniqueEmails = [...new Set(
    records
      .map(r => r.mail_1?.trim().toLowerCase())
      .filter((e): e is string => !!e)
  )];

  const parentMap = new Map<string, string>(); // email → profile.id

  // Sprawdź które emaile już istnieją w profiles
  if (uniqueEmails.length > 0) {
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('email', uniqueEmails);

    (existingProfiles || []).forEach((p: { id: string; email: string }) => {
      parentMap.set(p.email.toLowerCase(), p.id);
    });
  }

  // 5. Importuj rekord po rekordzie
  const stats: ImportStats = {
    total: records.length,
    imported: 0,
    errors: 0,
    skipped: 0,
    newParents: 0,
    newGroups: newGroupsCount,
    details: [],
  };

  for (const record of records) {
    const childName = `${record.imie_dziecka || ''} ${record.nazwisko_dziecka || ''}`.trim();

    try {
      // Walidacja
      if (!record.mail_1?.trim()) {
        throw new Error('Brak adresu email (mail_1)');
      }
      if (!record.imie_dziecka?.trim()) {
        throw new Error('Brak imienia dziecka');
      }
      if (!record.nazwisko_dziecka?.trim()) {
        throw new Error('Brak nazwiska dziecka');
      }

      const email = record.mail_1.trim().toLowerCase();
      const birthDate = parseDateToISO(record.data_urodzenia || '');

      if (!birthDate && record.data_urodzenia) {
        throw new Error(`Nieprawidłowy format daty: ${record.data_urodzenia}`);
      }

      // Znajdź lub utwórz rodzica
      let parentId = parentMap.get(email);
      const phone = normalizePhone(record.telefon_1);
      const phone2 = normalizePhone(record.telefon_2);
      const mail2 = record.mail_2?.trim() || null;

      if (!parentId) {
        // Utwórz konto auth
        const password = generatePassword();
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
        });

        if (authError) {
          // Może konto auth istnieje ale nie ma profilu
          if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
            // Spróbuj pobrać istniejącego usera
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = users?.find(u => u.email === email);
            if (existingUser) {
              parentId = existingUser.id;
            } else {
              throw new Error(`Nie można utworzyć konta: ${authError.message}`);
            }
          } else {
            throw new Error(`Błąd tworzenia konta: ${authError.message}`);
          }
        } else if (authUser?.user) {
          parentId = authUser.user.id;
        }

        if (!parentId) {
          throw new Error('Nie udało się uzyskać ID rodzica');
        }

        // Utwórz profil (ignoruj duplikaty)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: parentId,
            email: email,
            phone: phone || '',
            secondary_email: mail2,
            secondary_phone: phone2 || null,
            first_name: null,
            last_name: record.nazwisko_dziecka?.trim() || null,
            role: 'parent',
          });

        if (profileError && profileError.message.includes('duplicate')) {
          // Profil istnieje - zaktualizuj dane kontaktowe
          await supabaseAdmin
            .from('profiles')
            .update({
              phone: phone || undefined,
              secondary_email: mail2 || undefined,
              secondary_phone: phone2 || undefined,
            })
            .eq('id', parentId);
        } else if (profileError) {
          console.error('Profile insert error:', profileError);
        }

        parentMap.set(email, parentId);
        stats.newParents++;
      } else {
        // Rodzic już istnieje w mapie - zaktualizuj dane kontaktowe jeśli brakuje
        const updateData: Record<string, string> = {};
        if (phone) updateData.phone = phone;
        if (mail2) updateData.secondary_email = mail2;
        if (phone2) updateData.secondary_phone = phone2;

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', parentId);
        }
      }

      // Utwórz dziecko
      const { data: participant, error: participantError } = await supabaseAdmin
        .from('participants')
        .insert({
          parent_id: parentId,
          first_name: record.imie_dziecka.trim(),
          last_name: record.nazwisko_dziecka.trim(),
          birth_date: birthDate || null,
          height_cm: null,
          notes: record.id_dziecka_csv ? `Import CSV ID: ${record.id_dziecka_csv}` : null,
        })
        .select('id')
        .single();

      if (participantError) {
        throw new Error(`Błąd tworzenia uczestnika: ${participantError.message}`);
      }

      // Przypisz do grupy
      if (record.sekcja?.trim() && participant) {
        const groupId = groupMap.get(record.sekcja.trim().toUpperCase());
        if (groupId) {
          const { error: groupAssignError } = await supabaseAdmin
            .from('participant_groups')
            .insert({
              participant_id: participant.id,
              group_id: groupId,
              assigned_by: user.id,
            });

          if (groupAssignError) {
            console.error('Group assign error:', groupAssignError);
          }
        }
      }

      // Sukces - aktualizuj status
      await supabaseAdmin
        .from('import_buffer')
        .update({ status_importu: 'zaimportowano', blad_opis: null })
        .eq('id', record.id);

      stats.imported++;
      stats.details.push({ id: record.id, name: childName, status: 'ok' });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Nieznany błąd';

      await supabaseAdmin
        .from('import_buffer')
        .update({ status_importu: 'blad', blad_opis: errorMsg })
        .eq('id', record.id);

      stats.errors++;
      stats.details.push({ id: record.id, name: childName, status: 'error', error: errorMsg });
    }
  }

  revalidatePath('/admin/import');
  revalidatePath('/admin/groups');
  revalidatePath('/parent/children');

  return stats;
}

export async function fixContactData(): Promise<{ fixed: number; errors: number }> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { fixed: 0, errors: 0 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { fixed: 0, errors: 0 };

  // Pobierz wszystkie zaimportowane rekordy
  const { data: rows } = await supabaseAdmin
    .from('import_buffer')
    .select('*')
    .eq('status_importu', 'zaimportowano');

  if (!rows || rows.length === 0) return { fixed: 0, errors: 0 };

  let fixed = 0;
  let errors = 0;

  // Zbierz unikalne emaile
  const emailMap = new Map<string, { phone: string; mail2: string | null; phone2: string | null }>();

  for (const row of rows as ImportBufferRow[]) {
    if (!row.mail_1) continue;
    const email = row.mail_1.trim().toLowerCase();
    const phone = normalizePhone(row.telefon_1);
    const phone2 = normalizePhone(row.telefon_2);
    const mail2 = row.mail_2?.trim() || null;

    // Zachowaj dane - pierwszy rekord z danym emailem
    if (!emailMap.has(email)) {
      emailMap.set(email, { phone, mail2, phone2: phone2 || null });
    }
  }

  // Zaktualizuj profile
  for (const [email, data] of emailMap) {
    const updateData: Record<string, string | null> = {};
    if (data.phone) updateData.phone = data.phone;
    if (data.mail2) updateData.secondary_email = data.mail2;
    if (data.phone2) updateData.secondary_phone = data.phone2;

    if (Object.keys(updateData).length === 0) continue;

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('email', email);

    if (error) {
      console.error(`Fix contact for ${email}:`, error);
      errors++;
    } else {
      fixed++;
    }
  }

  revalidatePath('/admin/groups');
  return { fixed, errors };
}

export async function resetImportStatus() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return { error: 'Brak uprawnień' };

  const { error } = await supabaseAdmin
    .from('import_buffer')
    .update({ status_importu: 'oczekuje', blad_opis: null })
    .eq('status_importu', 'blad');

  if (error) {
    return { error: 'Nie udało się zresetować statusów' };
  }

  revalidatePath('/admin/import');
  return { success: true };
}
