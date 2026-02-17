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
        description="Zarządzaj danymi swoich dzieci"
      >
        <Link
          href="/parent/children/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj dziecko
        </Link>
      </PageHeader>

      <ChildrenList children={children} />
    </div>
  );
}
