export const dynamic = 'force-dynamic';

import { MapPin } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUser } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentTripsList } from './trips-list';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentTripsPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) return null;

  const { child: selectedChildId, childName } = await searchParams;

  const [trips, myChildren] = await Promise.all([
    getTripsForParentWithChildren(user.id, selectedChildId),
    getMyChildren(),
  ]);

  const childrenList = myChildren.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wyjazdy"
        description="Przeglądaj wyjazdy i potwierdź uczestnictwo dzieci"
      />

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName} childrenList={childrenList}>
        {trips.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Brak dostępnych wyjazdów"
            description="Aktualnie nie ma wyjazdów dla grup tego dziecka."
          />
        ) : (
          <ParentTripsList trips={trips} />
        )}
      </ChildGuard>
    </div>
  );
}
