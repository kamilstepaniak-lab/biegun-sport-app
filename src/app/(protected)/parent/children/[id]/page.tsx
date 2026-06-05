import { notFound } from 'next/navigation';
import { UserRoundCog } from 'lucide-react';

import { Breadcrumbs } from '@/components/shared';
import { ChildForm } from '@/components/parent';
import { ParentPageHeader } from '@/components/parent/parent-page-header';
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

      <ParentPageHeader
        icon={UserRoundCog}
        title="Edytuj dane dziecka"
        description="Zaktualizuj dane uczestnika oraz informacje ważne dla organizatora."
        note="Aktualne dane pomagają zadbać o bezpieczeństwo dziecka na wyjazdach."
      />

      <ChildForm
        groups={groups}
        child={child}
        mode="edit"
      />
    </div>
  );
}
