'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Download,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  BadgePercent,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricCard, PanelCard } from '@/components/shared';
import type { TripFinanceSummary } from '@/lib/actions/payments';

type TripSummary = TripFinanceSummary;

interface FinanceSummaryProps {
  summaries: TripFinanceSummary[];
}

export function FinanceSummary({ summaries }: FinanceSummaryProps) {
  const [sortField, setSortField] = useState<keyof TripSummary>('tripDeparture');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 25;

  // Dane są już zagregowane per wyjazd po stronie bazy (widok admin_finance_summary).
  const tripSummaries = summaries;

  // Totals
  const totals = useMemo(() => ({
    participants: tripSummaries.reduce((s, t) => s + t.participantCount, 0),
    totalPLN: tripSummaries.reduce((s, t) => s + t.totalPLN, 0),
    paidPLN: tripSummaries.reduce((s, t) => s + t.paidPLN, 0),
    missingPLN: tripSummaries.reduce((s, t) => s + t.missingPLN, 0),
    totalEUR: tripSummaries.reduce((s, t) => s + t.totalEUR, 0),
    paidEUR: tripSummaries.reduce((s, t) => s + t.paidEUR, 0),
    missingEUR: tripSummaries.reduce((s, t) => s + t.missingEUR, 0),
    discountPLN: tripSummaries.reduce((s, t) => s + t.discountPLN, 0),
    discountEUR: tripSummaries.reduce((s, t) => s + t.discountEUR, 0),
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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage],
  );

  function toggleSort(field: keyof TripSummary) {
    setPage(1);
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function sortIcon(field: keyof TripSummary) {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-gray-500" />
      : <ChevronDown className="h-3 w-3 text-gray-500" />;
  }

  // % kwotowy zbiorczy (PLN + EUR sumują się nominalnie — przybliżenie).
  const totalPct = (totals.totalPLN + totals.totalEUR) > 0
    ? Math.min(100, Math.round(
        ((totals.paidPLN + totals.paidEUR) / (totals.totalPLN + totals.totalEUR)) * 100,
      ))
    : 0;

  function exportCsv() {
    const hasEur = totals.totalEUR > 0;
    const headers = [
      'Wyjazd', 'Data wyjazdu', 'Uczestnicy',
      'Do zapłaty PLN', 'Zebrano PLN', 'Brakuje PLN', 'Zniżki PLN',
      ...(hasEur ? ['Do zapłaty EUR', 'Zebrano EUR', 'Brakuje EUR', 'Zniżki EUR'] : []),
      '% opłacone', 'Raty opłacone', 'Raty razem',
    ];
    const escape = (v: string | number) => {
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = sorted.map((t) => [
      t.tripTitle,
      new Date(t.tripDeparture).toLocaleDateString('pl-PL'),
      t.participantCount,
      t.totalPLN.toFixed(2), t.paidPLN.toFixed(2),
      Math.max(t.missingPLN, 0).toFixed(2), t.discountPLN.toFixed(2),
      ...(hasEur ? [
        t.totalEUR.toFixed(2), t.paidEUR.toFixed(2),
        Math.max(t.missingEUR, 0).toFixed(2), t.discountEUR.toFixed(2),
      ] : []),
      t.pct, t.paidPayments, t.totalPayments,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">

      {/* Stat cards — spójne z kartami na /admin/payments (chip z ikoną) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard icon={MapPin} label="Wyjazdy" value={tripSummaries.length} tone="blue" />
        <MetricCard
          icon={CheckCircle2}
          label="Zebrano PLN"
          value={`${totals.paidPLN.toFixed(0)} zł`}
          description={`z ${totals.totalPLN.toFixed(0)} zł`}
          tone="emerald"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Brakuje PLN"
          value={`${totals.missingPLN.toFixed(0)} zł`}
          description={`zebrane ${totalPct}%`}
          tone="red"
        />
      </div>

      {/* Currency / discount cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {totals.totalEUR > 0 && (
          <>
            <MetricCard
              icon={CheckCircle2}
              label="Zebrano EUR"
              value={`${totals.paidEUR.toFixed(0)} €`}
              description={`z ${totals.totalEUR.toFixed(0)} €`}
              tone="emerald"
            />
            <MetricCard icon={AlertTriangle} label="Brakuje EUR" value={`${totals.missingEUR.toFixed(0)} €`} tone="red" />
          </>
        )}
        <MetricCard
          icon={BadgePercent}
          label="Udzielone zniżki"
          value={`${totals.discountPLN.toFixed(0)} zł`}
          description={totals.discountEUR > 0 ? `+ ${totals.discountEUR.toFixed(0)} €` : undefined}
          tone="amber"
        />
      </div>

      {/* Table */}
      <PanelCard className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-900 text-sm">
            Zestawienie per wyjazd
            {searchQuery.trim() && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({sorted.length} z {tripSummaries.length})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Szukaj wyjazdu..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-xl border-0 bg-gray-50 pl-9 pr-8 ring-1 ring-gray-200"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Button
              type="button"
              onClick={exportCsv}
              className="rounded-xl bg-slate-900 hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
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
                    Wyjazd {sortIcon('tripTitle')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('tripDeparture')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    Data wyjazdu {sortIcon('tripDeparture')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('participantCount')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    Uczest. {sortIcon('participantCount')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('totalPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Do zapłaty PLN {sortIcon('totalPLN')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('paidPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Zebrano PLN {sortIcon('paidPLN')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('missingPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Brakuje PLN {sortIcon('missingPLN')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('discountPLN')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 ml-auto"
                  >
                    Zniżki PLN {sortIcon('discountPLN')}
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
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Zniżki EUR
                      </span>
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('pct')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 mx-auto"
                  >
                    % opłac. {sortIcon('pct')}
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
              {paged.map((trip) => {
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

                    {/* Zniżki PLN */}
                    <td className="px-4 py-4 text-right text-sm whitespace-nowrap">
                      {trip.discountPLN > 0 ? (
                        <span className="font-medium text-amber-600">{trip.discountPLN.toFixed(0)} zł</span>
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
                        <td className="px-4 py-4 text-right text-sm whitespace-nowrap">
                          {trip.discountEUR > 0 ? (
                            <span className="font-medium text-amber-600">{trip.discountEUR.toFixed(0)} €</span>
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
                <td className="px-4 py-4 text-right font-bold text-amber-600 text-sm whitespace-nowrap">
                  {totals.discountPLN > 0 ? `${totals.discountPLN.toFixed(0)} zł` : '—'}
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
                    <td className="px-4 py-4 text-right font-bold text-amber-600 text-sm whitespace-nowrap">
                      {totals.discountEUR > 0 ? `${totals.discountEUR.toFixed(0)} €` : '—'}
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

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} z {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 h-9 rounded-lg text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Poprzednia
              </button>
              <span className="px-3 text-sm text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 h-9 rounded-lg text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Następna
              </button>
            </div>
          </div>
        )}
      </PanelCard>
    </div>
  );
}
