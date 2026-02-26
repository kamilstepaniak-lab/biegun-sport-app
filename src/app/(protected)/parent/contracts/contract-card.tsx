'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContractDocument } from '@/components/contract-document';
import { PrintContractButton } from '@/components/parent/print-contract-button';
import { AcceptContractButton } from './accept-contract-button';

interface ContractCardProps {
  contract: {
    id: string;
    contract_text: string;
    accepted_at: string | null;
    contract_number?: string | null;
    participants: { first_name: string; last_name: string; birth_date: string } | null;
    trips: {
      id: string;
      title: string;
      departure_datetime: string;
      return_datetime: string;
      departure_location: string;
      return_location: string;
    } | null;
  };
  parentName: string | null;
}

export function ContractCard({ contract, parentName }: ContractCardProps) {
  const isAccepted = !!contract.accepted_at;
  // Oczekujące: domyślnie rozwinięte (trzeba przeczytać)
  // Zaakceptowane: domyślnie zwinięte
  const [expanded, setExpanded] = useState(!isAccepted);

  const participant = contract.participants;
  const trip = contract.trips;

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

  const contractNumber = contract.contract_number ?? null;

  return (
    <div className="space-y-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Nagłówek karty — zawsze widoczny */}
      <div
        className={`px-5 py-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
          isAccepted
            ? 'bg-green-50/40 hover:bg-green-50/70 border-b border-green-100'
            : 'bg-amber-50/30 hover:bg-amber-50/60 border-b border-amber-100'
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">
            🏔️ {tripTitle} — {childName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{tripDates}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {contractNumber && (
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
              {contractNumber}
            </span>
          )}
          {isAccepted ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0">
              <CheckCircle className="mr-1 h-3 w-3" />
              Zaakceptowana
              {contract.accepted_at && (
                <span className="ml-1">
                  {format(new Date(contract.accepted_at), 'd.MM.yyyy', { locale: pl })}
                </span>
              )}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300 shrink-0">
              <Clock className="mr-1 h-3 w-3" />
              Oczekuje akceptacji
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          >
            {expanded
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>

      {/* Treść — zwijana */}
      {expanded && (
        <div className="bg-white">
          {/* Drukuj — tylko dla zaakceptowanych */}
          {isAccepted && (
            <div className="px-5 py-3 border-b border-gray-100 flex justify-end">
              <PrintContractButton contractId={contract.id} contractNumber={contractNumber} />
            </div>
          )}

          {/* Dokument umowy */}
          <div className="p-0">
            <ContractDocument
              text={contract.contract_text}
              showOwuLink={!isAccepted}
              contractNumber={contractNumber}
              acceptedAt={contract.accepted_at}
              acceptedByName={isAccepted ? parentName : null}
              contractId={contract.id}
            />
          </div>

          {/* Akceptacja — tylko dla oczekujących */}
          {!isAccepted && (
            <div className="px-5 py-4 border-t border-amber-100 bg-amber-50/20">
              <AcceptContractButton contractId={contract.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
