'use client';

import { useMemo, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Check,
  Clock,
  AlertCircle,
  CreditCard,
  Copy,
  Banknote,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared';
import { cn } from '@/lib/utils';

import type { ParentPayment, BankAccountInfo } from '@/lib/actions/payments';

interface ParentPaymentsListProps {
  pendingPayments: ParentPayment[];
  paidPayments: ParentPayment[];
  bankAccounts: BankAccountInfo;
}

const statusConfig: Record<string, { label: string; bgClass: string; icon: typeof Check }> = {
  pending:                  { label: 'Do zapłaty', bgClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       icon: Clock },
  partially_paid:           { label: 'Częściowo',  bgClass: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',          icon: Clock },
  partially_paid_overdue:   { label: 'Zaległość',  bgClass: 'bg-red-50 text-red-700 ring-1 ring-red-200',             icon: AlertCircle },
  overdue:                  { label: 'Zaległość',  bgClass: 'bg-red-50 text-red-700 ring-1 ring-red-200',             icon: AlertCircle },
  paid:                     { label: 'Opłacone',   bgClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icon: Check },
  cancelled:                { label: 'Anulowane',  bgClass: 'bg-gray-100 text-gray-400',                              icon: Check },
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} skopiowany do schowka`);
}

function isOverduePayment(p: ParentPayment) {
  if (p.status === 'paid' || p.status === 'cancelled') return false;
  return !!(p.due_date && new Date(p.due_date) < new Date());
}

function getPaymentTypeLabel(p: ParentPayment): string {
  if (p.payment_type === 'installment') return `Rata ${p.installment_number}`;
  if (p.payment_type === 'season_pass') return 'Karnet';
  if (p.payment_type === 'full') return 'Pełna opłata';
  return p.payment_type;
}

// ── Bloki sumaryczne ──────────────────────────────────────────────────────
function SummaryBlocks({
  pendingSource,
  overdueSource,
}: {
  pendingSource: ParentPayment[];
  overdueSource: ParentPayment[];
}) {
  const pendingByCurrency = useMemo(() => {
    const sums: Record<string, number> = {};
    [...pendingSource, ...overdueSource].forEach((p) => {
      const rem = p.amount - p.amount_paid;
      sums[p.currency] = (sums[p.currency] ?? 0) + rem;
    });
    return sums;
  }, [pendingSource, overdueSource]);

  const overdueByCurrency = useMemo(() => {
    const sums: Record<string, number> = {};
    overdueSource.forEach((p) => {
      const rem = p.amount - p.amount_paid;
      sums[p.currency] = (sums[p.currency] ?? 0) + rem;
    });
    return sums;
  }, [overdueSource]);

  const hasPending = Object.keys(pendingByCurrency).length > 0;
  const hasOverdue = overdueSource.length > 0;

  const currencyOrder = (c: string) => (c === 'PLN' ? 0 : c === 'EUR' ? 1 : 2);
  const sortedPending = Object.entries(pendingByCurrency).sort((a, b) => currencyOrder(a[0]) - currencyOrder(b[0]));
  const sortedOverdue = Object.entries(overdueByCurrency).sort((a, b) => currencyOrder(a[0]) - currencyOrder(b[0]));

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-amber-50 rounded-2xl ring-1 ring-amber-200 p-3 sm:p-4">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-700" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Do zapłaty</span>
            <p className="hidden sm:block text-[10px] text-amber-400 leading-tight">razem z płatnościami po terminie</p>
          </div>
        </div>
        {hasPending ? (
          <div className="space-y-0.5">
            {sortedPending.map(([currency, sum]) => (
              <div key={currency} className="flex items-baseline gap-1">
                <span className="text-base sm:text-xl font-bold text-amber-900 tabular-nums">{sum.toFixed(0)}</span>
                <span className="text-xs sm:text-sm font-semibold text-amber-600">{currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs sm:text-sm font-semibold text-emerald-600">Wszystko opłacone</p>
        )}
      </div>

      <div className={`rounded-2xl ring-1 p-3 sm:p-4 ${hasOverdue ? 'bg-red-50 ring-red-200' : 'bg-white ring-gray-100'}`}>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${hasOverdue ? 'bg-red-200' : 'bg-gray-100'}`}>
            <AlertCircle className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${hasOverdue ? 'text-red-700' : 'text-gray-400'}`} />
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${hasOverdue ? 'text-red-700' : 'text-gray-400'}`}>Po terminie</span>
        </div>
        {hasOverdue ? (
          <div className="space-y-0.5">
            {sortedOverdue.map(([currency, sum]) => (
              <div key={currency} className="flex items-baseline gap-1">
                <span className="text-base sm:text-xl font-bold text-red-700 tabular-nums">{sum.toFixed(0)}</span>
                <span className="text-xs sm:text-sm font-semibold text-red-500">{currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs sm:text-sm font-semibold text-emerald-600">Brak zaległości</p>
        )}
      </div>
    </div>
  );
}

// ── Dane do przelewu ──────────────────────────────────────────────────────
export function BankAccountsSection({ bankAccounts }: { bankAccounts: BankAccountInfo }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Banknote className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">Dane do przelewu</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {bankAccounts.bank_account_pln && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Konto PLN</p>
              <p className="text-sm text-gray-900">{bankAccounts.bank_account_pln}</p>
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => copyToClipboard(bankAccounts.bank_account_pln!, 'Numer konta PLN')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
        {bankAccounts.bank_account_eur && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Konto EUR</p>
              <p className="text-sm text-gray-900">{bankAccounts.bank_account_eur}</p>
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => copyToClipboard(bankAccounts.bank_account_eur!, 'Numer konta EUR')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wspólna logika płatności ───────────────────────────────────────────────
function usePaymentData(payment: ParentPayment) {
  const cfg = statusConfig[payment.status] ?? statusConfig.pending;
  const StatusIcon = cfg.icon;
  const isOverdue = isOverduePayment(payment);
  const daysOverdue = isOverdue && payment.due_date
    ? differenceInCalendarDays(new Date(), new Date(payment.due_date))
    : 0;
  const remaining = payment.amount - payment.amount_paid;
  const dueDate = payment.due_date ? new Date(payment.due_date) : null;
  const isDepartureDay =
    payment.trip_departure_date &&
    payment.due_date === new Date(payment.trip_departure_date).toISOString().split('T')[0];
  const tripDate = payment.trip_departure_date
    ? format(new Date(payment.trip_departure_date), 'dd.MM.yyyy', { locale: pl })
    : '';
  const transferTitle = `${payment.child_last_name} ${payment.child_first_name} ${payment.trip_title} ${tripDate}`;
  return { cfg, StatusIcon, isOverdue, daysOverdue, remaining, dueDate, isDepartureDay, transferTitle };
}

// ── Karta mobilna płatności ───────────────────────────────────────────────
function PaymentCard({ payment }: { payment: ParentPayment }) {
  const { cfg, StatusIcon, isOverdue, daysOverdue, remaining, dueDate, isDepartureDay, transferTitle } = usePaymentData(payment);
  return (
    <div className={cn(
      'p-4 space-y-3 border-b border-gray-100',
      payment.status === 'paid' ? 'bg-emerald-50/20' : isOverdue ? 'bg-red-50/10' : '',
    )}>
      {/* Nagłówek: dziecko + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{payment.child_name}</p>
          <p className="text-xs text-gray-500 truncate">{payment.trip_title}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0', cfg.bgClass)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      {/* Tytuł przelewu */}
      <button
        className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 group text-left"
        onClick={() => copyToClipboard(transferTitle, 'Tytuł przelewu')}
      >
        <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Tytuł przelewu</p>
          <p className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors truncate">{transferTitle}</p>
        </div>
      </button>

      {/* Szczegóły: typ + kwota + termin */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-gray-600">{getPaymentTypeLabel(payment)}</p>
          {dueDate && (
            <p className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
              {isDepartureDay ? 'w dniu wyjazdu' : format(dueDate, 'd.MM.yyyy', { locale: pl })}
              {isOverdue && daysOverdue > 0 && ` · ${daysOverdue}d po term.`}
            </p>
          )}
        </div>
        <div className="text-right">
          {payment.status === 'paid' ? (
            <span className="text-base font-bold text-emerald-600 tabular-nums">
              {payment.amount.toFixed(0)} <span className="text-xs">{payment.currency}</span>
            </span>
          ) : (
            <div>
              <span className={cn('text-base font-bold tabular-nums', isOverdue ? 'text-red-600' : 'text-gray-900')}>
                {remaining.toFixed(0)} <span className="text-xs font-semibold">{payment.currency}</span>
              </span>
              {payment.amount_paid > 0 && (
                <p className="text-[11px] text-gray-400">wpł. {payment.amount_paid.toFixed(0)}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wiersz tabeli ─────────────────────────────────────────────────────────
function PaymentRow({ payment }: { payment: ParentPayment }) {
  const { cfg, StatusIcon, isOverdue, daysOverdue, remaining, dueDate, isDepartureDay, transferTitle } = usePaymentData(payment);

  return (
    <tr
      className={cn(
        'border-b border-gray-100 transition-colors',
        payment.status === 'paid'
          ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
          : isOverdue
          ? 'bg-red-50/10 hover:bg-red-50/20'
          : 'hover:bg-gray-50/60',
      )}
    >
      {/* Dziecko */}
      <td className="py-3 pl-4 pr-3">
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{payment.child_name}</span>
      </td>

      {/* Wyjazd */}
      <td className="py-3 px-3">
        <p className="text-sm text-gray-700 font-medium truncate max-w-[200px]">{payment.trip_title}</p>
        <button
          className="flex items-center gap-1 mt-0.5 group"
          onClick={() => copyToClipboard(transferTitle, 'Tytuł przelewu')}
          title="Kopiuj tytuł przelewu"
        >
          <span className="text-xs text-gray-400 truncate max-w-[190px] group-hover:text-blue-500 transition-colors">{transferTitle}</span>
          <Copy className="h-3 w-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
        </button>
      </td>

      {/* Za co */}
      <td className="py-3 px-3">
        <span className="text-sm text-gray-700">{getPaymentTypeLabel(payment)}</span>
      </td>

      {/* Kwota */}
      <td className="py-3 px-3 text-right whitespace-nowrap">
        {payment.status === 'paid' ? (
          <span className="text-sm font-semibold text-emerald-600 tabular-nums">
            {payment.amount.toFixed(0)} {payment.currency}
          </span>
        ) : (
          <div>
            <span className={cn('text-sm font-bold tabular-nums', isOverdue ? 'text-red-600' : 'text-gray-900')}>
              {remaining.toFixed(0)} {payment.currency}
            </span>
            {payment.amount_paid > 0 && (
              <span className="text-xs text-gray-400 ml-1">(wpł. {payment.amount_paid.toFixed(0)})</span>
            )}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        <div className="flex flex-wrap gap-1">
          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bgClass)}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </span>
          {isOverdue && payment.status !== 'overdue' && payment.status !== 'partially_paid_overdue' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              Po terminie
            </span>
          )}
        </div>
      </td>

      {/* Termin */}
      <td className="py-3 px-3 whitespace-nowrap">
        {dueDate ? (
          <div>
            <span className={cn('text-sm tabular-nums', isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500')}>
              {isDepartureDay ? 'w dniu wyjazdu' : format(dueDate, 'd.MM.yyyy', { locale: pl })}
            </span>
            {isOverdue && daysOverdue > 0 && (
              <p className="text-[11px] text-red-400 mt-0.5">{daysOverdue} dni po terminie</p>
            )}
          </div>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>

    </tr>
  );
}

// ── Tabela / karty płatności ──────────────────────────────────────────────
function PaymentsTable({ payments, label }: { payments: ParentPayment[]; label?: string }) {
  if (payments.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-x-auto">
      {label && (
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="text-left py-2.5 pl-4 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Dziecko</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Wyjazd</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Za co</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Kwota</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Termin</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Główny komponent ──────────────────────────────────────────────────────
type FilterType = 'all' | 'pending' | 'overdue' | 'paid';

export function ParentPaymentsList({ pendingPayments, paidPayments, bankAccounts }: ParentPaymentsListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [tripFilter, setTripFilter] = useState<string>('all');
  const [archivedOpen, setArchivedOpen] = useState(false);

  const allPayments = useMemo(() => {
    const byDue = (a: ParentPayment, b: ParentPayment) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    };
    return [...[...pendingPayments].sort(byDue), ...[...paidPayments].sort(byDue)];
  }, [pendingPayments, paidPayments]);

  const availableTrips = useMemo(() => {
    const m = new Map<string, string>();
    allPayments.forEach((p) => { if (!m.has(p.trip_id)) m.set(p.trip_id, p.trip_title); });
    return Array.from(m.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
  }, [allPayments]);

  const { active, archived } = useMemo(() => {
    const now = new Date();
    const active: ParentPayment[] = [];
    const archived: ParentPayment[] = [];
    allPayments.forEach((p) => {
      const ended = p.trip_return_date && new Date(p.trip_return_date) < now;
      if (p.status === 'paid' && ended) archived.push(p);
      else active.push(p);
    });
    return { active, archived };
  }, [allPayments]);

  const activeFiltered = useMemo(
    () => (tripFilter === 'all' ? active : active.filter((p) => p.trip_id === tripFilter)),
    [active, tripFilter],
  );
  const archivedFiltered = useMemo(
    () => (tripFilter === 'all' ? archived : archived.filter((p) => p.trip_id === tripFilter)),
    [archived, tripFilter],
  );

  const summaryPending = useMemo(
    () => activeFiltered.filter((p) => ['pending', 'partially_paid'].includes(p.status) && !isOverduePayment(p)),
    [activeFiltered],
  );
  const summaryOverdue = useMemo(() => activeFiltered.filter(isOverduePayment), [activeFiltered]);

  const overduePayments = useMemo(() => activeFiltered.filter(isOverduePayment), [activeFiltered]);
  const pendingOnly = useMemo(
    () => activeFiltered.filter((p) => ['pending', 'partially_paid'].includes(p.status) && !isOverduePayment(p)),
    [activeFiltered],
  );
  const allPaid = useMemo(
    () => [...activeFiltered, ...archivedFiltered].filter((p) => p.status === 'paid'),
    [activeFiltered, archivedFiltered],
  );

  const displayPayments = useMemo(() => {
    switch (filter) {
      case 'pending': return pendingOnly;
      case 'overdue': return overduePayments;
      case 'paid':    return allPaid;
      default:        return activeFiltered;
    }
  }, [filter, activeFiltered, pendingOnly, overduePayments, allPaid]);

  const filterTabs: { id: FilterType; label: string; count: number; activeClass: string }[] = [
    { id: 'all',     label: 'Wszystkie',   count: activeFiltered.length,  activeClass: 'bg-gray-900 text-white' },
    { id: 'pending', label: 'Do zapłaty',  count: pendingOnly.length,     activeClass: 'bg-amber-500 text-white' },
    { id: 'overdue', label: 'Po terminie', count: overduePayments.length, activeClass: 'bg-red-500 text-white' },
    { id: 'paid',    label: 'Opłacone',    count: allPaid.length,         activeClass: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Bloki sumaryczne */}
      <SummaryBlocks pendingSource={summaryPending} overdueSource={summaryOverdue} />

      <div className="space-y-4">
        {/* Filtry */}
        <div className="flex flex-wrap items-center gap-2">
          {availableTrips.length > 1 && (
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className={cn(
                  'appearance-none pl-8 pr-8 py-2 rounded-xl text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
                  tripFilter !== 'all'
                    ? 'bg-blue-600 text-white border border-blue-700'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
                )}
              >
                <option value="all">Sortuj wg. wyjazdu</option>
                {availableTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none', tripFilter !== 'all' ? 'text-blue-200' : 'text-blue-400')} />
            </div>
          )}

          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === tab.id ? tab.activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', filter === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-500')}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tabela */}
        {displayPayments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Brak płatności"
            description={
              filter === 'pending' ? 'Nie masz płatności do zapłaty.' :
              filter === 'overdue' ? 'Nie masz płatności po terminie.' :
              filter === 'paid'    ? 'Nie masz jeszcze opłaconych płatności.' :
              'Nie masz jeszcze żadnych płatności.'
            }
          />
        ) : (
          <PaymentsTable payments={displayPayments} />
        )}

        {/* Archiwum */}
        {(filter === 'all' || filter === 'paid') && archivedFiltered.length > 0 && (
          <div>
            <button
              onClick={() => setArchivedOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors text-sm font-medium text-gray-500"
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Zakończone wyjazdy — opłacone
                <span className="bg-gray-200 text-gray-500 text-xs px-1.5 py-0.5 rounded-md font-bold">
                  {archivedFiltered.length}
                </span>
              </span>
              {archivedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {archivedOpen && (
              <div className="mt-2">
                <PaymentsTable payments={archivedFiltered} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
