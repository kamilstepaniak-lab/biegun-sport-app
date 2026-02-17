import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { ChildGuard } from '@/components/parent/child-guard';
import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUserProfile } from '@/lib/actions/auth';
import { ParentCalendarView } from './calendar-view';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentCalendarPage({ searchParams }: Props) {
  const profile = await getUserProfile();
  if (!profile) redirect('/login');

  const { child: selectedChildId, childName } = await searchParams;

  const trips = await getTripsForParentWithChildren(profile.id, selectedChildId);

  // Znajdź grupę dziecka z pierwszego wyjazdu (do domyślnego filtra kalendarza)
  const defaultGroupId = selectedChildId && trips.length > 0
    ? trips[0].groups?.[0]?.id
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalendarz"
        description="Widok kalendarza z wyjazdami"
      />

      <ChildGuard selectedChildId={selectedChildId} selectedChildName={childName}>
        <ParentCalendarView trips={trips} defaultGroupId={defaultGroupId} />
      </ChildGuard>
    </div>
  );
}
