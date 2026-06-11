'use client';

import { Fragment, useState, useMemo, useRef, useOptimistic, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search,
  X,
  Check,
  Edit2,
  Save,
  CircleDollarSign,
  CheckCircle2,
  MessageSquare,
  CalendarDays,
  ListFilter,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Trash2,
  AlertTriangle,
  Bell,
  Download,
  ArrowDownUp,
  Receipt,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  updatePaymentStatus,
  updatePaymentAmount,
  updatePaymentNote,
  bulkUpdatePaymentStatus,
  deletePayment,
  bulkDeletePayments,
  sendPaymentReminders,
  exportAdminPaymentsCsv,
  getPaymentTransactions,
  type AdminPaymentsStatusFilter,
  type AdminPaymentsSort,
} from '@/lib/actions/payments';
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog';
import type { AdminPaymentRow, PaymentStatus, PaymentTransaction } from '@/types';
import { formatPaymentDueDate } from '@/lib/payment-due';
import { cn } from '@/lib/utils';

// Próg tolerancji groszowej — saldo poniżej uznajemy za rozliczone.
const SALDO_EPSILON = 0.5;

type PageSize = 25 | 50 | 100;

const COLUMN_COUNT = 8;

interface PaymentsListProps {
  rows: AdminPaymentRow[];
  total: number;
  stats: {
    pending: number;
    paid: number;
    overdue: number;
    pendingPLN: number;
    pendingEUR: number;
    overduePLN: number;
    overdueEUR: number;
  };
  trips: { id: string; title: string }[];
  page: number;
  pageSize: number;
  search: string;
  tripId: string;
  status: AdminPaymentsStatusFilter;
  sort: AdminPaymentsSort;
  dateFrom: string;
  dateTo: string;
}

