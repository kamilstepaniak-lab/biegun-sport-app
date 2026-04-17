'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from './auth-helpers';

const externalChildSchema = z.object({
  parent_email: z.string().email('Nieprawidłowy email'),
  parent_first_name: z.string().min(1, 'Imię rodzica wymagane').max(50),
  parent_last_name: z.string().min(1, 'Nazwisko rodzica wymagane').max(50),
  parent_phone: z.string().max(30).optional().or(z.literal('')),
  first_name: z.string().min(2, 'Imię dziecka min. 2 znaki').max(50),
  last_name: z.string().min(2, 'Nazwisko dziecka min. 2 znaki').max(50),
  birth_date: z
    .string()
    .min(1, 'Data urodzenia jest wymagana')
    .refine((d) => new Date(d) <= new Date(), 'Data urodzenia nie może być w przyszłości'),
  height_cm: z.number().positive().max(250).nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
});

export type ExternalChildInput = z.infer<typeof externalChildSchema>;

export async function createExternalChild(formData: ExternalChildInput) {
  const { user, role } = await getAuthUser();
  if (!user) return { error: 'Nie jesteś zalogowany' };
  if (role !== 'admin') return { error: 'Brak uprawnień' };

  const parsed = externalChildSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  const admin = createAdminClient();

  // Sprawdź czy konto o tym emailu już istnieje w auth
  let parentId: string | null = null;
  {
    let page = 1;
    while (true) {
      const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError || !listData) break;
      const found = listData.users.find(u => u.email?.toLowerCase() === data.parent_email.toLowerCase());
      if (found) {
        parentId = found.id;
        break;
      }
      if (listData.users.length < 1000) break;
      page++;
    }
  }

  // Jeśli nie ma konta — wyślij zaproszenie (magic link do ustawienia hasła)
  if (!parentId) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      data.parent_email,
      {
        data: {
          first_name: data.parent_first_name,
          last_name: data.parent_last_name,
          phone: data.parent_phone || '',
        },
      }
    );

    if (inviteError || !invited?.user) {
      console.error('Invite error:', inviteError);
      return { error: `Nie udało się zaprosić rodzica: ${inviteError?.message ?? 'nieznany błąd'}` };
    }

    parentId = invited.user.id;

    // Ustaw role w app_metadata
    await admin.auth.admin.updateUserById(parentId, { app_metadata: { role: 'parent' } });

    // Trigger handle_new_user utworzył profil; upewnij się że dane kontaktowe są zapisane
    await admin
      .from('profiles')
      .update({
        first_name: data.parent_first_name,
        last_name: data.parent_last_name,
        phone: data.parent_phone || '',
      })
      .eq('id', parentId);
  }

  // Utwórz uczestnika
  const { data: participant, error: participantError } = await admin
    .from('participants')
    .insert({
      parent_id: parentId,
      first_name: data.first_name,
      last_name: data.last_name,
      birth_date: data.birth_date,
      height_cm: data.height_cm ?? null,
    })
    .select()
    .single();

  if (participantError || !participant) {
    console.error('Participant create error:', participantError);
    return { error: 'Nie udało się dodać dziecka' };
  }

  // Przypisz do grupy jeśli wybrana (dla dzieci "z zewnątrz" zwykle brak grupy)
  if (data.group_id) {
    const { error: groupError } = await admin
      .from('participant_groups')
      .insert({
        participant_id: participant.id,
        group_id: data.group_id,
        assigned_by: user.id,
      });
    if (groupError) console.error('Group assign error:', groupError);
  }

  revalidatePath('/admin/participants');
  revalidatePath('/admin/groups');
  return { success: true, data: participant };
}
