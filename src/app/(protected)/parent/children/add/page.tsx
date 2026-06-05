import { UserPlus } from 'lucide-react';

import { Breadcrumbs } from '@/components/shared';
import { ChildForm } from '@/components/parent';
import { ParentPageHeader } from '@/components/parent/parent-page-header';
import { getSelectableGroups } from '@/lib/actions/groups';

export default async function AddChildPage() {
  const groups = await getSelectableGroups();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/parent/children"
        items={[
          { label: 'Moje dzieci', href: '/parent/children' },
          { label: 'Dodaj dziecko' },
        ]}
      />

      <ParentPageHeader
        icon={UserPlus}
        title="Dodaj dziecko"
        description="Wprowadź dane nowego uczestnika i wybierz grupę treningową."
        note="Dzięki temu pokażemy właściwe wyjazdy i terminy."
      />

      <ChildForm groups={groups} mode="create" />
    </div>
  );
}
