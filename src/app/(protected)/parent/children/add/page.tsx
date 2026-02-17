export const dynamic = 'force-dynamic';

import { PageHeader, Breadcrumbs } from '@/components/shared';
import { ChildForm } from '@/components/parent';
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

      <PageHeader
        title="Dodaj dziecko"
        description="Wprowadź dane nowego uczestnika"
      />

      <ChildForm groups={groups} mode="create" />
    </div>
  );
}
