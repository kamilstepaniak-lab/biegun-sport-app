export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, FileText, CheckCircle, Clock, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, Breadcrumbs } from '@/components/shared';
import { getTrip } from '@/lib/actions/trips';
import { getContractsForTrip } from '@/lib/actions/contracts';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripContractsPage({ params }: PageProps) {
  const { id } = await params;

  const [trip, contracts] = await Promise.all([
    getTrip(id),
    getContractsForTrip(id),
  ]);

  if (!trip) notFound();

  const accepted = contracts.filter((c) => c.accepted_at);
  const pending = contracts.filter((c) => !c.accepted_at);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: trip.title, href: `/admin/trips/${id}` },
          { label: 'Umowy' },
        ]}
      />

      <PageHeader
        title="Umowy uczestnictwa"
        description={`${trip.title} — ${contracts.length} umów`}
      >
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Link>
        </Button>
      </PageHeader>

      {/* Statystyki */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{contracts.length}</p>
                <p className="text-sm text-muted-foreground">Wszystkie umowy</p>
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
                <p className="text-sm text-muted-foreground">Zaakceptowane</p>
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
                <p className="text-sm text-muted-foreground">Oczekuje</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela umów */}
      <Card>
        <CardHeader>
          <CardTitle>Lista umów</CardTitle>
          <CardDescription>
            Kliknij w wiersz aby zobaczyć pełną treść umowy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Brak wygenerowanych umów</p>
              <p className="text-sm">Wróć do wyjazdu i kliknij &quot;Generuj umowy&quot;</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 pr-4 font-medium">Nr</th>
                    <th className="text-left py-3 pr-4 font-medium">Dziecko</th>
                    <th className="text-left py-3 pr-4 font-medium">Rodzic (email)</th>
                    <th className="text-left py-3 pr-4 font-medium">Status</th>
                    <th className="text-left py-3 pr-4 font-medium">Data akceptacji</th>
                    <th className="text-left py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => {
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
                    const contractNumber = (contract as Record<string, unknown>).contract_number as string | null ?? null;

                    return (
                      <tr
                        key={contract.id}
                        className="border-b last:border-0 hover:bg-purple-50/40 transition-colors group"
                      >
                        <td className="py-3 pr-4">
                          {contractNumber ? (
                            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {contractNumber}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium">{childName}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          <div>{parentName}</div>
                          <div className="text-xs">{parentEmail}</div>
                        </td>
                        <td className="py-3 pr-4">
                          {contract.accepted_at ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Zaakceptowana
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              <Clock className="mr-1 h-3 w-3" />
                              Oczekuje
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {contract.accepted_at
                            ? format(new Date(contract.accepted_at), 'd MMMM yyyy, HH:mm', { locale: pl })
                            : '—'}
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/admin/trips/${id}/contracts/${contract.id}`}
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Podgląd
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
