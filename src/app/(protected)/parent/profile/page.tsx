import { redirect } from 'next/navigation';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProfileForm } from '@/components/parent/profile-form';
import { ChangePasswordForm } from '@/components/parent/change-password-form';
import { DataExportSection } from '@/components/parent/data-export-section';
import { DeleteAccountSection } from '@/components/parent/delete-account-section';
import { getProfile } from '@/lib/actions/profile';

const CONTRACT_FIELDS: { key: string; label: string }[] = [
  { key: 'first_name', label: 'imię' },
  { key: 'last_name', label: 'nazwisko' },
  { key: 'address_street', label: 'ulica' },
  { key: 'address_zip', label: 'kod pocztowy' },
  { key: 'address_city', label: 'miejscowość' },
  { key: 'pesel', label: 'PESEL' },
];

export default async function ParentProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  const profileFields = profile as unknown as Record<string, unknown>;
  const missingContractFields = CONTRACT_FIELDS.filter((f) => !profileFields[f.key]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mój profil"
        description="Zadbaj o aktualne dane kontaktowe — instruktorzy używają ich, aby szybko się z Tobą skontaktować. Dane do umowy (adres, PESEL) są potrzebne do wygenerowania umów uczestnictwa."
      />

      {missingContractFields.length > 0 ? (
        <Alert className="rounded-xl border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
          <AlertTriangle />
          <AlertDescription className="text-amber-800">
            <span>
              Uzupełnij dane do umowy, aby umowy uczestnictwa zawierały Twoje dane. Brakuje:{' '}
              <span className="font-semibold">{missingContractFields.map((f) => f.label).join(', ')}</span>.
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">
            Dane do umowy są kompletne — umowy uczestnictwa wygenerują się z Twoimi danymi.
          </AlertDescription>
        </Alert>
      )}

      <ProfileForm profile={profile} />
      <ChangePasswordForm />
      <DataExportSection />
      <DeleteAccountSection />
    </div>
  );
}
