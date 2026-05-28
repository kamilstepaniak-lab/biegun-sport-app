import { listTripRegistrationRequests } from '@/lib/actions/trip-registration-requests';
import RegistrationsList from './registrations-list';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await listTripRegistrationRequests({ status: 'pending' });

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Zgłoszenia z formularza WordPress</h1>
        <p className="text-sm text-muted-foreground">
          Zatwierdzenie tworzy konto rodzica (magic link), dziecko trafia do CRM jako „Bez kategorii"
          i zostaje zapisane na wyjazd. Standardowy mail rejestracyjny wychodzi automatycznie.
        </p>
      </header>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <RegistrationsList initialRows={data ?? []} />
    </div>
  );
}
