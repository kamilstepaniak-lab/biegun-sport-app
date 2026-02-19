import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentCalendarView } from './calendar-view';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentCalendarPage({ searchParams }: Props) {
  const profile = await getUserProfile();
  if (!profile) redirect('/login');

  const { child: selectedChildId, childName } = await searchParams;

  const [trips, myChildren] = await Promise.all([
    getTripsForParentWithChildren(profile.id, selectedChildId),
    getMyChildren(),
  ]);

  const childrenList = myChildren.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
  }));

  // Pobierz grupę wybranego dziecka (do domyślnego filtra kalendarza)
  const selectedChild = myChildren.find(c => c.id === selectedChildId) ?? myChildren[0];
  const defaultGroupId = selectedChild?.group?.id ?? undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalendarz"
        description="Widok kalendarza z wyjazdami"
      />

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName} childrenList={childrenList}>
        <ParentCalendarView trips={trips} defaultGroupId={defaultGroupId} />
      </ChildGuard>
    </div>
  );
}
