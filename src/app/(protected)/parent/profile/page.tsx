import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared';
import { ProfileForm } from '@/components/parent/profile-form';
import { ChangePasswordForm } from '@/components/parent/change-password-form';
import { DataExportSection } from '@/components/parent/data-export-section';
import { DeleteAccountSection } from '@/components/parent/delete-account-section';
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
        description="Zadbaj o aktualne dane kontaktowe — instruktorzy używają ich, aby szybko się z Tobą skontaktować. Dane do umowy (adres, PESEL) są potrzebne do wygenerowania umów uczestnictwa."
      />

      <ProfileForm profile={profile} />
      <ChangePasswordForm />
      <DataExportSection />
      <DeleteAccountSection />
    </div>
  );
}
