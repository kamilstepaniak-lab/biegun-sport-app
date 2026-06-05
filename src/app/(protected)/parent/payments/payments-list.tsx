'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PaymentDue } from '@/components/shared/payment-due';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  ChevronLeft,
  ChevronRight,
  Landmark,
} from 'lucide-react';
import { toast } from 'sonner';

import { CopyIconButton, EmptyState, MetricCard, PanelCard, SectionTitle } from '@/components/shared';
import { cn } from '@/lib/utils';

import type { ParentPayment, BankAccountInfo } from '@/lib/actions/payments';

interface ParentPaymentsListProps {
  pendingPayments: ParentPayment[];
  paidPayments: ParentPayment[];
  bankAccounts: BankAccountInfo;
}

const statusConfig: Record<string, { label: string; bgClass: string; icon: typeof Check }> = {
  pending: { label: 'Do zapłaty', bgClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', icon: Clock },
  partially_paid: { label: 'Do dopłaty', bgClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', icon: Clock },
  partially_paid_overdue: { label: 'Zaległość', bgClass: 'bg-red-50 text-red-700 ring-1 ring-red-200', icon: AlertCircle },
  overdue: { label: 'Zaległość', bgClass: 'bg-red-50 text-red-700 ring-1 ring-red-200', icon: AlertCircle },
  paid: { label: 'Opłacone', bgClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icon: Check },
  cancelled: { label: 'Anulowane', bgClass: 'bg-gray-100 text-gray-400', icon: Check },
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} skopiowany do schowka`);
}

function isOverduePayment(p: ParentPayment) {
  if (p.status === 'paid' || p.status === 'cancelled') return false;
  if (!p.due_date) return false;
  // Porównanie do północy — spójne z komponentem PaymentDue (admin).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(p.due_date) < today;
}

function getPaymentTypeLabel(p: ParentPayment): string {
  if (p.payment_type === 'manual') return p.manual_title?.trim() || 'Płatność';
  if (p.payment_type === 'installment') return `Rata ${p.installment_number}`;
  if (p.payment_type === 'season_pass') return 'Karnet';
  if (p.payment_type === 'full') return 'Pełna opłata';
  return p.payment_type;
}

function getChildDisplayName(p: ParentPayment): string {
  const name = `${p.child_last_name} ${p.child_first_name}`.trim();
  return name || p.child_name;
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
      <MetricCard
        icon={Clock}
        label="Do zapłaty"
        value={
          hasPending
            ? sortedPending.map(([currency, sum]) => `${sum.toFixed(0)} ${currency}`).join(' · ')
            : '0 PLN'
        }
        description={hasPending ? 'razem z płatnościami po terminie' : 'Wszystko opłacone'}
        tone="amber"
      />
      <MetricCard
        icon={AlertCircle}
        label="Po terminie"
        value={
          hasOverdue
            ? sortedOverdue.map(([currency, sum]) => `${sum.toFixed(0)} ${currency}`).join(' · ')
            : '0 PLN'
        }
        description={hasOverdue ? 'wymaga uwagi' : 'Brak zaległości'}
        tone={hasOverdue ? 'red' : 'slate'}
      />
    </div>
  );
}

// ── Dane do przelewu ──────────────────────────────────────────────────────
export function BankAccountsSection({ bankAccounts }: { bankAccounts: BankAccountInfo }) {
  return (
    <PanelCard className="p-5">
      <SectionTitle icon={Banknote} title="Dane do przelewu" className="mb-4" />
      <div className="grid gap-3 md:grid-cols-2">
        {bankAccounts.bank_account_pln && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 gap-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-400 mb-0.5">Konto PLN</p>
              <p className="text-sm text-gray-900 break-all">{bankAccounts.bank_account_pln}</p>
            </div>
            <CopyIconButton
              label="Kopiuj numer konta PLN"
              onClick={() => copyToClipboard(bankAccounts.bank_account_pln!, 'Numer konta PLN')}
            />
          </div>
        )}
        {bankAccounts.bank_account_eur && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 gap-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-400 mb-0.5">Konto EUR</p>
              <p className="text-sm text-gray-900 break-all">{bankAccounts.bank_account_eur}</p>
            </div>
            <CopyIconButton
              label="Kopiuj numer konta EUR"
              onClick={() => copyToClipboard(bankAccounts.bank_account_eur!, 'Numer konta EUR')}
            />
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ── Wspólna logika płatności ───────────────────────────────────────────────
function getPaymentData(payment: ParentPayment) {
  const cfg = statusConfig[payment.status] ?? statusConfig.pending;
  const StatusIcon = cfg.icon;
  const isOverdue = isOverduePayment(payment);
  const remaining = payment.amount - payment.amount_paid;

  const tripDate = payment.trip_departure_date
    ? format(new Date(payment.trip_departure_date), 'dd.MM.yyyy', { locale: pl })
    : '';
  const transferTitle = `${payment.child_last_name} ${payment.child_first_name} ${payment.trip_title} ${tripDate}`.trim();
  return { cfg, StatusIcon, isOverdue, remaining, transferTitle };
}

const COMPANY_NAME = 'BiegunSport Stepaniak & Biegun Sp.j';

function getBankAccountForCurrency(bankAccounts: BankAccountInfo, currency: string) {
  return currency === 'EUR' ? bankAccounts.bank_account_eur : bankAccounts.bank_account_pln;
}

function TransferCopyRow({
  label,
  value,
  copyLabel,
  strong = false,
}: {
  label: string;
  value: string;
  copyLabel: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-gray-400">{label}</p>
        <p className={cn('break-words text-sm text-gray-900', strong && 'text-base font-bold tabular-nums')}>
          {value}
        </p>
      </div>
      <CopyIconButton
        label={`Kopiuj: ${label}`}
        onClick={() => copyToClipboard(value, copyLabel)}
      />
    </div>
  );
}

function PaymentDialog({
  payment,
  bankAccounts,
  relatedPayments,
}: {
  payment: ParentPayment;
  bankAccounts: BankAccountInfo;
  relatedPayments: ParentPayment[];
}) {
  const transferPayments = relatedPayments.length > 0 ? relatedPayments : [payment];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-9 rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700"
        >
          <CreditCard className="h-4 w-4" />
          Przelew
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <DialogTitle>Dane do przelewu</DialogTitle>
          <DialogDescription>
            {getChildDisplayName(payment)} — {getPaymentTypeLabel(payment)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <TransferCopyRow label="Odbiorca" value={COMPANY_NAME} copyLabel="Dane firmy" />
          {transferPayments.map((item) => {
            const { remaining, transferTitle } = getPaymentData(item);
            const account = getBankAccountForCurrency(bankAccounts, item.currency);
            const amount = `${remaining.toFixed(0)} ${item.currency}`;

            return (
              <div key={item.id} className="space-y-3 rounded-2xl border border-gray-100 p-3">
                {transferPayments.length > 1 && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {getPaymentTypeLabel(item)} — {item.currency}
                  </p>
                )}
                {account ? (
                  <TransferCopyRow
                    label={`Numer konta ${item.currency}`}
                    value={account}
                    copyLabel={`Numer konta ${item.currency}`}
                  />
                ) : (
                  <div className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-700 ring-1 ring-amber-200">
                    Brak zapisanego numeru konta dla waluty {item.currency}.
                  </div>
                )}
                <TransferCopyRow label="Tytuł przelewu" value={transferTitle} copyLabel="Tytuł przelewu" />
                <TransferCopyRow label="Kwota" value={amount} copyLabel="Kwota" strong />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getRelatedTransferPayments(payment: ParentPayment, allPayments: ParentPayment[]) {
  if (payment.payment_type === 'manual') {
    return allPayments.filter((item) => (
      item.id === payment.id &&
      item.status !== 'paid' &&
      item.status !== 'cancelled' &&
      item.amount - item.amount_paid > 0
    ));
  }

  return allPayments.filter((item) => (
    item.id === payment.id ||
    (
      item.participant_id === payment.participant_id &&
      item.trip_id === payment.trip_id &&
      item.payment_type === payment.payment_type &&
      item.installment_number === payment.installment_number
    )
  )).filter((item) => (
    item.status !== 'paid' &&
    item.status !== 'cancelled' &&
    item.amount - item.amount_paid > 0
  ));
}

// ── Wiersz tabeli ─────────────────────────────────────────────────────────
function PaymentRow({
  payment,
  bankAccounts,
  allPayments,
}: {
  payment: ParentPayment;
  bankAccounts: BankAccountInfo;
  allPayments: ParentPayment[];
}) {
  const { cfg, StatusIcon, isOverdue, remaining, transferTitle } = getPaymentData(payment);
  const relatedTransferPayments = getRelatedTransferPayments(payment, allPayments);

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
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{getChildDisplayName(payment)}</span>
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
          <Copy className="h-3 w-3 text-blue-500 flex-shrink-0" />
        </button>
      </td>

      {/* Za co */}
      <td className="py-3 px-3">
        <span className="text-sm text-gray-700">{getPaymentTypeLabel(payment)}</span>
      </td>

      {/* Kwota */}
      <td className="py-3 px-3 text-left whitespace-nowrap">
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
              <span className="mt-0.5 block text-xs text-gray-400">
                {payment.amount_paid.toFixed(0)} {payment.currency} wpłacono
              </span>
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
      <td className="py-3 px-3 whitespace-nowrap text-sm">
        <PaymentDue
          paymentDueDate={payment.due_date}
          departureDate={payment.trip_departure_date}
          status={payment.status}
        />
      </td>

      {/* Akcja */}
      <td className="py-3 pl-3 pr-4 text-left whitespace-nowrap">
        {payment.status === 'paid' ? (
          <span className="text-xs font-semibold text-emerald-600">Opłacone</span>
        ) : (
          <PaymentDialog
            payment={payment}
            bankAccounts={bankAccounts}
            relatedPayments={relatedTransferPayments}
          />
        )}
      </td>

    </tr>
  );
}

// ── Tabela / karty płatności ──────────────────────────────────────────────
function PaymentsTable({
  payments,
  bankAccounts,
  allPayments,
  label,
}: {
  payments: ParentPayment[];
  bankAccounts: BankAccountInfo;
  allPayments: ParentPayment[];
  label?: string;
}) {
  if (payments.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
      {label && (
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        </div>
      )}
      {/* Mobile: karty */}
      <div className="md:hidden divide-y divide-gray-100">
        {payments.map((p) => (
          <PaymentCard key={p.id} payment={p} bankAccounts={bankAccounts} allPayments={allPayments} />
        ))}
      </div>
      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left py-2.5 pl-4 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Dziecko</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Wyjazd</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Za co</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Kwota</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Termin</th>
              <th className="text-left py-2.5 pl-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Płatność</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <PaymentRow key={p.id} payment={p} bankAccounts={bankAccounts} allPayments={allPayments} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Karta płatności (mobile) ─────────────────────────────────────────────
function PaymentCard({
  payment,
  bankAccounts,
  allPayments,
}: {
  payment: ParentPayment;
  bankAccounts: BankAccountInfo;
  allPayments: ParentPayment[];
}) {
  const { cfg, StatusIcon, isOverdue, remaining, transferTitle } = getPaymentData(payment);
  const relatedTransferPayments = getRelatedTransferPayments(payment, allPayments);

  return (
    <div
      className={cn(
        'p-4 space-y-3',
        payment.status === 'paid'
          ? 'bg-emerald-50/20'
          : isOverdue
            ? 'bg-red-50/10'
            : '',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{getChildDisplayName(payment)}</p>
          <p className="mt-0.5 text-sm text-gray-700 truncate">{payment.trip_title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{getPaymentTypeLabel(payment)}</p>
        </div>
        <div className="text-right shrink-0">
          {payment.status === 'paid' ? (
            <span className="text-sm font-semibold text-emerald-600 tabular-nums">
              {payment.amount.toFixed(0)} {payment.currency}
            </span>
          ) : (
            <>
              <span className={cn('text-base font-bold tabular-nums', isOverdue ? 'text-red-600' : 'text-gray-900')}>
                {remaining.toFixed(0)} {payment.currency}
              </span>
              {payment.amount_paid > 0 && (
                <span className="block text-xs text-gray-400">
                  {payment.amount_paid.toFixed(0)} {payment.currency} wpłacono
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bgClass)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        {isOverdue && payment.status !== 'overdue' && payment.status !== 'partially_paid_overdue' && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Po terminie
          </span>
        )}
        <span className="ml-auto text-xs text-gray-600">
          <PaymentDue
            paymentDueDate={payment.due_date}
            departureDate={payment.trip_departure_date}
            status={payment.status}
          />
        </span>
      </div>

      <button
        className="flex w-full items-center gap-1 group"
        onClick={() => copyToClipboard(transferTitle, 'Tytuł przelewu')}
        title="Kopiuj tytuł przelewu"
      >
        <span className="text-xs text-gray-400 truncate group-hover:text-blue-500 transition-colors">{transferTitle}</span>
        <Copy className="h-3 w-3 text-blue-500 flex-shrink-0" />
      </button>

      <div className="flex justify-end pt-1">
        {payment.status === 'paid' ? (
          <span className="text-xs font-semibold text-emerald-600">Opłacone</span>
        ) : (
          <PaymentDialog
            payment={payment}
            bankAccounts={bankAccounts}
            relatedPayments={relatedTransferPayments}
          />
        )}
      </div>
    </div>
  );
}

// ── Główny komponent ──────────────────────────────────────────────────────
const PAGE_SIZE = 20;

type FilterType = 'all' | 'pending' | 'overdue' | 'paid';

export function ParentPaymentsList({ pendingPayments, paidPayments, bankAccounts }: ParentPaymentsListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [tripFilter, setTripFilter] = useState<string>('all');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [page, setPage] = useState(1);

  const allPayments = useMemo(() => {
    const effectiveDue = (p: ParentPayment): Date | null => {
      return p.due_date ? new Date(p.due_date) : null;
    };
    const byDue = (a: ParentPayment, b: ParentPayment) => {
      const da = effectiveDue(a);
      const db = effectiveDue(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
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
      case 'paid': return allPaid;
      default: return activeFiltered;
    }
  }, [filter, activeFiltered, pendingOnly, overduePayments, allPaid]);

  const totalPages = Math.max(1, Math.ceil(displayPayments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedPayments = displayPayments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterTabs: { id: FilterType; label: string; count: number; activeClass: string }[] = [
    { id: 'all', label: 'Wszystkie', count: activeFiltered.length, activeClass: 'bg-gray-900 text-white' },
    { id: 'pending', label: 'Do zapłaty', count: pendingOnly.length, activeClass: 'bg-amber-500 text-white' },
    { id: 'overdue', label: 'Po terminie', count: overduePayments.length, activeClass: 'bg-red-500 text-white' },
    { id: 'paid', label: 'Opłacone', count: allPaid.length, activeClass: 'bg-emerald-600 text-white' },
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
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <select
                value={tripFilter}
                onChange={(e) => { setTripFilter(e.target.value); setPage(1); }}
                className={cn(
                  'h-11 appearance-none pl-9 pr-8 rounded-xl text-base md:text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
                  tripFilter !== 'all'
                    ? 'bg-blue-600 text-white ring-1 ring-blue-700'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <option value="all">Filtruj wg. wyjazdu</option>
                {availableTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none', tripFilter !== 'all' ? 'text-blue-200' : 'text-gray-400')} />
            </div>
          )}

          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setFilter(tab.id); setPage(1); }}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                filter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn('ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold', filter === tab.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>
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
                  filter === 'paid' ? 'Nie masz jeszcze opłaconych płatności.' :
                    'Nie masz jeszcze żadnych płatności.'
            }
          />
        ) : (
          <>
            <PaymentsTable payments={paginatedPayments} bankAccounts={bankAccounts} allPayments={allPayments} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-400">
                  Strona {safePage} z {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (safePage <= 4) {
                      pageNum = i + 1;
                    } else if (safePage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = safePage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all',
                          safePage === pageNum ? 'bg-blue-600 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
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
                <PaymentsTable payments={archivedFiltered} bankAccounts={bankAccounts} allPayments={allPayments} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
