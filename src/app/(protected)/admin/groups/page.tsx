export const dynamic = 'force-dynamic';

import { Users } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/shared';
import { getGroupsWithParticipants } from '@/lib/actions/groups';
import { getImportBufferStats } from '@/lib/actions/import';
import { GroupsList } from './groups-list';

export default async function AdminGroupsPage() {
  const [groups, importStats] = await Promise.all([
    getGroupsWithParticipants(),
    getImportBufferStats(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupy"
        description="Zarządzaj grupami treningowymi"
      />

      {groups.length === 0 && importStats.oczekuje === 0 ? (
        <EmptyState
          icon={Users}
          title="Brak grup"
          description="Nie ma jeszcze żadnych grup w systemie."
        />
      ) : (
        <GroupsList groups={groups} importStats={importStats} />
      )}
    </div>
  );
}
