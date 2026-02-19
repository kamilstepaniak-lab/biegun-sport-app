'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from 'lucide-react';

import type { PaymentWithDetails } from '@/types';

interface FinanceSummaryProps {
  payments: PaymentWithDetails[];
}

interface TripSummary {
  tripId: string;
  tripTitle: string;
  tripDeparture: string;
  participantCount: number;
  // PLN
  totalPLN: number;
  paidPLN: number;
  missingPLN: number;
  // EUR
  totalEUR: number;
  paidEUR: number;
  missingEUR: number;
  // Płatności
  totalPayments: number;
  paidPayments: number;
  pct: number;
}

export function FinanceSummary({ payments }: FinanceSummaryProps) {
  const [sortField, setSortField] = useState<keyof TripSummary>('tripDeparture');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const tripSummaries = useMemo<TripSummary[]>(() => {
    const tripMap = new Map<string, {
      tripId: string;
      tripTitle: string;
      tripDeparture: string;
      participants: Set<string>;
      totalPLN: number;
      paidPLN: number;
      totalEUR: number;
      paidEUR: number;
      totalPayments: number;
      paidPayments: number;
    }>();

    payments.forEach((p) => {
      if (!p.registration) return;
      const trip = p.registration.trip;
      const participantId = p.registration.participant.id;

      if (!tripMap.has(trip.id)) {
        tripMap.set(trip.id, {
          tripId: trip.id,
          tripTitle: trip.title,
          tripDeparture: trip.departure_datetime,
          participants: new Set(),
          totalPLN: 0,
          paidPLN: 0,
          totalEUR: 0,
          paidEUR: 0,
          totalPayments: 0,
          paidPayments: 0,
        });
      }

      const entry = tripMap.get(trip.id)!;
      entry.participants.add(participantId);
      entry.totalPayments++;

      if (p.currency === 'PLN') {
        entry.totalPLN += p.amount;
        if (p.status === 'paid') {
          entry.paidPLN += p.amount;
          entry.paidPayments++;
        }
      } else if (p.currency === 'EUR') {
        entry.totalEUR += p.amount;
        if (p.status === 'paid') {
          entry.paidEUR += p.amount;
          entry.paidPayments++;
        }
      }
    });

    return Array.from(tripMap.values()).map((entry) => ({
      tripId: entry.tripId,
      tripTitle: entry.tripTitle,
      tripDeparture: entry.tripDeparture,
      participantCount: entry.participants.size,
      totalPLN: entry.totalPLN,
      paidPLN: entry.paidPLN,
      missingPLN: entry.totalPLN - entry.paidPLN,
      totalEUR: entry.totalEUR,
      paidEUR: entry.paidEUR,
      missingEUR: entry.totalEUR - entry.paidEUR,
      totalPayments: entry.totalPayments,
      paidPayments: entry.paidPayments,
      pct: entry.totalPayments > 0
        ? Math.round((entry.paidPayments / entry.totalPayments) * 100)
        : 0,
    }));
  }, [payments]);

  // Totals
  const totals = useMemo(() => ({
    participants: tripSummaries.reduce((s, t) => s + t.participantCount, 0),
    totalPLN: tripSummaries.reduce((s, t) => s + t.totalPLN, 0),
    paidPLN: tripSummaries.reduce((s, t) => s + t.paidPLN, 0),
    missingPLN: tripSummaries.reduce((s, t) => s + t.missingPLN, 0),
    totalEUR: tripSummaries.reduce((s, t) => s + t.totalEUR, 0),
    paidEUR: tripSummaries.reduce((s, t) => s + t.paidEUR, 0),
    missingEUR: tripSummaries.reduce((s, t) => s + t.missingEUR, 0),
    totalPayments: tripSummaries.reduce((s, t) => s + t.totalPayments, 0),
    paidPayments: tripSummaries.reduce((s, t) => s + t.paidPayments, 0),
  }), [tripSummaries]);

  const sorted = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = query
      ? tripSummaries.filter((t) => t.tripTitle.toLowerCase().includes(query))
      : tripSummaries;

    return [...filtered].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc'
          ? valA.localeCompare(valB, 'pl')
          : valB.localeCompare(valA, 'pl');
      }
      const numA = Number(valA);
      const numB = Number(valB);
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
  }, [tripSummaries, sortField, sortDir, searchQuery]);

  function toggleSort(field: keyof TripSummary) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: keyof TripSummary }) {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-gray-500" />
      : <ChevronDown className="h-3 w-3 text-gray-500" />;
  }

  const totalPct = totals.totalPayments > 0
    ? Math.round((totals.paidPayments / totals.totalPayments) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Wyjazdy</p>
          <p className="text-3xl font-bold text-gray-900">{tripSummaries.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Uczestnicy</p>
          <p className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            {totals.participants}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Zebrano (PLN)</p>
          <p className="text-3xl font-bold text-emerald-600">{totals.paidPLN.toFixed(0)} zł</p>
          <p className="text-xs text-gray-400 mt-1">z {totals.totalPLN.toFixed(0)} zł</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Brakuje (PLN)</p>
          <p className="text-3xl font-bold text-red-500">{totals.missingPLN.toFixed(0)} zł</p>
          <p className="text-xs text-gray-400 mt-1">opłacone {totalPct}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-900 text-sm">
            Zestawienie per wyjazd
            {searchQuery.trim() && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({sorted.length} z {tripSummaries.length})
              </span>
            )}
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Szukaj wyjazdu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left">
                  <button
                    onClick={() => toggleSort('tripTitle')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600"
                  >
                    Wyjazd <SortIcon field="tripTitle" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('tripDeparture')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    Data wyjazdu <SortIcon field="tripDeparture" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('participantCount')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    Uczest. <SortIcon field="participantCount" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('totalPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Do zapłaty PLN <SortIcon field="totalPLN" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('paidPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Zebrano PLN <SortIcon field="paidPLN" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('missingPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Brakuje PLN <SortIcon field="missingPLN" />
                  </button>
                </th>
                {totals.totalEUR > 0 && (
                  <>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Do zapłaty EUR
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Zebrano EUR
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Brakuje EUR
                      </span>
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('pct')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    % opłac. <SortIcon field="pct" />
                  </button>
                </th>
                <th className="px-5 py-3 text-right">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Szczegóły
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {sorted.map((trip) => {
                const pct = trip.pct;
                const pctColor = pct === 100
                  ? 'text-emerald-600'
                  : pct >= 50
                  ? 'text-amber-600'
                  : 'text-red-600';
                const barColor = pct === 100
                  ? 'bg-emerald-500'
                  : pct >= 50
                  ? 'bg-amber-400'
                  : 'bg-red-400';

                return (
                  <tr key={trip.tripId} className="hover:bg-gray-50/50 transition-colors">
                    {/* Wyjazd */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{trip.tripTitle}</p>
                    </td>

                    {/* Data wyjazdu */}
                    <td className="px-4 py-4 text-center text-gray-500 text-sm whitespace-nowrap">
                      {new Date(trip.tripDeparture).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Uczest. */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700 font-medium text-sm">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {trip.participantCount}
                      </span>
                    </td>

                    {/* Do zapłaty PLN */}
                    <td className="px-4 py-4 text-right font-medium text-gray-700 text-sm whitespace-nowrap">
                      {trip.totalPLN.toFixed(0)} zł
                    </td>

                    {/* Zebrano PLN */}
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600 text-sm whitespace-nowrap">
                      <span className="flex items-center justify-end gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {trip.paidPLN.toFixed(0)} zł
                      </span>
                    </td>

                    {/* Brakuje PLN */}
                    <td className="px-4 py-4 text-right text-sm whitespace-nowrap">
                      {trip.missingPLN > 0 ? (
                        <span className="font-semibold text-red-600 flex items-center justify-end gap-1">
                          <TrendingDown className="h-3.5 w-3.5" />
                          {trip.missingPLN.toFixed(0)} zł
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* EUR columns */}
                    {totals.totalEUR > 0 && (
                      <>
                        <td className="px-4 py-4 text-right font-medium text-gray-700 text-sm whitespace-nowrap">
                          {trip.totalEUR > 0 ? `${trip.totalEUR.toFixed(0)} €` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-emerald-600 text-sm whitespace-nowrap">
                          {trip.paidEUR > 0 ? `${trip.paidEUR.toFixed(0)} €` : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-4 text-right text-sm whitespace-nowrap">
                          {trip.missingEUR > 0 ? (
                            <span className="font-semibold text-red-600">{trip.missingEUR.toFixed(0)} €</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* % opłacone */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center gap-1 min-w-[60px]">
                        <span className={`text-sm font-bold ${pctColor}`}>{pct}%</span>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{trip.paidPayments}/{trip.totalPayments} rat</span>
                      </div>
                    </td>

                    {/* Szczegóły */}
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/payments?trip=${trip.tripId}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Płatności
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Summary row */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                  RAZEM
                </td>
                <td className="px-4 py-4 text-center text-xs text-gray-400">
                  {tripSummaries.length} wyjazdów
                </td>
                <td className="px-4 py-4 text-center font-bold text-gray-900 text-sm">
                  {totals.participants}
                </td>
                <td className="px-4 py-4 text-right font-bold text-gray-900 text-sm whitespace-nowrap">
                  {totals.totalPLN.toFixed(0)} zł
                </td>
                <td className="px-4 py-4 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                  {totals.paidPLN.toFixed(0)} zł
                </td>
                <td className="px-4 py-4 text-right font-bold text-red-600 text-sm whitespace-nowrap">
                  {totals.missingPLN > 0 ? `${totals.missingPLN.toFixed(0)} zł` : '—'}
                </td>
                {totals.totalEUR > 0 && (
                  <>
                    <td className="px-4 py-4 text-right font-bold text-gray-900 text-sm whitespace-nowrap">
                      {totals.totalEUR.toFixed(0)} €
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                      {totals.paidEUR.toFixed(0)} €
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-red-600 text-sm whitespace-nowrap">
                      {totals.missingEUR > 0 ? `${totals.missingEUR.toFixed(0)} €` : '—'}
                    </td>
                  </>
                )}
                <td className="px-4 py-4">
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <span className={`text-sm font-bold ${totalPct === 100 ? 'text-emerald-600' : totalPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {totalPct}%
                    </span>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${totalPct === 100 ? 'bg-emerald-500' : totalPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${totalPct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
