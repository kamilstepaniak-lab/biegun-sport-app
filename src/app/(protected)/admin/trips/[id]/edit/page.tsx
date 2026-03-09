import { notFound } from 'next/navigation';

import { PageHeader, Breadcrumbs } from '@/components/shared';
import { TripForm } from '@/components/admin';
import { getTrip } from '@/lib/actions/trips';
import { getGroups } from '@/lib/actions/groups';

interface EditTripPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { id } = await params;
  const [trip, groups] = await Promise.all([getTrip(id), getGroups()]);

  if (!trip) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: trip.title, href: `/admin/trips/${id}` },
          { label: 'Edycja' },
        ]}
      />

      <PageHeader
        title={`Edytuj: ${trip.title}`}
        description="Zaktualizuj dane wyjazdu"
      />

      <TripForm groups={groups} trip={trip} mode="edit" />
    </div>
  );
}
