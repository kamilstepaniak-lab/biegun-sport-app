import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText, CheckCircle, Clock, ExternalLink, Library, BookOpen, Archive } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard, PageHeader, SectionTitle } from '@/components/shared';
import { ContractTemplateLibrary } from '@/components/admin/contract-template-library';
import { ContractsTable } from '@/components/admin/contracts-table';
import { GlobalDocumentEditor } from '@/components/admin/global-document-editor';
import { DynamicDocumentEditor } from '@/components/admin/dynamic-document-editor';
import { AddDocumentDialog } from '@/components/admin/add-document-dialog';
import { getContractsForAdmin, getArchivedContractsForAdmin } from '@/lib/actions/contracts';
import { getGlobalDocument, getDynamicDocuments } from '@/lib/actions/documents';
import { CONTRACT_TEMPLATE } from '@/lib/contract-template';
import { GLOBAL_DOCUMENTS } from '@/lib/global-documents';

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
  const [contracts, archivedContracts, dynamicDocs, ...docContents] = await Promise.all([
    getContractsForAdmin(),
    getArchivedContractsForAdmin(),
    getDynamicDocuments(),
    ...GLOBAL_DOCUMENTS.map((doc) => getGlobalDocument(doc.id)),
  ]);

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
    <div className="space-y-6">
      <PageHeader
        title="Dokumenty"
        description="Dokumenty ogólne i umowy uczestnictwa"
      />

      {/* ── SEKCJA: Dokumenty ── */}
      <div className="space-y-4">
        <SectionTitle
          icon={BookOpen}
          title="Dokumenty"
          description="Stałe dokumenty widoczne dla rodziców — możesz edytować ich treść"
        />
        <div className="space-y-3">
          {GLOBAL_DOCUMENTS.map((doc, i) => (
            <GlobalDocumentEditor
              key={doc.id}
              id={doc.id}
              title={doc.title}
              initialContent={docContents[i]}
              defaultContent={doc.defaultContent}
            />
          ))}
          {dynamicDocs.map((doc) => (
            <DynamicDocumentEditor
              key={doc.id}
              id={doc.id}
              initialTitle={doc.title}
              initialContent={doc.content}
            />
          ))}
          <AddDocumentDialog />
        </div>
      </div>

      {/* ── SEKCJA: Szablony umów ── */}
      <div className="space-y-4">
        <SectionTitle
          icon={Library}
          title="Szablony umów"
          description="Wzory do edycji i kopiowania — wklej do edytora konkretnego wyjazdu"
        />
        <ContractTemplateLibrary templates={GLOBAL_TEMPLATES} />
      </div>

      {/* ── SEKCJA: Statystyki ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={FileText} label="Wszystkich umów" value={contracts.length} tone="blue" />
        <MetricCard icon={CheckCircle} label="Zaakceptowanych" value={accepted.length} tone="emerald" />
        <MetricCard icon={Clock} label="Oczekujących" value={pending.length} tone="amber" />
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

      {/* ── SEKCJA: Archiwum (umowy po usunięciu wyjazdu) ── */}
      {archivedContracts.length > 0 && (
        <div className="space-y-4">
          <SectionTitle
            icon={Archive}
            title="Archiwum"
            description="Podpisane umowy z usuniętych wyjazdów — dowód prawny zachowany"
            tone="slate"
          />
          <Card>
            <CardContent className="pt-6">
              <ContractsTable
                contracts={archivedContracts.map((contract) => {
                  const participant = contract.participants as {
                    first_name: string;
                    last_name: string;
                    profiles: { email: string; first_name: string | null; last_name: string | null } | null;
                  } | null;
                  const trip = contract.trips as { title: string; departure_datetime: string } | null;
                  const c = contract as Record<string, unknown>;
                  const tripTitle = trip?.title
                    ?? (c.trip_title_snapshot as string | null)
                    ?? 'Usunięty wyjazd';
                  const tripDate = trip?.departure_datetime
                    ?? (c.trip_departure_snapshot as string | null);
                  const childName = participant
                    ? `${participant.first_name} ${participant.last_name}`
                    : '—';
                  const parentEmail = participant?.profiles?.email ?? '—';
                  const parentName = participant?.profiles
                    ? [participant.profiles.first_name, participant.profiles.last_name].filter(Boolean).join(' ') || parentEmail
                    : '—';
                  return {
                    id: contract.id,
                    contract_number: c.contract_number as string | null ?? null,
                    contract_text: contract.contract_text,
                    accepted_at: contract.accepted_at,
                    childName: `${childName} — ${tripTitle}${tripDate ? ` (${format(new Date(tripDate), 'd MMM yyyy', { locale: pl })})` : ''}`,
                    parentName,
                    parentEmail,
                  };
                })}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
