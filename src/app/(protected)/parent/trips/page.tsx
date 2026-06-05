import { MapPin, Users } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentTripsList } from './trips-list';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentTripsPage({ searchParams }: Props) {
  const profile = await getUserProfile();
  if (!profile) return null;

  const { child: selectedChildId, childName } = await searchParams;

  const [trips, myChildren] = await Promise.all([
    getTripsForParentWithChildren(profile.id, selectedChildId === 'all' ? undefined : selectedChildId),
    getMyChildren(),
  ]);

  const childrenList = myChildren.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    groupName: c.group?.name ?? null,
  }));

  // Czy (wybrane) dzieci czekają na przypisanie do grupy przez organizatora?
  const relevantChildren = selectedChildId && selectedChildId !== 'all'
    ? myChildren.filter(c => c.id === selectedChildId)
    : myChildren;
  const awaitingGroup = relevantChildren.length > 0 && relevantChildren.every(c => !c.group);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wyjazdy"
        description="Tutaj zobaczysz wszystkie wyjazdy zaplanowane dla grupy Twojego dziecka. Potwierdź udział, aby zarezerwować miejsce, a przy wyjazdach dla chętnych zgłoś dziecko przed upływem terminu deklaracji. Po potwierdzeniu pojawi się umowa i płatność do opłacenia."
      />

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName} childrenList={childrenList}>
        {trips.length === 0 ? (
          awaitingGroup ? (
            <EmptyState
              icon={Users}
              title="Dziecko czeka na przypisanie do grupy"
              description="Organizator nie przypisał jeszcze dziecka do grupy treningowej. Po przypisaniu zobaczysz tutaj dostępne wyjazdy."
            />
          ) : (
            <EmptyState
              icon={MapPin}
              title="Brak dostępnych wyjazdów"
              description="Aktualnie nie ma wyjazdów dla grup tego dziecka."
            />
          )
        ) : (
          <div className="pt-4">
            <ParentTripsList trips={trips} />
          </div>
        )}
      </ChildGuard>
    </div>
  );
}
