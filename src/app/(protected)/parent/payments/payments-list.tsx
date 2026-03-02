'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, Clock, AlertCircle, CreditCard, Copy, Banknote, User, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared';

import type { ParentPayment, BankAccountInfo } from '@/lib/actions/payments';

interface ParentPaymentsListProps {
  pendingPayments: ParentPayment[];
  paidPayments: ParentPayment[];
  bankAccounts: BankAccountInfo;
}

const statusConfig: Record<string, { label: string; bgClass: string; icon: typeof Check }> = {
  pending: { label: 'Do zapłaty', bgClass: 'bg-amber-100 text-amber-700', icon: Clock },
  partially_paid: { label: 'Częściowo', bgClass: 'bg-blue-100 text-blue-700', icon: Clock },
  partially_paid_overdue: { label: 'Zaległość', bgClass: 'bg-red-100 text-red-700', icon: AlertCircle },
  overdue: { label: 'Zaległość', bgClass: 'bg-red-100 text-red-700', icon: AlertCircle },
  paid: { label: 'Opłacone', bgClass: 'bg-emerald-100 text-emerald-700', icon: Check },
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} skopiowany do schowka`);
}

function getMethodStyle(method: string | null): { label: string; className: string } | null {
  if (method === 'transfer') return { label: 'Przelew', className: 'bg-blue-100 text-blue-700' };
  if (method === 'cash') return { label: 'Gotówka', className: 'bg-amber-100 text-amber-700' };
  if (method === 'both') return { label: 'Przelew/Gotówka', className: 'bg-blue-100 text-blue-700' };
  return null;
}

function isOverduePayment(p: ParentPayment) {
  return p.due_date && new Date(p.due_date) < new Date() && p.status !== 'paid';
}

// ── Bloki sumaryczne ──────────────────────────────────────────────────────
function SummaryBlocks({
  pendingSource,
  overdueSource,
}: {
  pendingSource: ParentPayment[];
  overdueSource: ParentPayment[];
}) {
  // "Do zapłaty" = wszystkie nieopłacone (pending + overdue łącznie)
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

  // PLN zawsze przed EUR
  const currencyOrder = (c: string) => c === 'PLN' ? 0 : c === 'EUR' ? 1 : 2;
  const sortedPendingEntries = Object.entries(pendingByCurrency).sort((a, b) => currencyOrder(a[0]) - currencyOrder(b[0]));
  const sortedOverdueEntries = Object.entries(overdueByCurrency).sort((a, b) => currencyOrder(a[0]) - currencyOrder(b[0]));

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Do zapłaty */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Do zapłaty</span>
            <p className="text-[10px] text-gray-300 leading-tight">razem z płatnościami po terminie</p>
          </div>
        </div>
        {hasPending ? (
          <div className="space-y-0.5">
            {sortedPendingEntries.map(([currency, sum]) => (
              <div key={currency} className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-gray-900 tabular-nums">{sum.toFixed(0)}</span>
                <span className="text-sm font-semibold text-gray-400">{currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-emerald-600">Wszystko opłacone</p>
        )}
      </div>

      {/* Po terminie */}
      <div className={`bg-white rounded-2xl ring-1 p-4 ${hasOverdue ? 'ring-red-200' : 'ring-gray-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${hasOverdue ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertCircle className={`h-3.5 w-3.5 ${hasOverdue ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Po terminie</span>
        </div>
        {hasOverdue ? (
          <div className="space-y-0.5">
            {sortedOverdueEntries.map(([currency, sum]) => (
              <div key={currency} className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-red-600 tabular-nums">{sum.toFixed(0)}</span>
                <span className="text-sm font-semibold text-red-400">{currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-emerald-600">Brak zaległości</p>
        )}
      </div>
    </div>
  );
}

// ── Wiersz płatności ──────────────────────────────────────────────────────
function PaymentRow({ payment }: { payment: ParentPayment }) {
  const status = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const remaining = payment.amount - payment.amount_paid;
  const isOverdue = isOverduePayment(payment);

  const paymentTypeLabel = payment.payment_type === 'installment'
    ? `Rata ${payment.installment_number}`
    : payment.payment_type === 'season_pass'
      ? 'Karnet'
      : payment.payment_type === 'full'
        ? 'Pełna opłata'
        : payment.payment_type;

  const methodStyle = getMethodStyle(payment.payment_method);

  const tripDate = payment.trip_departure_date
    ? format(new Date(payment.trip_departure_date), 'dd.MM.yyyy', { locale: pl })
    : '';
  const transferTitle = `${payment.child_last_name} ${payment.child_first_name} ${payment.trip_title} ${tripDate}`;

  return (
    <div className={`px-4 py-3.5 hover:bg-gray-50/50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center">
        <div className="font-medium text-gray-900 text-sm truncate">{payment.trip_title}</div>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">{paymentTypeLabel}</span>
          {methodStyle && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodStyle.className}`}>
              {methodStyle.label}
            </span>
          )}
        </div>

        <div className="text-sm">
          {payment.due_date ? (() => {
            const isDepartureDay = payment.trip_departure_date &&
              payment.due_date === new Date(payment.trip_departure_date).toISOString().split('T')[0];
            return (
              <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                {isDepartureDay ? 'w dniu wyjazdu' : `do ${format(new Date(payment.due_date), 'd.MM.yyyy', { locale: pl })}`}
              </span>
            );
          })() : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${status.bgClass}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
          {isOverdue && payment.status !== 'overdue' && payment.status !== 'partially_paid_overdue' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
              Po terminie
            </span>
          )}
        </div>

        <div className="text-right">
          {payment.status === 'paid' ? (
            <span className="text-sm font-semibold text-emerald-600">{payment.amount.toFixed(0)} {payment.currency}</span>
          ) : (
            <div>
              <span className={`text-sm font-bold ${isOverdue ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                {remaining.toFixed(0)} {payment.currency}
              </span>
              {payment.amount_paid > 0 && (
                <span className="text-xs text-gray-400 ml-1">
                  (wpł. {payment.amount_paid.toFixed(0)})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {payment.status !== 'paid' && (
        <div className="flex items-center mt-1.5 gap-4">
          <div className="flex items-center gap-3 text-xs text-gray-400 min-w-0">
            <span className="flex items-center gap-1 min-w-0">
              <span className="truncate">Tytuł: {transferTitle}</span>
              <button
                className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => copyToClipboard(transferTitle, 'Tytuł przelewu')}
                title="Kopiuj tytuł przelewu"
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dane do przelewu ──────────────────────────────────────────────────────
function BankAccountsSection({ bankAccounts }: { bankAccounts: BankAccountInfo }) {
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

// ── Grupowanie wg dziecka ─────────────────────────────────────────────────
function PaymentsGroupedByChild({ payments }: { payments: ParentPayment[] }) {
  const grouped = useMemo(() => {
    const childMap = new Map<string, { name: string; payments: ParentPayment[] }>();
    const sorted = [...payments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    sorted.forEach((payment) => {
      const key = payment.child_name;
      const existing = childMap.get(key);
      if (existing) existing.payments.push(payment);
      else childMap.set(key, { name: payment.child_name, payments: [payment] });
    });
    return Array.from(childMap.values());
  }, [payments]);

  if (payments.length === 0) {
    return (
      <EmptyState icon={CreditCard} title="Brak płatności" description="Nie ma płatności do wyświetlenia." />
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.name}>
          <div className="flex items-center gap-4 mb-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {group.name}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-4 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <div>Wyjazd</div>
            <div>Płatność</div>
            <div>Termin</div>
            <div>Status</div>
            <div className="text-right">Kwota</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 divide-y divide-gray-50 overflow-hidden">
            {group.payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        </div>
      ))}
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
    const pending = [...pendingPayments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    const paid = [...paidPayments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    return [...pending, ...paid];
  }, [pendingPayments, paidPayments]);

  // Lista unikalnych wyjazdów do dropdownu
  const availableTrips = useMemo(() => {
    const tripMap = new Map<string, string>();
    allPayments.forEach((p) => {
      if (!tripMap.has(p.trip_id)) tripMap.set(p.trip_id, p.trip_title);
    });
    return Array.from(tripMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
  }, [allPayments]);

  // Archived = opłacone AND wyjazd zakończony
  const { active, archived } = useMemo(() => {
    const now = new Date();
    const active: ParentPayment[] = [];
    const archived: ParentPayment[] = [];
    allPayments.forEach((p) => {
      const tripEnded = p.trip_return_date && new Date(p.trip_return_date) < now;
      if (p.status === 'paid' && tripEnded) archived.push(p);
      else active.push(p);
    });
    return { active, archived };
  }, [allPayments]);

  // Filtrowanie po wyjeździe (aktywne + archiwum)
  const activeFiltered = useMemo(
    () => (tripFilter === 'all' ? active : active.filter((p) => p.trip_id === tripFilter)),
    [active, tripFilter]
  );
  const archivedFiltered = useMemo(
    () => (tripFilter === 'all' ? archived : archived.filter((p) => p.trip_id === tripFilter)),
    [archived, tripFilter]
  );

  // Podzbiory do bloków sumarycznych (na podstawie filtru wyjazdu)
  const summaryPending = useMemo(
    () => activeFiltered.filter((p) => ['pending', 'partially_paid'].includes(p.status) && !isOverduePayment(p)),
    [activeFiltered]
  );
  const summaryOverdue = useMemo(() => activeFiltered.filter(isOverduePayment), [activeFiltered]);

  // Podzbiory do przycisków filtra
  const overduePayments = useMemo(() => activeFiltered.filter(isOverduePayment), [activeFiltered]);
  const pendingOnly = useMemo(
    () => activeFiltered.filter((p) => ['pending', 'partially_paid'].includes(p.status) && !isOverduePayment(p)),
    [activeFiltered]
  );
  const allPaid = useMemo(
    () => [...activeFiltered, ...archivedFiltered].filter((p) => p.status === 'paid'),
    [activeFiltered, archivedFiltered]
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
    { id: 'all',     label: 'Wszystkie',  count: activeFiltered.length,  activeClass: 'bg-gray-900 text-white' },
    { id: 'pending', label: 'Do zapłaty', count: pendingOnly.length,     activeClass: 'bg-amber-500 text-white' },
    { id: 'overdue', label: 'Po terminie',count: overduePayments.length, activeClass: 'bg-red-500 text-white' },
    { id: 'paid',    label: 'Opłacone',   count: allPaid.length,         activeClass: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="space-y-6">
      <BankAccountsSection bankAccounts={bankAccounts} />

      {/* Bloki sumaryczne */}
      <SummaryBlocks pendingSource={summaryPending} overdueSource={summaryOverdue} />

      <div className="space-y-4">
        {/* Dropdown wyjazdu + filtry statusu */}
        <div className="flex flex-wrap items-center gap-2">
          {availableTrips.length > 1 && (
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className={`appearance-none pl-8 pr-8 py-2 rounded-xl text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  tripFilter !== 'all'
                    ? 'bg-blue-600 text-white border border-blue-700'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <option value="all">Wszystkie wyjazdy</option>
                {availableTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${tripFilter !== 'all' ? 'text-blue-200' : 'text-blue-400'}`} />
            </div>
          )}

          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.id ? tab.activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === tab.id ? 'bg-white/20' : 'bg-gray-200 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista płatności */}
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
          <PaymentsGroupedByChild payments={displayPayments} />
        )}

        {/* Archiwum — tylko w widoku "Wszystkie" i "Opłacone" */}
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
                <PaymentsGroupedByChild payments={archivedFiltered} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
