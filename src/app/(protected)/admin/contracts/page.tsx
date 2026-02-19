export const dynamic = 'force-dynamic';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText, CheckCircle, Clock, ExternalLink, Library } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { ContractTemplateLibrary } from '@/components/admin/contract-template-library';
import { ContractsTable } from '@/components/admin/contracts-table';
import { getContractsForAdmin } from '@/lib/actions/contracts';
import { CONTRACT_TEMPLATE } from '@/lib/contract-template';

// ─── Szablony globalne (wzory umów do kopiowania) ───────────────────────────
const GLOBAL_TEMPLATES = [
  {
    id: 'umowa-zima',
    name: 'UMOWA ZIMA',
    description: 'Standardowy wzór umowy dla obozów zimowych (narty, snowboard)',
    text: CONTRACT_TEMPLATE,
  },
];

export default async function AdminContractsPage() {
  const contracts = await getContractsForAdmin();

  const accepted = contracts.filter((c) => c.accepted_at);
  const pending = contracts.filter((c) => !c.accepted_at);

  // Grupuj po wyjezdzie
  const byTrip = contracts.reduce<Record<string, typeof contracts>>((acc, contract) => {
    const tripId = contract.trip_id;
    if (!acc[tripId]) acc[tripId] = [];
    acc[tripId].push(contract);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <PageHeader
        title="Umowy uczestnictwa"
        description="Wszystkie umowy wygenerowane w systemie"
      />

      {/* ── SEKCJA: Szablony umów ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100">
            <Library className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Szablony umów</h2>
            <p className="text-xs text-gray-500">
              Wzory do edycji i kopiowania — wklej do edytora konkretnego wyjazdu
            </p>
          </div>
        </div>
        <ContractTemplateLibrary templates={GLOBAL_TEMPLATES} />
      </div>

      {/* ── SEKCJA: Statystyki ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{contracts.length}</p>
                <p className="text-sm text-muted-foreground">Wszystkich umów</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{accepted.length}</p>
                <p className="text-sm text-muted-foreground">Zaakceptowanych</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{pending.length}</p>
                <p className="text-sm text-muted-foreground">Oczekujących</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SEKCJA: Lista umów pogrupowana per wyjazd ── */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Brak umów w systemie</p>
            <p className="text-sm">
              Aktywuj wzór umowy dla wyjazdu — rodzice dostaną ją po potwierdzeniu
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byTrip).map(([tripId, tripContracts]) => {
          const trip = (tripContracts[0].trips as { id: string; title: string; departure_datetime: string } | null);
          const tripTitle = trip?.title ?? 'Nieznany wyjazd';
          const tripDate = trip?.departure_datetime
            ? format(new Date(trip.departure_datetime), 'd MMMM yyyy', { locale: pl })
            : '';
          const tripAccepted = tripContracts.filter((c) => c.accepted_at).length;

          // Mapuj do ContractRow
          const rows = tripContracts.map((contract) => {
            const participant = contract.participants as {
              first_name: string;
              last_name: string;
              profiles: { email: string; first_name: string | null; last_name: string | null } | null;
            } | null;

            const childName = participant
              ? `${participant.first_name} ${participant.last_name}`
              : '—';
            const parentEmail = participant?.profiles?.email ?? '—';
            const parentName = participant?.profiles
              ? [participant.profiles.first_name, participant.profiles.last_name].filter(Boolean).join(' ') || parentEmail
              : '—';

            return {
              id: contract.id,
              contract_number: (contract as Record<string, unknown>).contract_number as string | null ?? null,
              contract_text: contract.contract_text,
              accepted_at: contract.accepted_at,
              childName,
              parentName,
              parentEmail,
            };
          });

          return (
            <Card key={tripId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {tripTitle}
                    </CardTitle>
                    <CardDescription>
                      {tripDate} · {tripContracts.length} umów · {tripAccepted} zaakceptowanych
                    </CardDescription>
                  </div>
                  <Link
                    href={`/admin/trips/${tripId}/contracts`}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Szczegóły
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <ContractsTable contracts={rows} />
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
