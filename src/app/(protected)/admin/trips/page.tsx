import Link from 'next/link';
import { Plus, MapPin, Upload } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getTrips } from '@/lib/actions/trips';
import { getGroups } from '@/lib/actions/groups';
import { TripsList } from './trips-list';

export default async function AdminTripsPage() {
  const [trips, groups] = await Promise.all([
    getTrips(),
    getGroups(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wyjazdy"
        description={`Zarządzaj wyjazdami (${trips.length})`}
      >
        <div className="flex gap-2">
          <Link
            href="/admin/trips/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link
            href="/admin/trips/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nowy wyjazd
          </Link>
        </div>
      </PageHeader>

      {trips.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Brak wyjazdów"
          description="Nie utworzono jeszcze żadnych wyjazdów."
        >
          <Link
            href="/admin/trips/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Utwórz pierwszy wyjazd
          </Link>
        </EmptyState>
      ) : (
        <TripsList trips={trips} groups={groups} />
      )}
    </div>
  );
}
