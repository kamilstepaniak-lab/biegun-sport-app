import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Users } from 'lucide-react';

import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { ChildrenList } from '@/components/parent';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { getMessagesForParent } from '@/lib/actions/messages';
import { getDashboardDataForChildren, type DashboardData } from '@/lib/actions/dashboard';

function buildAggregateDashboard(
  items: DashboardData[],
  participants: { first_name: string; last_name: string }[],
): DashboardData {
  // Dedup wyjazdów po id — kilkoro dzieci może być na tym samym wyjeździe;
  // zbieramy imiona dzieci, których dotyczy dany wyjazd.
  const tripMap = new Map<string, DashboardData['upcomingTrips'][number]>();
  items.forEach((item, idx) => {
    const child = participants[idx];
    const childName = `${child.first_name} ${child.last_name}`;
    item.upcomingTrips.forEach((trip) => {
      const existing = tripMap.get(trip.id);
      if (existing) {
        existing.childNames = [...(existing.childNames ?? []), childName];
      } else {
        tripMap.set(trip.id, { ...trip, childNames: [childName] });
      }
    });
  });
  return {
    upcomingTrips: Array.from(tripMap.values())
      .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime())
      .slice(0, 2),
    overduePayments: items.flatMap((item) => item.overduePayments),
    upcomingPayments: items.flatMap((item) => item.upcomingPayments),
    overdueCount: items.reduce((sum, item) => sum + item.overdueCount, 0),
    attendance: {
      completed: items.reduce((sum, item) => sum + item.attendance.completed, 0),
      total: items.reduce((sum, item) => sum + item.attendance.total, 0),
    },
  };
}

export default async function ParentChildrenPage() {
  const [children, profile, messages] = await Promise.all([
    getMyChildren(),
    getUserProfile(),
    getMessagesForParent(),
  ]);

  // Dashboard liczony serwerowo dla wszystkich dzieci jednym kompletem zapytań
  // (batch) — klient nie robi fetchy w useEffect, a liczba dzieci nie mnoży
  // round-tripów do bazy.
  const dashboardByChild = await getDashboardDataForChildren(children.map((c) => c.id));
  const perChild = children.map((c) => dashboardByChild[c.id]);
  const dashboardAll = buildAggregateDashboard(perChild, children);

  const firstName = profile?.first_name?.trim() || 'Rodzicu';
  const today = format(new Date(), 'EEEE · d MMMM yyyy', { locale: pl });

  return (
    <div className="space-y-6">
      <ParentPageHeader
        icon={Users}
        title={`Dzień dobry, ${firstName}`}
        description={`${today}. Sprawdź najbliższe wyjazdy swoich dzieci, opłać raty i zaakceptuj umowy. Najważniejsze sprawy do załatwienia znajdziesz na kartach poniżej.`}
      />

      <ChildrenList
        participants={children}
        initialMessages={messages}
        dashboardByChild={dashboardByChild}
        dashboardAll={dashboardAll}
      />
    </div>
  );
}
