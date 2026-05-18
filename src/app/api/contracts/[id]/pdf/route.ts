import { renderToBuffer } from '@react-pdf/renderer';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/actions/auth-helpers';
import { ContractPdf } from '@/lib/contract-pdf';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, role } = await getAuthUser();
  if (!user) {
    return new Response('Nie jesteś zalogowany', { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: contract, error } = await supabaseAdmin
    .from('trip_contracts')
    .select(`
      id,
      contract_text,
      contract_number,
      accepted_at,
      participants!participant_id (
        first_name,
        last_name,
        parent_id,
        profiles:parent_id ( first_name, last_name, email )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !contract) {
    return new Response('Umowa nie istnieje', { status: 404 });
  }

  const participant = contract.participants as unknown as {
    first_name: string;
    last_name: string;
    parent_id: string;
    profiles: { first_name: string | null; last_name: string | null; email: string } | null;
  } | null;

  // Dostęp: admin albo rodzic będący właścicielem uczestnika
  if (role !== 'admin' && participant?.parent_id !== user.id) {
    return new Response('Brak uprawnień', { status: 403 });
  }

  const childName = participant
    ? `${participant.first_name} ${participant.last_name}`
    : 'umowa';
  const parentName = participant?.profiles
    ? [participant.profiles.first_name, participant.profiles.last_name]
        .filter(Boolean)
        .join(' ') || participant.profiles.email
    : null;

  const buffer = await renderToBuffer(
    ContractPdf({
      contractText: contract.contract_text,
      contractNumber: contract.contract_number ?? null,
      acceptedAt: contract.accepted_at ?? null,
      acceptedByName: parentName,
    })
  );

  const safeName = `Umowa_${(contract.contract_number ?? id).replace(/[^\w/-]+/g, '-').replace(/\//g, '-')}_${childName.replace(/\s+/g, '_')}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
