import { PageHeader } from '@/components/shared';
import { getTrips } from '@/lib/actions/trips';
import { CalendarView } from './calendar-view';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  const trips = await getTrips();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalendarz"
        description="Widok kalendarza z wyjazdami"
      />

      <CalendarView trips={trips} />
    </div>
  );
}
