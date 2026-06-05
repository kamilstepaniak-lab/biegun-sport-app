import { redirect } from 'next/navigation';

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

// Stara „karta wyjazdu" została wycofana — przenosimy na rozwinięty wyjazd
// na liście (/parent/trips?trip=<id>), spójny widok dla rodzica.
export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  redirect(`/parent/trips?child=all&trip=${id}`);
}
