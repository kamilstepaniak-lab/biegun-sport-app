export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowLeft, CheckCircle, Clock, User, Mail } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/shared';
import { ContractDocument } from '@/components/contract-document';
import { getContractById } from '@/lib/actions/contracts';

interface PageProps {
  params: Promise<{ id: string; contractId: string }>;
}

export default async function AdminContractDetailPage({ params }: PageProps) {
  const { id, contractId } = await params;
  const contract = await getContractById(contractId);

  if (!contract) notFound();

  const participant = contract.participants as {
    first_name: string;
    last_name: string;
    birth_date: string;
    profiles: { email: string; first_name: string | null; last_name: string | null } | null;
  } | null;

  const trip = contract.trips as {
    id: string;
    title: string;
    departure_datetime: string;
    return_datetime: string;
  } | null;

  const childName = participant
    ? `${participant.first_name} ${participant.last_name}`
    : '—';
  const parentEmail = participant?.profiles?.email ?? '—';
  const parentName = participant?.profiles
    ? [participant.profiles.first_name, participant.profiles.last_name].filter(Boolean).join(' ') || parentEmail
    : '—';

  const isAccepted = !!contract.accepted_at;
  const contractNumber = (contract as Record<string, unknown>).contract_number as string | null ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs
        homeHref="/admin/groups"
        items={[
          { label: 'Wyjazdy', href: '/admin/trips' },
          { label: trip?.title ?? 'Wyjazd', href: `/admin/trips/${id}` },
          { label: 'Umowy', href: `/admin/trips/${id}/contracts` },
          { label: childName },
        ]}
      />

      {/* Nagłówek */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Podgląd umowy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trip?.title} — {childName}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/admin/trips/${id}/contracts`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do listy
          </Link>
        </Button>
      </div>

      {/* Metadane */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              {isAccepted ? (
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
            </div>

            {contractNumber && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Nr umowy</p>
                <p className="font-mono font-semibold text-gray-900">{contractNumber}</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <User className="h-3 w-3" /> Opiekun
              </p>
              <p className="text-sm font-medium text-gray-900">{parentName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </p>
              <p className="text-sm text-gray-700">{parentEmail}</p>
            </div>
          </div>

          {isAccepted && contract.accepted_at && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Zaakceptowano {format(new Date(contract.accepted_at), 'd MMMM yyyy o HH:mm', { locale: pl })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dokument umowy */}
      <ContractDocument
        text={contract.contract_text}
        contractNumber={contractNumber}
      />
    </div>
  );
}
