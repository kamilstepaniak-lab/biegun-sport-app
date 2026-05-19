'use client';

import { useState, useMemo, useRef, useOptimistic, useTransition, useEffect } from 'react';
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
  Loader2,
  Trash2,
  AlertTriangle,
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
  type AdminPaymentsStatusFilter,
} from '@/lib/actions/payments';
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog';
import type { AdminPaymentRow, PaymentStatus } from '@/types';
import { formatPaymentDueDate } from '@/lib/payment-due';
import { cn } from '@/lib/utils';

// Próg tolerancji groszowej — saldo poniżej uznajemy za rozliczone.
const SALDO_EPSILON = 0.5;

type PageSize = 25 | 50 | 100;

interface PaymentsListProps {
  rows: AdminPaymentRow[];
  total: number;
  stats: { pending: number; paid: number; overdue: number; pendingPLN: number; pendingEUR: number };
  trips: { id: string; title: string }[];
  page: number;
  pageSize: number;
  search: string;
  tripId: string;
  status: AdminPaymentsStatusFilter;
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
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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

  // ── Filtry sterowane przez URL ────────────────────────────────────────────
  function pushParams(updates: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === 'all') next.delete(k);
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

  function getPaymentLabel(row: AdminPaymentRow): string {
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
        return { label: 'Do zapłaty', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' };
    }
  }

