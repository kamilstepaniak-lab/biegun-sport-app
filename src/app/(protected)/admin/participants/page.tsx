import { PageHeader } from '@/components/shared';
import { getAllParticipants } from '@/lib/actions/participants';
import { getGroups } from '@/lib/actions/groups';
import { ParticipantsList } from './participants-list';

export default async function AdminParticipantsPage() {
  const [participants, groups] = await Promise.all([
    getAllParticipants(),
    getGroups(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uczestnicy"
        description="Baza wszystkich dzieci w systemie"
      />
      <ParticipantsList participants={participants} groups={groups} />
    </div>
  );
}
