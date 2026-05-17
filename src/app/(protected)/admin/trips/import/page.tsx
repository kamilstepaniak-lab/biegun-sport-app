import { PageHeader, Breadcrumbs } from '@/components/shared';
import { TripsImportClient } from './trips-import-client';

export default function TripsImportPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: 'Import' },
        ]}
      />

      <PageHeader
        title="Import wyjazdów"
        description="Wgraj plik CSV, aby dodać wiele wyjazdów naraz"
      />

      <TripsImportClient />
    </div>
  );
}