  const statusFilters: { key: AdminPaymentsStatusFilter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'pending', label: 'Do zapłaty' },
    { key: 'overdue', label: 'Po terminie' },
    { key: 'paid', label: 'Opłacone' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function renderRow(row: AdminPaymentRow, index: number) {
    const isPaid = row.status === 'paid';
    const isCancelled = row.status === 'cancelled';
    const isOverdue = row.status === 'overdue' || row.status === 'partially_paid_overdue';
    // effective_due_date z widoku uwzględnia regułę „X dni od potwierdzenia"
    // (confirmed_at + X dni), więc termin pokazuje się też gdy payments.due_date
    // jest puste.
    const dueDate = row.effective_due_date ? new Date(row.effective_due_date) : null;
    const isDueDateOverdue = dueDate ? dueDate < today : false;
    const { label: statusLabel, cls: statusCls } = getStatusBadge(row.status);
    const isSelected = selectedIds.has(row.id);

    return (
      <tr
        key={row.id}
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

        {/* Uczestnik + wyjazd */}
        <td className="py-3 pl-2 pr-3">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {row.participant_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{row.trip_title}</p>
        </td>

        {/* Za co */}
        <td className="py-3 px-3">
          <span className="text-sm text-gray-700 font-medium">{getPaymentLabel(row)}</span>
        </td>

        {/* Kwota */}
        <td className="py-3 px-3">
          {editingPayment === row.id ? (
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
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setEditingPayment(row.id);
                    setEditAmount(row.amount.toString());
                  }}
                  className="flex items-center gap-1 group"
                >
                  <span className="text-sm font-bold text-gray-900 tabular-nums group-hover:text-blue-600 transition-colors">
                    {row.amount.toFixed(0)} {row.currency}
                  </span>
                  <Edit2 className="h-3 w-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg">Kliknij aby edytować kwotę</TooltipContent>
            </Tooltip>
          )}
        </td>

        {/* Zniżka */}
        <td className="py-3 px-3">
          {(() => {
            const discount = row.original_amount - row.amount;
            if (discount > 0.5) {
              return (
                <div className="leading-tight">
                  <span className="text-sm font-semibold text-amber-600 tabular-nums">
                    −{discount.toFixed(0)} {row.currency}
                  </span>
                  <p className="text-[11px] text-gray-400 tabular-nums">
                    z {row.original_amount.toFixed(0)} {row.currency}
                  </p>
                </div>
              );
            }
            if (discount < -0.5) {
              return (
                <span className="text-sm font-semibold text-gray-500 tabular-nums">
                  +{Math.abs(discount).toFixed(0)} {row.currency}
                </span>
              );
            }
            return <span className="text-gray-300 text-sm">—</span>;
          })()}
        </td>

        {/* Status */}
        <td className="py-3 px-3">
          <div className="flex flex-col items-start gap-1">
            <span
              className={cn(
                'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full',
                statusCls
              )}
            >
              {statusLabel}
            </span>
            {(() => {
              if (row.status === 'cancelled') return null;
              const rem = row.amount_remaining ?? (row.amount - (row.amount_paid ?? 0));
              if (rem < -SALDO_EPSILON) {
                return (
                  <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    Nadpłata {Math.abs(rem).toFixed(0)} {row.currency}
                  </span>
                );
              }
              if (rem > SALDO_EPSILON && (row.status === 'partially_paid' || row.status === 'partially_paid_overdue')) {
                return (
                  <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    Do dopłaty {rem.toFixed(0)} {row.currency}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </td>

        {/* Termin */}
        <td className="py-3 px-3">
          {dueDate ? (
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm tabular-nums',
                  isDueDateOverdue && !isPaid ? 'text-red-600 font-semibold' : 'text-gray-500'
                )}
              >
                {format(dueDate, 'd.MM.yyyy', { locale: pl })}
              </span>
              {isDueDateOverdue && !isPaid && (
                <span className="text-[11px] font-semibold text-red-600">PO TERMINIE</span>
              )}
            </div>
          ) : (
            <span className="text-gray-500 text-sm">
              {formatPaymentDueDate(
                {
                  due_date: row.due_date,
                  due_days_from_confirmation: row.due_days_from_confirmation,
                },
                row.trip_departure_datetime,
              )}
            </span>
          )}
        </td>

        {/* Notatka */}
        <td className="py-3 px-3 max-w-[180px]">
          {editingNote === row.id ? (
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
          ) : (
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
          )}
        </td>

        {/* Opłacono? + Usuń */}
        <td className="py-3 pl-3 pr-5">
          <div className="flex gap-1.5 items-center">
            {!isCancelled && (
              <>
                <RecordPaymentDialog
                  paymentId={row.id}
                  currency={row.currency as 'PLN' | 'EUR'}
                  amountRemaining={row.amount_remaining ?? (row.amount - (row.amount_paid ?? 0))}
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
                  onClick={() => handleStatusChange(row.id, 'pending')}
                  disabled={isUpdating === row.id}
                >
                  <X className="h-3 w-3" />
                  Nie
                </button>
              </>
            )}
            {/* Usuń */}
            <div className="ml-1 pl-1.5 border-l border-gray-200 flex items-center gap-1">
              {deletingConfirm === row.id ? (
                <>
                  <span className="text-xs text-red-600 font-medium">Usuń?</span>
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
          </div>
        </td>
      </tr>
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
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 flex-shrink-0">
              <CircleDollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-xs text-gray-500">Nieopłacone</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5">
                {stats.pendingPLN > 0 && (
                  <span className="text-xs font-semibold text-orange-600">
                    {stats.pendingPLN.toFixed(0)} PLN
                  </span>
                )}
                {stats.pendingEUR > 0 && (
                  <span className="text-xs font-semibold text-orange-600">
                    {stats.pendingEUR.toFixed(0)} EUR
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
              <p className="text-xs text-gray-500">Po terminie</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-500">Opłacone</p>
            </div>
          </div>
        </div>

        {/* Filtry */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Szukaj */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Szukaj po nazwisku lub wyjeździe..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-11 pl-10 pr-8 rounded-xl bg-white ring-1 ring-gray-200 text-base md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 w-64 transition-all"
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
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <select
                value={tripId}
                onChange={(e) => pushParams({ trip: e.target.value })}
                className={cn(
                  'h-11 appearance-none pl-9 pr-8 rounded-xl text-base md:text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors max-w-[70vw] sm:max-w-[240px] truncate',
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
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all',
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

          <div className="flex flex-wrap gap-3 items-center">
            {/* Daty */}
            <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Od</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => pushParams({ from: e.target.value || null })}
                className="text-base md:text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
              />
              <span className="text-xs text-gray-300">—</span>
              <span className="text-xs text-gray-400">Do</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => pushParams({ to: e.target.value || null })}
                className="text-base md:text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
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

            <span className="text-xs text-gray-400">{total} łącznie</span>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-2xl ring-1 ring-blue-200">
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

        {/* Tabela płatności */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-x-auto">
          <table className="w-full">
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
                <th className="text-left py-2.5 pl-2 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Uczestnik
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
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
                  <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                    {search || tripId !== 'all' || status !== 'all' || dateFrom || dateTo
                      ? 'Brak płatności pasujących do filtrów'
                      : 'Brak płatności'}
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, index) => renderRow(row, index))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacja */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
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
