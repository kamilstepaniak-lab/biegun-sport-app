export const dynamic = 'force-dynamic';

import { FileText, CheckCircle, Clock, AlertTriangle, BookOpen, User } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared';
import { getContractsForParent } from '@/lib/actions/contracts';
import { getProfile } from '@/lib/actions/profile';
import { getGlobalDocument, getDynamicDocuments } from '@/lib/actions/documents';
import { GLOBAL_DOCUMENTS } from '@/lib/global-documents';
import { GlobalDocumentReadonly } from '@/components/parent/global-document-readonly';
import { ContractCard } from './contract-card';

interface Props {
  searchParams: Promise<{ child?: string; childName?: string }>;
}

export default async function ParentContractsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedChildId = params.child;
  const selectedChildName = params.childName ? decodeURIComponent(params.childName) : null;

  const [contracts, profile, dynamicDocs, ...docContents] = await Promise.all([
    getContractsForParent(selectedChildId === 'all' ? undefined : selectedChildId),
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
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600">
            <BookOpen className="h-4 w-4 text-white" />
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
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Umowy uczestnictwa</h2>
          <p className="text-xs text-gray-500">
            {selectedChildName
              ? `Umowy dla: ${selectedChildName}`
              : 'Zapoznaj się z umowami i zaakceptuj je dla każdego dziecka'}
          </p>
        </div>
      </div>

      {/* Baner wybranego dziecka */}
      {selectedChildId && selectedChildName && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
          <User className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-800">
            Pokazuję umowy dla: <strong>{selectedChildName}</strong>
          </span>
          <Link
            href="/parent/contracts"
            className="ml-auto text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Pokaż wszystkie
          </Link>
        </div>
      )}

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
            <p className="text-sm">
              {selectedChildId
                ? 'Brak umów dla wybranego dziecka'
                : 'Umowy pojawią się tutaj gdy organizator je wygeneruje'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Do akceptacji */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-amber-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Do akceptacji ({pending.length})
              </h2>
              {pending.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract as Parameters<typeof ContractCard>[0]['contract']}
                  parentName={parentName}
                />
              ))}
            </div>
          )}

          {/* Zaakceptowane */}
          {accepted.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Zaakceptowane ({accepted.length})
              </h2>
              {accepted.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract as Parameters<typeof ContractCard>[0]['contract']}
                  parentName={parentName}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
