import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

import { ChildGuard } from '@/components/parent/child-guard';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentCalendarView } from './calendar-view';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentCalendarPage({ searchParams }: Props) {
  const profile = await getUserProfile();
  if (!profile) redirect('/login');

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

  // Query do listy wyjazdów — zachowuje wybór dziecka przy przejściu z kalendarza
  const childQuery = selectedChildId
    ? selectedChildId !== 'all' && childName
      ? `child=${selectedChildId}&childName=${encodeURIComponent(childName)}`
      : `child=${selectedChildId}`
    : 'child=all';

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={CalendarDays}
        title="Kalendarz"
        description={
          <>
            Terminy wyjazdów Twoich dzieci w przejrzystym widoku miesięcznym.
            <br className="hidden sm:block" />
            Kliknij dzień w kalendarzu, żeby przejść do szczegółów wyjazdu.
          </>
        }
      >
        <ParentChildSelector
          selectedChildId={selectedChildId}
          selectedChildName={childName}
          childrenList={childrenList}
        />
      </ParentPageHeader>

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName} childrenList={childrenList} showSelector={false}>
        <ParentCalendarView trips={trips} childQuery={childQuery} />
      </ChildGuard>
    </div>
  );
}
