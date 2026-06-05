import { getTripsForParentWithChildren } from '@/lib/actions/trips';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyChildren } from '@/lib/actions/participants';
import { ParentTripsShell } from './parent-trips-shell';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentTripsPage({ searchParams }: Props) {
  const profile = await getUserProfile();
  if (!profile) return null;

  const { child: selectedChildId, childName } = await searchParams;

  const [trips, myChildren] = await Promise.all([
    getTripsForParentWithChildren(profile.id, selectedChildId === 'all' ? undefined : selectedChildId),
    getMyChildren(),
  ]);

  const childrenList = myChildren.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    groupName: c.group?.name ?? null,
  }));

  // Czy (wybrane) dzieci czekają na przypisanie do grupy przez organizatora?
  const relevantChildren = selectedChildId && selectedChildId !== 'all'
    ? myChildren.filter(c => c.id === selectedChildId)
    : myChildren;
  const awaitingGroup = relevantChildren.length > 0 && relevantChildren.every(c => !c.group);

  return (
    <ParentTripsShell
      trips={trips}
      selectedChildId={selectedChildId}
      childName={childName}
      childrenList={childrenList}
      awaitingGroup={awaitingGroup}
    />
  );
}
