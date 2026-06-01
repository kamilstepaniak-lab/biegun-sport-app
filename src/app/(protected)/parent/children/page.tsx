import Link from 'next/link';
import { Plus } from 'lucide-react';
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
      >
        <Link
          href="/parent/children/add"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj dziecko
        </Link>
      </PageHeader>

      <ChildrenList participants={children} />
    </div>
  );
}
