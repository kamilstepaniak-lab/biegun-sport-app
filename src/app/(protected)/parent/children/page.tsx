import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import { PageHeader } from '@/components/shared';
import { ChildrenList } from '@/components/parent';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';

export default async function ParentChildrenPage() {
  const [children, profile] = await Promise.all([
    getMyChildren(),
    getUserProfile(),
  ]);
  const firstName = profile?.full_name?.split(' ')[0] || 'Karol';
  const today = format(new Date(), 'EEEE · d MMMM yyyy', { locale: pl });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dzień dobry, ${firstName}`}
        description={`${today} — najbliższy wyjazd już czeka. Sprawdź szczegóły i opłać raty.`}
      />

      <ChildrenList participants={children} />
    </div>
  );
}
