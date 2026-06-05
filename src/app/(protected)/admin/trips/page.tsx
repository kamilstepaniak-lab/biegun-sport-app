import Link from 'next/link';
import { Plus, MapPin, Upload } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { getTrips } from '@/lib/actions/trips';
import { getGroups } from '@/lib/actions/groups';
import { getTripContractTemplatesMap } from '@/lib/actions/contracts';
import { TripsList } from './trips-list';

export default async function AdminTripsPage() {
  const [trips, groups] = await Promise.all([
    getTrips(),
    getGroups(),
  ]);

  // Pobierz szablony umów równolegle — nie czekaj na trips sekwencyjnie
  const contractTemplates = await getTripContractTemplatesMap(trips.map((t) => t.id));
  // Uwaga: contractTemplates musi czekać na trips (potrzebuje trip IDs),
  // ale getTrips i getGroups są już równoległe powyżej — to optimum.

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wyjazdy"
        description={`Zarządzaj wyjazdami (${trips.length})`}
      >
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" asChild>
            <Link href="/admin/trips/import">
              <Upload className="h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button className="rounded-xl" asChild>
            <Link href="/admin/trips/add">
              <Plus className="h-4 w-4" />
              Nowy wyjazd
            </Link>
          </Button>
        </div>
      </PageHeader>

      {trips.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Brak wyjazdów"
          description="Nie utworzono jeszcze żadnych wyjazdów."
        >
          <Button className="rounded-xl" asChild>
            <Link href="/admin/trips/add">
              <Plus className="h-4 w-4" />
              Utwórz pierwszy wyjazd
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <TripsList trips={trips} groups={groups} contractTemplates={contractTemplates} />
      )}
    </div>
  );
}