export function PaymentsList({
  rows,
  total,
  stats,
  trips,
  page,
  pageSize,
  search,
  tripId,
  status,
  sort,
  dateFrom,
  dateTo,
}: PaymentsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [deletingConfirm, setDeletingConfirm] = useState<string | null>(null);
  const [revertConfirm, setRevertConfirm] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [isBulkReminding, setIsBulkReminding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Rozwinięta historia wpłat per płatność (lazy load)
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [txRows, setTxRows] = useState<PaymentTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const lastCheckedIndexRef = useRef<number | null>(null);
  const [, startTransition] = useTransition();
  const [isNavPending, startNavTransition] = useTransition();

  // Optimistic status — natychmiastowa zmiana UI przed odpowiedzią serwera
  const [optimisticRows, setOptimisticRows] = useOptimistic(
    rows,
    (current: AdminPaymentRow[], update: { id: string; status: PaymentStatus; amount_paid: number }) =>
      current.map((p) =>
        p.id === update.id
          ? {
              ...p,
              status: update.status,
              amount_paid: update.amount_paid,
              paid_at: update.status === 'paid' ? new Date().toISOString() : null,
            }
          : p
      )
  );

  const displayedRows = useMemo(
    () => optimisticRows.filter((r) => !deletedIds.has(r.id)),
    [optimisticRows, deletedIds]
  );

  // ── Grupowanie: dziecko + wyjazd (kolejność pierwszego wystąpienia) ──────
  interface PaymentGroup {
    key: string;
    participantName: string;
    tripTitle: string;
    isManual: boolean;
    rows: { row: AdminPaymentRow; flatIndex: number }[];
  }

  const groups = useMemo<PaymentGroup[]>(() => {
    const map = new Map<string, PaymentGroup>();
    const list: PaymentGroup[] = [];
    displayedRows.forEach((row, flatIndex) => {
      const isManual = !row.trip_id;
      const key = `${row.participant_id ?? row.participant_name}|${row.trip_id ?? 'manual'}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          participantName: row.participant_name,
          tripTitle: isManual ? 'Płatności ręczne' : row.trip_title,
          isManual,
          rows: [],
        };
        map.set(key, group);
        list.push(group);
      }
      group.rows.push({ row, flatIndex });
    });
    return list;
  }, [displayedRows]);

  // ── Filtry sterowane przez URL ────────────────────────────────────────────
  function pushParams(updates: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    // Zmiana dowolnego filtra resetuje stronę (chyba że to sama zmiana strony)
    if (!('page' in updates)) next.delete('page');
    startNavTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  // Wyszukiwarka — lokalny stan + debounce, żeby nie nawigować przy każdym znaku
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() !== search.trim()) {
        pushParams({ q: searchInput.trim() || null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const emptyMessage =
    search || tripId !== 'all' || status !== 'all' || dateFrom || dateTo
      ? 'Brak płatności pasujących do filtrów'
      : 'Brak płatności';

  // Handlers
  async function handleStatusChange(paymentId: string, newStatus: 'pending' | 'paid') {
    if (selectedIds.has(paymentId) && selectedIds.size > 1) {
      await handleBulkAction(newStatus);
      return;
    }

    const currentRow = rows.find((p) => p.id === paymentId);
    const optimisticAmountPaid = newStatus === 'paid' ? currentRow?.amount ?? 0 : 0;

    startTransition(async () => {
      setOptimisticRows({ id: paymentId, status: newStatus, amount_paid: optimisticAmountPaid });
      try {
        const result = await updatePaymentStatus(paymentId, newStatus);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            newStatus === 'paid' ? 'Oznaczono jako opłacone' : 'Oznaczono jako nieopłacone'
          );
        }
        router.refresh();
      } catch {
        toast.error('Wystąpił błąd');
        router.refresh();
      }
    });
  }

  // „Nie" przy zarejestrowanych wpłatach jest destrukcyjne (zeruje wpłaty
  // i usuwa transakcje) — wymaga potwierdzenia.
  function requestRevert(row: AdminPaymentRow) {
    if ((row.amount_paid ?? 0) > 0) {
      setRevertConfirm(row.id);
      return;
    }
    handleStatusChange(row.id, 'pending');
  }

  async function saveAmount(paymentId: string) {
    const value = parseFloat(editAmount);
    if (isNaN(value) || value < 0) {
      toast.error('Podaj poprawną kwotę');
      return;
    }
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentAmount(paymentId, value);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Kwota zaktualizowana');
        setEditingPayment(null);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }

  async function saveNote(paymentId: string) {
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentNote(paymentId, editNote);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Notatka zapisana');
        setEditingNote(null);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleBulkAction(newStatus: 'paid' | 'pending') {
    if (!selectedIds.size) return;
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdatePaymentStatus(Array.from(selectedIds), newStatus);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          newStatus === 'paid'
            ? `Oznaczono ${selectedIds.size} płatności jako opłacone`
            : `Oznaczono ${selectedIds.size} płatności jako nieopłacone`
        );
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleDelete(paymentId: string) {
    setDeletedIds((prev) => new Set(prev).add(paymentId));
    setDeletingConfirm(null);
    try {
      const result = await deletePayment(paymentId);
      if (result.error) {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(paymentId);
          return next;
        });
        toast.error(result.error);
      } else {
        toast.success('Płatność usunięta');
        router.refresh();
      }
    } catch {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(paymentId);
        return next;
      });
      toast.error('Wystąpił błąd');
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setIsBulkDeleting(true);
    setBulkDeleteConfirm(false);
    try {
      const result = await bulkDeletePayments(ids);
      if (result.error) {
        toast.error(result.error);
      } else {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
        toast.success(`Usunięto ${ids.length} płatności`);
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleSendReminder(paymentIds: string[]) {
    const isBulk = paymentIds.length > 1;
    if (isBulk) setIsBulkReminding(true);
    else setSendingReminder(paymentIds[0]);
    try {
      const result = await sendPaymentReminders(paymentIds);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else if ('sent' in result) {
        if (result.sent === 0) {
          toast.info('Nie wysłano przypomnień (płatności opłacone lub bez terminu/adresu)');
        } else {
          toast.success(
            result.sent === 1
              ? 'Przypomnienie wysłane'
              : `Wysłano ${result.sent} przypomnień${result.skipped ? ` (${result.skipped} pominiętych)` : ''}`
          );
        }
        if (isBulk) setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsBulkReminding(false);
      setSendingReminder(null);
    }
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const result = await exportAdminPaymentsCsv({ search, tripId, dateFrom, dateTo, status });
      if ('error' in result) {
        toast.error(result.error);
      } else {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platnosci-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsExporting(false);
    }
  }

  async function toggleTransactions(paymentId: string) {
    if (expandedTx === paymentId) {
      setExpandedTx(null);
      return;
    }
    setExpandedTx(paymentId);
    setTxRows([]);
    setTxLoading(true);
    try {
      const transactions = await getPaymentTransactions(paymentId);
      setTxRows(transactions);
    } finally {
      setTxLoading(false);
    }
  }

  function toggleSelect(id: string, index: number, shiftKey: boolean) {
    if (shiftKey && lastCheckedIndexRef.current !== null) {
      const from = Math.min(lastCheckedIndexRef.current, index);
      const to = Math.max(lastCheckedIndexRef.current, index);
      const shouldSelect = !selectedIds.has(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) {
          const rowId = displayedRows[i]?.id;
          if (rowId) {
            if (shouldSelect) next.add(rowId);
            else next.delete(rowId);
          }
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    lastCheckedIndexRef.current = index;
  }

  function toggleSelectAll() {
    const allIds = displayedRows.map((r) => r.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSelectGroup(group: PaymentGroup) {
    const ids = group.rows.map(({ row }) => row.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleGroupCollapsed(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getPaymentLabel(row: AdminPaymentRow): string {
    // Płatność ręczna: w kolumnie „Za co" pokazujemy opis (po co jest
    // płatność) zamiast generycznego „Płatność ręczna".
    if (row.payment_type === 'manual') {
      return row.manual_title?.trim() || row.admin_notes?.trim() || 'Płatność';
    }
    if (row.payment_type === 'installment') return `Rata ${row.installment_number}`;
    if (row.payment_type === 'season_pass') return 'Karnet';
    return row.payment_type;
  }

  function getStatusBadge(s: string) {
    switch (s) {
      case 'paid':
        return { label: 'Opłacone', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
      case 'overdue':
        return { label: 'Po terminie', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
      case 'partially_paid_overdue':
        return { label: 'Po terminie', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
      case 'partially_paid':
        return { label: 'Do dopłaty', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
      case 'cancelled':
        return { label: 'Anulowane', cls: 'bg-gray-100 text-gray-400' };
      default:
        return { label: 'Do zapłaty', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
    }
  }

  const statusFilters: { key: AdminPaymentsStatusFilter; label: string }[] = [
    { key: 'pending', label: 'Do zapłaty' },
    { key: 'overdue', label: 'Po terminie' },
    { key: 'paid', label: 'Opłacone' },
    { key: 'all', label: 'Wszystkie' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Saldo grupy: ile brakuje per waluta (tylko nieopłacone pozycje).
  function groupRemaining(group: PaymentGroup): { currency: string; sum: number }[] {
    const sums: Record<string, number> = {};
    group.rows.forEach(({ row }) => {
      if (row.status === 'paid' || row.status === 'cancelled') return;
      const rem = row.amount - (row.amount_paid ?? 0);
      if (rem > SALDO_EPSILON) sums[row.currency] = (sums[row.currency] ?? 0) + rem;
    });
    return Object.entries(sums)
      .sort((a, b) => (a[0] === 'PLN' ? -1 : 1) - (b[0] === 'PLN' ? -1 : 1))
      .map(([currency, sum]) => ({ currency, sum }));
  }

  // ── Wspólne metadane i fragmenty wiersza (tabela desktop + karty mobile) ──
  function getRowMeta(row: AdminPaymentRow) {
    const isPaid = row.status === 'paid';
    const isCancelled = row.status === 'cancelled';
    // effective_due_date z widoku uwzględnia regułę „X dni od potwierdzenia"
    // (confirmed_at + X dni), więc termin pokazuje się też gdy payments.due_date
    // jest puste.
    const dueDate = row.effective_due_date ? new Date(row.effective_due_date) : null;
    const isDueDateOverdue = dueDate ? dueDate < today : false;
    const isOverdue =
      row.status === 'overdue' ||
      row.status === 'partially_paid_overdue' ||
      (isDueDateOverdue && !isPaid && !isCancelled);
    const amountPaid = row.amount_paid ?? 0;
    // Zniżka realna (checkbox we Wpłacie) vs zwykła edycja ceny.
    // discount_applied_at ustawiane tylko przy zniżce; edycja kwoty je zeruje.
    const hasDiscount = !!row.discount_applied_at;
    const priceDelta = row.original_amount - row.amount;
    // Cena edytowana w dół bez zniżki → przekreślamy starą cenę w kolumnie Kwota.
    const priceEdited = !hasDiscount && priceDelta > 0.5;
    return {
      isPaid,
      isCancelled,
      dueDate,
      isDueDateOverdue,
      isOverdue,
      amountPaid,
      hasDiscount,
      priceDelta,
      priceEdited,
    };
  }
  type RowMeta = ReturnType<typeof getRowMeta>;

  function renderAmount(row: AdminPaymentRow, meta: RowMeta) {
    if (editingPayment === row.id) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAmount(row.id);
              if (e.key === 'Escape') setEditingPayment(null);
            }}
            className="h-9 w-20 text-xs rounded-lg"
            min="0"
            step="0.01"
            placeholder="kwota"
            autoFocus
          />
          <span className="text-xs text-gray-400">{row.currency}</span>
          <button
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={() => saveAmount(row.id)}
            disabled={isUpdating === row.id}
          >
            <Save className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={() => setEditingPayment(null)}
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              setEditingPayment(row.id);
              setEditAmount(row.amount.toString());
            }}
            className="flex items-center gap-1.5 group"
          >
            {meta.priceEdited && (
              <span className="text-xs text-gray-400 line-through tabular-nums">
                {row.original_amount.toFixed(0)}
              </span>
            )}
            <span className="text-sm font-bold text-gray-900 tabular-nums group-hover:text-blue-600 transition-colors">
              {row.amount.toFixed(0)} {row.currency}
            </span>
            <Edit2 className="h-3 w-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="rounded-lg">Kliknij aby edytować kwotę</TooltipContent>
      </Tooltip>
    );
  }

  // Zniżka — tylko realna zniżka (checkbox we Wpłacie), nie edycja ceny.
  function renderDiscountInfo(row: AdminPaymentRow, meta: RowMeta) {
    if (!(meta.hasDiscount && meta.priceDelta > 0.5)) return null;
    return (
      <div className="leading-tight">
        <span className="text-sm font-semibold text-amber-600 tabular-nums">
          −{meta.priceDelta.toFixed(0)} {row.currency}
        </span>
        <p className="text-[11px] text-gray-400 tabular-nums">
          z {row.original_amount.toFixed(0)} {row.currency}
        </p>
      </div>
    );
  }

  function renderStatusPills(row: AdminPaymentRow, meta: RowMeta) {
    const { label: statusLabel, cls: statusCls } = getStatusBadge(row.status);
    const rem = row.amount_remaining ?? row.amount - meta.amountPaid;
    const showNadplata = row.status !== 'cancelled' && rem < -SALDO_EPSILON;
    const showDoplata =
      row.status !== 'cancelled' &&
      rem > SALDO_EPSILON &&
      (row.status === 'partially_paid' || row.status === 'partially_paid_overdue');
    // „Do dopłaty X zł" zastępuje pill „Do dopłaty" przy partially_paid
    // (nie chcemy dwóch identycznych etykiet). Dla partially_paid_overdue
    // zostawiamy pill „Po terminie" + kwotę „Do dopłaty X" — uzupełniają się.
    const hideStatusPill = showDoplata && row.status === 'partially_paid';
    return (
      <>
        {!hideStatusPill && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full',
              statusCls
            )}
          >
            {statusLabel}
          </span>
        )}
        {showNadplata && (
          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            Nadpłata {Math.abs(rem).toFixed(0)} {row.currency}
          </span>
        )}
        {showDoplata && (
          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            Do dopłaty {rem.toFixed(0)} {row.currency}
          </span>
        )}
      </>
    );
  }

  function renderDueInfo(row: AdminPaymentRow, meta: RowMeta, align: 'left' | 'right' = 'left') {
    if (!meta.dueDate) {
      return (
        <span className="text-gray-500 text-sm">
          {formatPaymentDueDate(
            {
              due_date: row.due_date,
              due_days_from_confirmation: row.due_days_from_confirmation,
            },
            row.trip_departure_datetime ?? undefined,
          )}
        </span>
      );
    }
    return (
      <div className={cn('flex flex-col gap-0.5', align === 'right' && 'items-end text-right')}>
        <span
          className={cn(
            'text-sm tabular-nums',
            meta.isDueDateOverdue && !meta.isPaid ? 'text-red-600 font-semibold' : 'text-gray-500'
          )}
        >
          {format(meta.dueDate, 'd.MM.yyyy', { locale: pl })}
        </span>
        {row.last_reminder_sent_at && !meta.isPaid && (
          <span className="text-[11px] text-gray-400">
            przyp. {format(new Date(row.last_reminder_sent_at), 'd.MM', { locale: pl })}
          </span>
        )}
      </div>
    );
  }

  function renderNote(row: AdminPaymentRow) {
    if (editingNote === row.id) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            className="h-9 text-xs rounded-lg w-36"
            placeholder="Notatka..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveNote(row.id);
              if (e.key === 'Escape') setEditingNote(null);
            }}
            autoFocus
          />
          <button
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={() => saveNote(row.id)}
            disabled={isUpdating === row.id}
          >
            <Save className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={() => setEditingNote(null)}
          >
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => {
          setEditingNote(row.id);
          setEditNote(row.admin_notes || '');
        }}
        className="flex items-center gap-1.5 text-xs group w-full text-left"
      >
        <MessageSquare
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 transition-colors',
            row.admin_notes ? 'text-amber-500' : 'text-gray-300 group-hover:text-gray-400'
          )}
        />
        {row.admin_notes ? (
          <span className="text-amber-700 truncate group-hover:text-amber-900">
            {row.admin_notes}
          </span>
        ) : (
          <span className="text-gray-300 group-hover:text-gray-400">Dodaj</span>
        )}
      </button>
    );
  }

  function renderTxToggle(row: AdminPaymentRow, meta: RowMeta) {
    if (meta.amountPaid <= 0) return null;
    const isExpanded = expandedTx === row.id;
    return (
      <button
        onClick={() => toggleTransactions(row.id)}
        className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 transition-colors"
      >
        <Receipt className="h-3 w-3" />
        wpłaty
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
    );
  }

  function renderTxContent() {
    if (txLoading) return <p className="text-xs text-gray-400 py-1">Ładowanie wpłat…</p>;
    if (txRows.length === 0) {
      return (
        <p className="text-xs text-gray-400 py-1">
          Brak zarejestrowanych transakcji (wpłata mogła zostać wyzerowana).
        </p>
      );
    }
    return (
      <ul className="space-y-1 py-1">
        {txRows.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 text-xs">
            <span className="text-gray-500 tabular-nums w-20">
              {format(new Date(tx.transaction_date), 'd.MM.yyyy', { locale: pl })}
            </span>
            <span className="text-gray-400 w-16">
              {tx.payment_method === 'cash' ? 'Gotówka' : 'Przelew'}
            </span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {tx.amount.toFixed(2)} {tx.currency}
            </span>
            {tx.notes && <span className="text-gray-400 truncate">{tx.notes}</span>}
          </li>
        ))}
      </ul>
    );
  }

  // Opłacono? (Wpłata / Tak / Nie) + przypomnienie + usuń — wspólny zestaw
  // akcji; kontener flex daje miejsce wywołania (tabela vs karta).
  function renderActions(row: AdminPaymentRow, meta: RowMeta) {
    const { isPaid, isCancelled, amountPaid } = meta;
    return (
      <>
        {!isCancelled && revertConfirm === row.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium whitespace-nowrap">
              Wyzeruje wpłaty {amountPaid.toFixed(0)} {row.currency}?
            </span>
            <button
              onClick={() => {
                setRevertConfirm(null);
                handleStatusChange(row.id, 'pending');
              }}
              className="h-8 px-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Tak
            </button>
            <button
              onClick={() => setRevertConfirm(null)}
              className="h-8 px-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Anuluj
            </button>
          </div>
        ) : !isCancelled && (
          <>
            <RecordPaymentDialog
              paymentId={row.id}
              currency={row.currency as 'PLN' | 'EUR'}
              amountRemaining={row.amount_remaining ?? (row.amount - amountPaid)}
              onDone={() => router.refresh()}
            >
              <button
                className="h-9 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                <CircleDollarSign className="h-3 w-3" />
                Wpłata
              </button>
            </RecordPaymentDialog>
            <button
              className={cn(
                'h-9 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
                isPaid
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
              )}
              onClick={() => handleStatusChange(row.id, 'paid')}
              disabled={isUpdating === row.id}
            >
              <Check className="h-3 w-3" />
              Tak
            </button>
            <button
              className={cn(
                'h-9 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
                !isPaid
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                  : 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100'
              )}
              onClick={() => requestRevert(row)}
              disabled={isUpdating === row.id}
            >
              <X className="h-3 w-3" />
              Nie
            </button>
            {/* Przypomnienie mailowe — tylko nieopłacone z konkretnym terminem */}
            {!isPaid && row.effective_due_date && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSendReminder([row.id])}
                    disabled={sendingReminder === row.id || !row.parent_email}
                    className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-all disabled:opacity-50"
                  >
                    {sendingReminder === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="rounded-lg">
                  {row.parent_email
                    ? 'Wyślij przypomnienie mailowe'
                    : 'Brak adresu e-mail rodzica'}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        {/* Usuń */}
        <div className="ml-1 pl-1.5 border-l border-gray-200 flex items-center gap-1">
          {deletingConfirm === row.id ? (
            <>
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                {amountPaid > 0
                  ? `Usuń? (ma wpłaty ${amountPaid.toFixed(0)} ${row.currency})`
                  : 'Usuń?'}
              </span>
              <button
                onClick={() => handleDelete(row.id)}
                className="h-8 px-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Tak
              </button>
              <button
                onClick={() => setDeletingConfirm(null)}
                className="h-8 px-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Nie
              </button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDeletingConfirm(row.id)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg">Usuń płatność</TooltipContent>
            </Tooltip>
          )}
        </div>
      </>
    );
  }

  function renderGroupHeader(group: PaymentGroup) {
    const ids = group.rows.map(({ row }) => row.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const collapsed = collapsedGroups.has(group.key);
    const remaining = groupRemaining(group);
    const paidCount = group.rows.filter(({ row }) => row.status === 'paid').length;

    return (
      <tr key={`group-${group.key}`} className="border-b border-gray-100 bg-gray-50/80">
        <td className="py-2 pl-4 pr-2 w-8">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => toggleSelectGroup(group)}
            className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
          />
        </td>
        <td colSpan={COLUMN_COUNT - 1} className="py-2 pl-2 pr-5">
          <button
            onClick={() => toggleGroupCollapsed(group.key)}
            className="flex w-full items-center gap-2 text-left group"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
            )}
            <span className="text-sm font-bold text-gray-900">{group.participantName}</span>
            <span className="text-sm text-gray-400 truncate max-w-[320px]">{group.tripTitle}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {paidCount}/{group.rows.length} opłaconych
            </span>
            <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
              {remaining.length === 0 ? (
                <span className="text-xs font-semibold text-emerald-600">Rozliczone</span>
              ) : (
                remaining.map(({ currency, sum }) => (
                  <span key={currency} className="text-xs font-semibold text-amber-700">
                    brakuje {sum.toFixed(0)} {currency}
                  </span>
                ))
              )}
            </span>
          </button>
        </td>
      </tr>
    );
  }

  function renderRow(row: AdminPaymentRow, index: number) {
    const meta = getRowMeta(row);
    const { isPaid, isOverdue } = meta;
    const isSelected = selectedIds.has(row.id);
    const isExpanded = expandedTx === row.id;

    return (
      <Fragment key={row.id}>
        <tr
          className={cn(
            'border-b border-gray-100 transition-colors',
            isPaid
              ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
              : isOverdue
                ? 'bg-red-50/10 hover:bg-red-50/20'
                : 'hover:bg-gray-50/60',
            isSelected && 'ring-inset ring-1 ring-blue-300 bg-blue-50/40'
          )}
        >
          {/* Checkbox */}
          <td className="py-3 pl-4 pr-2 w-8">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelect(row.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
            />
          </td>

          {/* Za co */}
          <td className="py-3 pl-8 pr-3">
            <span className="text-sm text-gray-700 font-medium">{getPaymentLabel(row)}</span>
            {renderTxToggle(row, meta)}
          </td>

          {/* Kwota */}
          <td className="py-3 px-3">{renderAmount(row, meta)}</td>

          {/* Zniżka */}
          <td className="py-3 px-3">
            {renderDiscountInfo(row, meta) ?? <span className="text-gray-300 text-sm">—</span>}
          </td>

          {/* Status */}
          <td className="py-3 px-3">
            <div className="flex flex-col items-start gap-1">{renderStatusPills(row, meta)}</div>
          </td>

          {/* Termin */}
          <td className="py-3 px-3">{renderDueInfo(row, meta)}</td>

          {/* Notatka */}
          <td className="py-3 px-3 max-w-[180px]">{renderNote(row)}</td>

          {/* Opłacono? + Przypomnienie + Usuń */}
          <td className="py-3 pl-3 pr-5">
            <div className="flex gap-1.5 items-center">{renderActions(row, meta)}</div>
          </td>
        </tr>

        {/* Historia wpłat — rozwijany wiersz */}
        {isExpanded && (
          <tr className="border-b border-gray-100 bg-slate-50/60">
            <td className="py-2 pl-4 pr-2" />
            <td colSpan={COLUMN_COUNT - 1} className="py-2 pl-8 pr-5">
              {renderTxContent()}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  // ── Mobile: karta grupy (dziecko + wyjazd) ────────────────────────────────
  function renderGroupCard(group: PaymentGroup) {
    const ids = group.rows.map(({ row }) => row.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const collapsed = collapsedGroups.has(group.key);
    const remaining = groupRemaining(group);
    const paidCount = group.rows.filter(({ row }) => row.status === 'paid').length;

    return (
      <div className="flex items-center gap-2.5 bg-gray-50/80 py-2.5 pl-4 pr-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => toggleSelectGroup(group)}
          className="h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-blue-600 cursor-pointer"
        />
        <button
          onClick={() => toggleGroupCollapsed(group.key)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-gray-900">
              {group.participantName}
            </span>
            <span className="block truncate text-xs text-gray-400">
              {group.tripTitle} · {paidCount}/{group.rows.length} opłaconych
            </span>
          </span>
          <span className="flex flex-shrink-0 flex-col items-end">
            {remaining.length === 0 ? (
              <span className="text-xs font-semibold text-emerald-600">Rozliczone</span>
            ) : (
              remaining.map(({ currency, sum }) => (
                <span key={currency} className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                  brakuje {sum.toFixed(0)} {currency}
                </span>
              ))
            )}
          </span>
        </button>
      </div>
    );
  }

  // ── Mobile: karta płatności (te same dane i akcje co wiersz tabeli) ──────
  function renderRowCard(row: AdminPaymentRow, index: number) {
    const meta = getRowMeta(row);
    const isSelected = selectedIds.has(row.id);
    const isExpanded = expandedTx === row.id;
    const discount = renderDiscountInfo(row, meta);

    return (
      <div
        key={row.id}
        className={cn(
          'rounded-xl px-4 py-3 ring-1',
          meta.isPaid
            ? 'bg-emerald-50/30 ring-emerald-200/60'
            : meta.isOverdue
              ? 'bg-red-50/30 ring-red-200/60'
              : 'bg-white ring-slate-200',
          isSelected && 'bg-blue-50/40 ring-blue-300'
        )}
      >
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => toggleSelect(row.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-blue-600 cursor-pointer"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-gray-700 font-medium">{getPaymentLabel(row)}</span>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                {renderStatusPills(row, meta)}
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                {renderAmount(row, meta)}
                {discount && <div className="mt-1">{discount}</div>}
              </div>
              {renderDueInfo(row, meta, 'right')}
            </div>
            <div className="mt-2">{renderNote(row)}</div>
            {renderTxToggle(row, meta)}
            {isExpanded && (
              <div className="mt-2 rounded-xl bg-slate-50 px-3 py-1.5">{renderTxContent()}</div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {renderActions(row, meta)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Numery stron do wyświetlenia w paginacji
  const pageButtons = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Stat cards — klikalne (ustawiają filtr statusu) i respektują
            pozostałe filtry (wyjazd / szukaj / zakres terminów) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <button
            onClick={() => pushParams({ status: 'pending' })}
            className={cn(
              'bg-white rounded-2xl shadow-sm ring-1 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-left transition-all hover:ring-amber-300',
              status === 'pending' ? 'ring-2 ring-amber-400' : 'ring-gray-100'
            )}
          >
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-amber-100 flex-shrink-0">
              <CircleDollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-xs text-gray-500">Nieopłacone</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5">
                {stats.pendingPLN > 0 && (
                  <span className="text-xs font-semibold text-amber-600">
                    {stats.pendingPLN.toFixed(0)} PLN
                  </span>
                )}
                {stats.pendingEUR > 0 && (
                  <span className="text-xs font-semibold text-amber-600">
                    {stats.pendingEUR.toFixed(0)} EUR
                  </span>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => pushParams({ status: 'overdue' })}
            className={cn(
              'bg-white rounded-2xl shadow-sm ring-1 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-left transition-all hover:ring-red-300',
              status === 'overdue' ? 'ring-2 ring-red-400' : 'ring-gray-100'
            )}
          >
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-red-100 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.overdue}</p>
              <p className="text-xs text-gray-500">Po terminie</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5">
                {stats.overduePLN > 0 && (
                  <span className="text-xs font-semibold text-red-600">
                    {stats.overduePLN.toFixed(0)} PLN
                  </span>
                )}
                {stats.overdueEUR > 0 && (
                  <span className="text-xs font-semibold text-red-600">
                    {stats.overdueEUR.toFixed(0)} EUR
                  </span>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => pushParams({ status: 'paid' })}
            className={cn(
              'bg-white rounded-2xl shadow-sm ring-1 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-left transition-all hover:ring-emerald-300',
              status === 'paid' ? 'ring-2 ring-emerald-400' : 'ring-gray-100'
            )}
          >
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-100 flex-shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-500">Opłacone</p>
            </div>
          </button>
        </div>

        {/* Filtry */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            {/* Szukaj */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Szukaj po dziecku, rodzicu lub wyjeździe..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-11 pl-10 pr-8 rounded-xl bg-white ring-1 ring-gray-200 text-base md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 w-full sm:w-64 transition-all"
              />
              {searchInput && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchInput('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtr wyjazdu */}
            <div className="relative w-full sm:w-auto">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <select
                value={tripId}
                onChange={(e) => pushParams({ trip: e.target.value === 'all' ? null : e.target.value })}
                className={cn(
                  'h-11 w-full appearance-none pl-9 pr-8 rounded-xl text-base md:text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors sm:w-auto sm:max-w-[240px] truncate',
                  tripId !== 'all'
                    ? 'bg-blue-600 text-white ring-1 ring-blue-700'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <option value="all">Wszystkie wyjazdy</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={cn(
                  'absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none',
                  tripId !== 'all' ? 'text-blue-200' : 'text-gray-400'
                )}
              />
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => pushParams({ status: f.key })}
                  className={cn(
                    'inline-flex h-11 items-center px-4 rounded-xl text-sm font-medium transition-all',
                    status === f.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isNavPending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            {/* Zakres terminów płatności */}
            <div className="flex w-full flex-wrap items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2 sm:w-auto">
              <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Termin od</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => pushParams({ from: e.target.value || null })}
                className="min-w-0 flex-1 text-base md:text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer sm:flex-initial"
              />
              <span className="text-xs text-gray-300">—</span>
              <span className="text-xs text-gray-400">do</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => pushParams({ to: e.target.value || null })}
                className="min-w-0 flex-1 text-base md:text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer sm:flex-initial"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => pushParams({ from: null, to: null })}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sortowanie */}
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <ArrowDownUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex gap-1">
                <button
                  onClick={() => pushParams({ sort: null })}
                  className={cn(
                    'px-2 py-0.5 rounded-lg text-xs font-medium transition-all',
                    sort === 'due' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  Termin
                </button>
                <button
                  onClick={() => pushParams({ sort: 'created' })}
                  className={cn(
                    'px-2 py-0.5 rounded-lg text-xs font-medium transition-all',
                    sort === 'created' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  Najnowsze
                </button>
              </div>
            </div>

            {/* Rozmiar strony */}
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <ListFilter className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Na stronie</span>
              <div className="flex gap-1">
                {([25, 50, 100] as PageSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => pushParams({ size })}
                    className={cn(
                      'px-2 py-0.5 rounded-lg text-xs font-medium transition-all',
                      pageSize === size ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Eksport CSV — bieżące filtry, bez paginacji */}
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              CSV
            </button>

            <span className="ml-auto text-xs text-gray-400">{total} łącznie</span>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-blue-50 rounded-2xl ring-1 ring-blue-200">
            <span className="text-sm font-semibold text-blue-800">
              {selectedIds.size} zaznaczonych
            </span>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button
                onClick={() => handleBulkAction('paid')}
                disabled={isBulkUpdating}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Oznacz jako opłacone
              </button>
              <button
                onClick={() => handleBulkAction('pending')}
                disabled={isBulkUpdating}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Oznacz jako nieopłacone
              </button>
              <button
                onClick={() => handleSendReminder(Array.from(selectedIds))}
                disabled={isBulkReminding}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isBulkReminding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                Wyślij przypomnienia
              </button>
              {bulkDeleteConfirm ? (
                <>
                  <span className="text-xs text-red-700 font-semibold self-center">
                    Usunąć {selectedIds.size} płatności?
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="h-9 px-4 text-xs font-semibold rounded-xl bg-red-700 text-white hover:bg-red-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Tak, usuń
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(false)}
                    className="h-9 px-3 text-xs font-medium rounded-xl bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Anuluj
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  disabled={isBulkDeleting}
                  className="h-9 px-4 text-xs font-semibold rounded-xl bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Usuń zaznaczone
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setBulkDeleteConfirm(false);
                }}
                className="h-9 px-3 text-xs font-medium rounded-xl bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
              >
                Odznacz
              </button>
            </div>
          </div>
        )}

        {/* Płatności — pogrupowane per dziecko + wyjazd:
            mobile = karty, desktop = tabela */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
          {/* Mobile: karty — każda płatność jako osobny kafelek z obrysem,
              żeby pozycje w grupie nie zlewały się wizualnie */}
          <div className="md:hidden">
            {displayedRows.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">{emptyMessage}</p>
            ) : (
              groups.map((group) => (
                <Fragment key={group.key}>
                  {renderGroupCard(group)}
                  {!collapsedGroups.has(group.key) && (
                    <div className="space-y-2 p-3">
                      {group.rows.map(({ row, flatIndex }) => renderRowCard(row, flatIndex))}
                    </div>
                  )}
                </Fragment>
              ))
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                    checked={
                      displayedRows.length > 0 &&
                      displayedRows.every((r) => selectedIds.has(r.id))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left py-2.5 pl-8 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Za co
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Kwota
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Zniżka
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Status
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Termin
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Notatka
                </th>
                <th className="text-left py-2.5 pl-3 pr-5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Opłacono?
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-16 text-center text-sm text-gray-400">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <GroupRows
                    key={group.key}
                    header={renderGroupHeader(group)}
                    collapsed={collapsedGroups.has(group.key)}
                    rows={group.rows.map(({ row, flatIndex }) => renderRow(row, flatIndex))}
                  />
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Paginacja */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs text-gray-400">
              Strona {page} z {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => pushParams({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageButtons.map((p) => (
                <button
                  key={p}
                  onClick={() => pushParams({ page: p })}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all',
                    page === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => pushParams({ page: Math.min(totalPages, page + 1) })}
                disabled={page >= totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Nagłówek grupy + (zwijane) wiersze płatności — osobny komponent, żeby
// React nie tracił kluczy fragmentów w tbody.
function GroupRows({
  header,
  collapsed,
  rows,
}: {
  header: React.ReactNode;
  collapsed: boolean;
  rows: React.ReactNode[];
}) {
  return (
    <>
      {header}
      {!collapsed && rows}
    </>
  );
}
