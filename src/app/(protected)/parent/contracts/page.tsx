export const dynamic = 'force-dynamic';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText, CheckCircle, Clock, AlertTriangle, BookOpen } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { ContractDocument } from '@/components/contract-document';
import { PrintContractButton } from '@/components/parent/print-contract-button';
import { getContractsForParent } from '@/lib/actions/contracts';
import { getProfile } from '@/lib/actions/profile';
import { getGlobalDocument, getDynamicDocuments } from '@/lib/actions/documents';
import { GLOBAL_DOCUMENTS } from '@/lib/global-documents';
import { GlobalDocumentReadonly } from '@/components/parent/global-document-readonly';
import { AcceptContractButton } from './accept-contract-button';

export default async function ParentContractsPage() {
  const [contracts, profile, dynamicDocs, ...docContents] = await Promise.all([
    getContractsForParent(),
    getProfile(),
    getDynamicDocuments(),
    ...GLOBAL_DOCUMENTS.map((doc) => getGlobalDocument(doc.id)),
  ]);

  const contractDataComplete = !!(
    profile?.first_name &&
    profile?.last_name &&
    profile?.address_street &&
    profile?.address_zip &&
    profile?.address_city &&
    profile?.pesel
  );

  const pending = contracts.filter((c) => !c.accepted_at);
  const accepted = contracts.filter((c) => c.accepted_at);

  const parentName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
    : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Dokumenty"
        description="Dokumenty ogólne i umowy uczestnictwa"
      />

      {/* ── SEKCJA: Dokumenty ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
            <BookOpen className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Dokumenty</h2>
          </div>
        </div>
        <div className="space-y-3">
          {GLOBAL_DOCUMENTS.map((doc, i) => (
            <GlobalDocumentReadonly
              key={doc.id}
              title={doc.title}
              content={docContents[i]}
            />
          ))}
          {dynamicDocs.map((doc) => (
            <GlobalDocumentReadonly
              key={doc.id}
              title={doc.title}
              content={doc.content}
            />
          ))}
        </div>
      </div>

      {/* ── SEKCJA: Umowy uczestnictwa ── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100">
          <FileText className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Umowy uczestnictwa</h2>
          <p className="text-xs text-gray-500">Zapoznaj się z umowami i zaakceptuj je dla każdego dziecka</p>
        </div>
      </div>

      {!contractDataComplete && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            Uzupełnij <Link href="/parent/profile" className="font-semibold underline hover:text-amber-900">dane do umowy w profilu</Link> (imię, nazwisko, adres, PESEL) — bez nich umowy nie będą zawierać Twoich danych.
          </span>
        </div>
      )}

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Brak umów do wyświetlenia</p>
            <p className="text-sm">Umowy pojawią się tutaj gdy organizator je wygeneruje</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Do akceptacji */}
          {pending.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-amber-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Do akceptacji ({pending.length})
              </h2>
              {pending.map((contract) => (
                <ContractCard key={contract.id} contract={contract} parentName={parentName} />
              ))}
            </div>
          )}

          {/* Zaakceptowane */}
          {accepted.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Zaakceptowane ({accepted.length})
              </h2>
              {accepted.map((contract) => (
                <ContractCard key={contract.id} contract={contract} parentName={parentName} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContractCard({
  contract,
  parentName,
}: {
  contract: Awaited<ReturnType<typeof getContractsForParent>>[number];
  parentName: string | null;
}) {
  const participant = contract.participants as {
    first_name: string;
    last_name: string;
    birth_date: string;
  } | null;

  const trip = contract.trips as {
    id: string;
    title: string;
    departure_datetime: string;
    return_datetime: string;
    departure_location: string;
    return_location: string;
  } | null;

  const childName = participant
    ? `${participant.first_name} ${participant.last_name}`
    : '—';

  const tripTitle = trip?.title ?? '—';
  const tripDates = trip
    ? `${format(new Date(trip.departure_datetime), 'd MMM', { locale: pl })} – ${format(
        new Date(trip.return_datetime),
        'd MMM yyyy',
        { locale: pl }
      )}`
    : '';

  const isAccepted = !!contract.accepted_at;
  const contractNumber = (contract as Record<string, unknown>).contract_number as string | null ?? null;

  return (
    <div className="space-y-3">
      {/* Karta nagłówkowa */}
      <Card className={isAccepted ? 'border-green-200 bg-green-50/20' : 'border-amber-200 bg-amber-50/10'}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                🏔️ {tripTitle} — {childName}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{tripDates}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {contractNumber && (
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {contractNumber}
                </span>
              )}
              {isAccepted ? (
                <>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Zaakceptowana
                    {contract.accepted_at && (
                      <span className="ml-1">
                        {format(new Date(contract.accepted_at), 'd.MM.yyyy', { locale: pl })}
                      </span>
                    )}
                  </Badge>
                  <PrintContractButton contractId={contract.id} contractNumber={contractNumber} />
                </>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  <Clock className="mr-1 h-3 w-3" />
                  Oczekuje akceptacji
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dokument umowy */}
      <ContractDocument
        text={contract.contract_text}
        showOwuLink={!isAccepted}
        contractNumber={contractNumber}
        acceptedAt={contract.accepted_at}
        acceptedByName={isAccepted ? parentName : null}
        contractId={contract.id}
      />

      {/* Akceptacja — tylko dla oczekujących */}
      {!isAccepted && (
        <Card className="border-amber-200">
          <CardContent className="pt-5 pb-5">
            <AcceptContractButton contractId={contract.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
