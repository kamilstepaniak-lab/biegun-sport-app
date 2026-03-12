import { createAdminClient } from '@/lib/supabase/server';
import { EmbedFormAdmin } from './embed-form-admin';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripEmbedPage({ params }: Props) {
  const { id: tripId } = await params;
  const admin = createAdminClient();

  // Pobierz dane wyjazdu
  const { data: trip } = await admin
    .from('trips')
    .select('id, title, departure_datetime')
    .eq('id', tripId)
    .single();

  if (!trip) notFound();

  // Pobierz istniejący formularz embed
  const { data: embedForm } = await admin
    .from('trip_embed_forms')
    .select('*')
    .eq('trip_id', tripId)
    .single();

  return (
    <EmbedFormAdmin
      tripId={tripId}
      tripTitle={trip.title}
      embedForm={embedForm}
    />
  );
}
