export const dynamic = 'force-dynamic';

import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getTripsImportBuffer } from '@/lib/actions/trips-import';
import { TripsImportClient } from './trips-import-client';

export default async function TripsImportPage() {
  const { data: records, error } = await getTripsImportBuffer();

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
        description="Zaimportuj wyjazdy z tabeli trips_import_buffer w Supabase"
      />

      {error ? (
        <div className="p-4 bg-destructive/10 rounded-lg text-destructive">
          Błąd: {error}
        </div>
      ) : (
        <TripsImportClient records={records} />
      )}
    </div>
  );
}
