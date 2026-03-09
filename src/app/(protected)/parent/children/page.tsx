import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { ChildrenList } from '@/components/parent';
import { getMyChildren } from '@/lib/actions/participants';

export default async function ParentChildrenPage() {
  const children = await getMyChildren();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje dzieci"
        description="Wybierz dane dla wszystkich dzieci razem lub dla jednego wybranego dziecka"
      >
        <Link
          href="/parent/children/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj dziecko
        </Link>
      </PageHeader>

      <ChildrenList children={children} />
    </div>
  );
}
