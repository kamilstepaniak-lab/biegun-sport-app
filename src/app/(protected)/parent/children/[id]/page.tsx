import { notFound } from 'next/navigation';

import { PageHeader, Breadcrumbs } from '@/components/shared';
import { ChildForm } from '@/components/parent';
import { getParticipantFull } from '@/lib/actions/participants';
import { getSelectableGroups } from '@/lib/actions/groups';

interface EditChildPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChildPage({ params }: EditChildPageProps) {
  const { id } = await params;
  const [child, groups] = await Promise.all([
    getParticipantFull(id),
    getSelectableGroups(),
  ]);

  if (!child) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/parent/children"
        items={[
          { label: 'Moje dzieci', href: '/parent/children' },
          { label: `${child.first_name} ${child.last_name}` },
        ]}
      />

      <PageHeader
        title={`Edytuj: ${child.first_name} ${child.last_name}`}
        description="Zaktualizuj dane uczestnika"
      />

      <ChildForm
        groups={groups}
        child={child}
        mode="edit"
      />
    </div>
  );
}
