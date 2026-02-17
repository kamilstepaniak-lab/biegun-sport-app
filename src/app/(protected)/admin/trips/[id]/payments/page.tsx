import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, Breadcrumbs, EmptyState } from '@/components/shared';
import { getTrip } from '@/lib/actions/trips';

interface TripPaymentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPaymentsPage({ params }: TripPaymentsPageProps) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  // TODO: Pobierz płatności dla wyjazdu
  const payments: unknown[] = [];

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
        description="Zarządzaj płatnościami uczestników"
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Tabela płatności</CardTitle>
          <CardDescription>
            Wszystkie płatności dla tego wyjazdu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Brak płatności"
              description="Nie ma jeszcze żadnych płatności dla tego wyjazdu. Płatności zostaną utworzone automatycznie po zapisaniu uczestników."
            />
          ) : (
            <div>
              {/* Tabela płatności będzie tutaj */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
