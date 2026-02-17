export const dynamic = 'force-dynamic';

import { PageHeader, Breadcrumbs } from '@/components/shared';
import { TripForm } from '@/components/admin';
import { getGroups } from '@/lib/actions/groups';

export default async function AddTripPage() {
  const groups = await getGroups();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: 'Nowy wyjazd' },
        ]}
      />

      <PageHeader
        title="Nowy wyjazd"
        description="Utwórz nowy wyjazd wypełniając formularz krok po kroku"
      />

      <TripForm groups={groups} mode="create" />
    </div>
  );
}
