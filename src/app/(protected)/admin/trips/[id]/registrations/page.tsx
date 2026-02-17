import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getTrip, getTripParticipants } from '@/lib/actions/trips';
import { RegistrationsList } from './registrations-list';

interface TripRegistrationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripRegistrationsPage({ params }: TripRegistrationsPageProps) {
  const { id } = await params;
  const [trip, participants] = await Promise.all([
    getTrip(id),
    getTripParticipants(id),
  ]);

  if (!trip) {
    notFound();
  }

  const confirmedCount = participants.filter(p => p.participation_status === 'confirmed').length;
  const notGoingCount = participants.filter(p => p.participation_status === 'not_going').length;
  const unconfirmedCount = participants.filter(p => p.participation_status === 'unconfirmed').length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: trip.title, href: `/admin/trips/${id}` },
          { label: 'Zapisani' },
        ]}
      />

      <PageHeader
        title={`Zapisani: ${trip.title}`}
        description={`Jadą: ${confirmedCount} | Nie jadą: ${notGoingCount} | Niepotwierdzeni: ${unconfirmedCount}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      <RegistrationsList
        tripId={id}
        participants={participants}
        groups={trip.groups || []}
        tripTitle={trip.title}
        stop1Name={trip.departure_location}
        stop2Name={trip.departure_stop2_location}
      />
    </div>
  );
}
