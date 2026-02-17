import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared';
import { ProfileForm } from '@/components/parent/profile-form';
import { getProfile } from '@/lib/actions/profile';

export default async function ParentProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mój profil"
        description="Zarządzaj swoimi danymi osobowymi i kontaktowymi"
      />

      <ProfileForm profile={profile} />
    </div>
  );
}
