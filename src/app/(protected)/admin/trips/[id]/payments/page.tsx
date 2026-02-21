export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getTrip } from '@/lib/actions/trips';
import { getPaymentsForTrip } from '@/lib/actions/payments';
import { TripPaymentsList } from './trip-payments-list';

interface TripPaymentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPaymentsPage({ params }: TripPaymentsPageProps) {
  const { id } = await params;

  const [trip, payments] = await Promise.all([
    getTrip(id),
    getPaymentsForTrip(id),
  ]);

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
          { label: 'Płatności' },
        ]}
      />

      <PageHeader
        title={`Płatności: ${trip.title}`}
        description={`${payments.length} płatności`}
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      <TripPaymentsList payments={payments} tripTitle={trip.title} />
    </div>
  );
}
