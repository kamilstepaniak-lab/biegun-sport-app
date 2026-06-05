import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import { PageHeader } from '@/components/shared';
import { ChildrenList } from '@/components/parent';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { getMessagesForParent } from '@/lib/actions/messages';
import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard';

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

  // Dashboard liczony serwerowo dla każdego dziecka naraz — klient nie robi
  // już fetchy w useEffect (koniec migotania skeletonów przy przełączaniu).
  const perChild = await Promise.all(children.map((child) => getDashboardData(child.id)));
  const dashboardByChild: Record<string, DashboardData> = {};
  children.forEach((child, idx) => { dashboardByChild[child.id] = perChild[idx]; });
  const dashboardAll = buildAggregateDashboard(perChild, children);

  const firstName = profile?.full_name?.split(' ')[0]
    || profile?.email?.split('@')[0]
    || 'Witaj';
  const today = format(new Date(), 'EEEE · d MMMM yyyy', { locale: pl });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dzień dobry, ${firstName}`}
        description={`${today} — sprawdź najbliższe wyjazdy swoich dzieci, opłać raty i zaakceptuj umowy. Wszystko, co wymaga uwagi, znajdziesz na kartach poniżej.`}
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
