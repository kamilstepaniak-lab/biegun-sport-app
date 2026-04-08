'use client';

import { useState, useMemo, useRef, useOptimistic, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Trash2,
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

import { updatePaymentStatus, updatePaymentAmount, updatePaymentNote, bulkUpdatePaymentStatus, deletePayment, bulkDeletePayments } from '@/lib/actions/payments';
import type { PaymentWithDetails, PaymentStatus } from '@/types';
import { cn } from '@/lib/utils';

interface PaymentsListProps {
  payments: PaymentWithDetails[];
}

type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';
type PageSize = 25 | 50 | 100;

interface FlatRow {
  payment: PaymentWithDetails;
  participantName: string;
  tripTitle: string;
  tripId: string;
  tripDepartureDate: string;
}

export function PaymentsList({ payments }: PaymentsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tripFilter, setTripFilter] = useState('all');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
  const [isPending, startTransition] = useTransition();

  // Optimistic status — natychmiastowa zmiana UI przed odpowiedzią serwera
  const [optimisticPayments, setOptimisticPayments] = useOptimistic(
    payments,
    (current: PaymentWithDetails[], update: { id: string; status: PaymentStatus; amount_paid: number }) =>
      current.map((p) =>
        p.id === update.id
          ? { ...p, status: update.status, amount_paid: update.amount_paid, paid_at: update.status === 'paid' ? new Date().toISOString() : null }
          : p
      )
  );

  // Spłaszcz do płaskiej listy wierszy (używa optimistic state)
  const flatRows = useMemo<FlatRow[]>(() => {
    return optimisticPayments
      .filter((p) => p.registration && !deletedIds.has(p.id))
      .map((p) => ({
        payment: p,
        participantName: `${p.registration.participant.last_name} ${p.registration.participant.first_name}`,
        tripTitle: p.registration.trip.title,
        tripId: p.registration.trip.id,
        tripDepartureDate: p.registration.trip.departure_datetime,
      }));
  }, [optimisticPayments, deletedIds]);

  // Unikalne wyjazdy do filtra
  const availableTrips = useMemo(() => {
    const trips = new Map<string, { title: string; departure: string }>();
    flatRows.forEach((r) => {
      if (!trips.has(r.tripId)) {
        trips.set(r.tripId, { title: r.tripTitle, departure: r.tripDepartureDate });
      }
    });
    return Array.from(trips.entries())
      .map(([id, { title, departure }]) => ({ id, title, departure }))
      .sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
  }, [flatRows]);

  // Filtruj
  const filteredRows = useMemo(() => {
    let result = flatRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.participantName.toLowerCase().includes(q) ||
          r.tripTitle.toLowerCase().includes(q)
      );
    }

    if (tripFilter !== 'all') {
      result = result.filter((r) => r.tripId === tripFilter);
    }

    const todayFilter = new Date();
    todayFilter.setHours(0, 0, 0, 0);

    if (statusFilter === 'pending') {
      result = result.filter(
        (r) => r.payment.status === 'pending' || r.payment.status === 'partially_paid'
      );
    } else if (statusFilter === 'overdue') {
      result = result.filter(
        (r) =>
          r.payment.status === 'overdue' ||
          r.payment.status === 'partially_paid_overdue' ||
          (r.payment.due_date &&
            new Date(r.payment.due_date) < todayFilter &&
            r.payment.status !== 'paid' &&
            r.payment.status !== 'cancelled')
      );
    } else if (statusFilter === 'paid') {
      result = result.filter((r) => r.payment.status === 'paid');
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((r) => new Date(r.payment.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.payment.created_at) <= to);
    }

    result.sort((a, b) => new Date(b.payment.created_at).getTime() - new Date(a.payment.created_at).getTime());
    return result;
  }, [flatRows, searchQuery, tripFilter, statusFilter, dateFrom, dateTo]);

  const allRows = useMemo(
    () => filteredRows.filter((r) => r.payment.status !== 'cancelled'),
    [filteredRows]
  );

  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const displayedRows = useMemo(() => {
    return allRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [allRows, safePage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tripFilter, statusFilter, dateFrom, dateTo, pageSize]);

  // Handlers
  async function handleStatusChange(paymentId: string, newStatus: 'pending' | 'paid') {
    // Jeśli kliknięty wiersz jest zaznaczony → zastosuj do wszystkich zaznaczonych
    if (selectedIds.has(paymentId) && selectedIds.size > 1) {
      await handleBulkAction(newStatus);
      return;
    }

    // Znajdź aktualną płatność żeby znać kwotę do optimistic update
    const currentPayment = payments.find((p) => p.id === paymentId);
    const optimisticAmountPaid = newStatus === 'paid' ? (currentPayment?.amount ?? 0) : 0;

    startTransition(async () => {
      // Natychmiastowa zmiana UI
      setOptimisticPayments({ id: paymentId, status: newStatus, amount_paid: optimisticAmountPaid });

      try {
        const result = await updatePaymentStatus(paymentId, newStatus);
        if (result.error) {
          toast.error(result.error);
          router.refresh(); // Przywróć stan z serwera
        } else {
          toast.success(newStatus === 'paid' ? 'Oznaczono jako opłacone' : 'Oznaczono jako nieopłacone');
          router.refresh();
        }
      } catch {
        toast.error('Wystąpił błąd');
        router.refresh();
      }
    });
  }

  async function saveAmount(paymentId: string) {
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) { toast.error('Podaj poprawną kwotę'); return; }
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentAmount(paymentId, newAmount);
      if (result.error) toast.error(result.error);
      else { toast.success('Kwota zaktualizowana'); setEditingPayment(null); router.refresh(); }
    } catch { toast.error('Wystąpił błąd'); }
    finally { setIsUpdating(null); }
  }

  async function saveNote(paymentId: string) {
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentNote(paymentId, editNote);
      if (result.error) toast.error(result.error);
      else { toast.success('Notatka zapisana'); setEditingNote(null); router.refresh(); }
    } catch { toast.error('Wystąpił błąd'); }
    finally { setIsUpdating(null); }
  }

  async function handleBulkAction(status: 'paid' | 'pending') {
    if (!selectedIds.size) return;
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdatePaymentStatus(Array.from(selectedIds), status);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          status === 'paid'
            ? `Oznaczono ${selectedIds.size} płatności jako opłacone`
            : `Oznaczono ${selectedIds.size} płatności jako nieopłacone`
        );
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch { toast.error('Wystąpił błąd'); }
    finally { setIsBulkUpdating(false); }
  }

  async function handleDelete(paymentId: string) {
    setDeletedIds((prev) => new Set(prev).add(paymentId));
    setDeletingConfirm(null);
    try {
      const result = await deletePayment(paymentId);
      if (result.error) {
        setDeletedIds((prev) => { const next = new Set(prev); next.delete(paymentId); return next; });
        toast.error(result.error);
      } else {
        toast.success('Płatność usunięta');
        router.refresh();
      }
    } catch {
      setDeletedIds((prev) => { const next = new Set(prev); next.delete(paymentId); return next; });
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
        setDeletedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
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
          const rowId = displayedRows[i]?.payment.id;
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
    const allIds = displayedRows.map((r) => r.payment.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function getPaymentLabel(payment: PaymentWithDetails): string {
    if (payment.payment_type === 'installment') return `Rata ${payment.installment_number}`;
    if (payment.payment_type === 'season_pass') return 'Karnet';
    if (payment.payment_type === 'full') return 'Pełna opłata';
    return payment.payment_type;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'paid': return { label: 'Opłacone', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
      case 'overdue': return { label: 'Po terminie', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
      case 'partially_paid_overdue': return { label: 'Po term. (częśc.)', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
      case 'partially_paid': return { label: 'Częściowo', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
      case 'cancelled': return { label: 'Anulowane', cls: 'bg-gray-100 text-gray-400' };
      default: return { label: 'Do zapłaty', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' };
    }
  }

  const pendingPayments = optimisticPayments.filter((p) => p.status !== 'paid' && p.status !== 'cancelled');
  const stats = {
    total: optimisticPayments.length,
    pending: pendingPayments.length,
    paid: optimisticPayments.filter((p) => p.status === 'paid').length,
    pendingPLN: pendingPayments.filter((p) => p.currency === 'PLN').reduce((s, p) => s + (p.amount - (p.amount_paid ?? 0)), 0),
    pendingEUR: pendingPayments.filter((p) => p.currency === 'EUR').reduce((s, p) => s + (p.amount - (p.amount_paid ?? 0)), 0),
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'pending', label: 'Do zapłaty' },
    { key: 'overdue', label: 'Po terminie' },
    { key: 'paid', label: 'Opłacone' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function renderRow(row: FlatRow, index: number) {
    const { payment, participantName, tripTitle } = row;
    const isPaid = payment.status === 'paid';
    const isCancelled = payment.status === 'cancelled';
    const isOverdue = payment.status === 'overdue' || payment.status === 'partially_paid_overdue';
    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    const isDueDateOverdue = dueDate ? dueDate < today : false;
    const { label: statusLabel, cls: statusCls } = getStatusBadge(payment.status);

    const isSelected = selectedIds.has(payment.id);

    return (
      <tr
        key={payment.id}
        className={cn(
          'border-b border-gray-100 transition-colors',
          isPaid ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : isOverdue ? 'bg-red-50/10 hover:bg-red-50/20' : 'hover:bg-gray-50/60',
          isSelected && 'ring-inset ring-1 ring-blue-300 bg-blue-50/40',
        )}
      >
        {/* Checkbox */}
        <td className="py-3 pl-4 pr-2 w-8">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => toggleSelect(payment.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
            className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
          />
        </td>

        {/* Uczestnik + wyjazd */}
        <td className="py-3 pl-2 pr-3">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{participantName}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{tripTitle}</p>
        </td>

        {/* Za co */}
        <td className="py-3 px-3">
          <span className="text-sm text-gray-700 font-medium">{getPaymentLabel(payment)}</span>
        </td>

        {/* Kwota */}
        <td className="py-3 px-3">
          {editingPayment === payment.id ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveAmount(payment.id);
                  if (e.key === 'Escape') setEditingPayment(null);
                }}
                className="h-7 w-20 text-xs rounded-lg"
                min="0"
                step="0.01"
                autoFocus
              />
              <span className="text-xs text-gray-400">{payment.currency}</span>
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100" onClick={() => saveAmount(payment.id)} disabled={isUpdating === payment.id}>
                <Save className="h-3 w-3 text-gray-500" />
              </button>
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100" onClick={() => setEditingPayment(null)}>
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setEditingPayment(payment.id); setEditAmount(payment.amount.toString()); }}
                  className="flex items-center gap-1 group"
                >
                  <span className="text-sm font-bold text-gray-900 tabular-nums group-hover:text-blue-600 transition-colors">
                    {payment.amount.toFixed(0)} {payment.currency}
                  </span>
                  <Edit2 className="h-3 w-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg">Kliknij aby edytować kwotę</TooltipContent>
            </Tooltip>
          )}
        </td>

        {/* Status */}
        <td className="py-3 px-3">
          <span className={cn('inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full', statusCls)}>
            {statusLabel}
          </span>
        </td>

        {/* Termin */}
        <td className="py-3 px-3">
          {dueDate ? (
            <span className={cn(
              'text-sm tabular-nums',
              isDueDateOverdue && !isPaid ? 'text-red-600 font-semibold' : 'text-gray-500'
            )}>
              {format(dueDate, 'd.MM.yyyy', { locale: pl })}
            </span>
          ) : (
            <span className="text-gray-300 text-sm">—</span>
          )}
        </td>

        {/* Notatka */}
        <td className="py-3 px-3 max-w-[180px]">
          {editingNote === payment.id ? (
            <div className="flex items-center gap-1">
              <Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="h-7 text-xs rounded-lg w-36"
                placeholder="Notatka..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNote(payment.id);
                  if (e.key === 'Escape') setEditingNote(null);
                }}
                autoFocus
              />
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100" onClick={() => saveNote(payment.id)} disabled={isUpdating === payment.id}>
                <Save className="h-3 w-3 text-gray-500" />
              </button>
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100" onClick={() => setEditingNote(null)}>
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingNote(payment.id); setEditNote(payment.admin_notes || ''); }}
              className="flex items-center gap-1.5 text-xs group w-full text-left"
            >
              <MessageSquare className={cn(
                'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                payment.admin_notes ? 'text-amber-500' : 'text-gray-300 group-hover:text-gray-400'
              )} />
              {payment.admin_notes ? (
                <span className="text-amber-700 truncate group-hover:text-amber-900">{payment.admin_notes}</span>
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
                <button
                  className={cn(
                    'h-7 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
                    isPaid
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                  )}
                  onClick={() => handleStatusChange(payment.id, 'paid')}
                  disabled={isUpdating === payment.id}
                >
                  <Check className="h-3 w-3" />
                  Tak
                </button>
                <button
                  className={cn(
                    'h-7 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
                    !isPaid
                      ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                      : 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100'
                  )}
                  onClick={() => handleStatusChange(payment.id, 'pending')}
                  disabled={isUpdating === payment.id}
                >
                  <X className="h-3 w-3" />
                  Nie
                </button>
              </>
            )}
            {/* Usuń */}
            <div className="ml-1 pl-1.5 border-l border-gray-200 flex items-center gap-1">
              {deletingConfirm === payment.id ? (
                <>
                  <span className="text-xs text-red-600 font-medium">Usuń?</span>
                  <button
                    onClick={() => handleDelete(payment.id)}
                    className="h-6 px-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Tak
                  </button>
                  <button
                    onClick={() => setDeletingConfirm(null)}
                    className="h-6 px-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Nie
                  </button>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDeletingConfirm(payment.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
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

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 flex-shrink-0">
              <CircleDollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-xs text-gray-500">Nieopłacone</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5">
                {stats.pendingPLN > 0 && (
                  <span className="text-xs font-semibold text-red-600">{stats.pendingPLN.toFixed(0)} PLN</span>
                )}
                {stats.pendingEUR > 0 && (
                  <span className="text-xs font-semibold text-red-600">{stats.pendingEUR.toFixed(0)} EUR</span>
                )}
              </div>
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
                placeholder="Szukaj po nazwisku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-8 rounded-xl bg-white ring-1 ring-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 w-56 transition-all"
              />
              {searchQuery && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearchQuery('')}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtr wyjazdu */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className={cn(
                  'h-10 appearance-none pl-9 pr-8 rounded-xl text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
                  tripFilter !== 'all'
                    ? 'bg-blue-600 text-white ring-1 ring-blue-700'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                )}
              >
                <option value="all">Sortuj wg. wyjazdu</option>
                {availableTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none', tripFilter !== 'all' ? 'text-blue-200' : 'text-gray-400')} />
            </div>

            {/* Status tabs */}
            <div className="flex gap-2">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    statusFilter === f.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Daty */}
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Od</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer" />
              <span className="text-xs text-gray-300">—</span>
              <span className="text-xs text-gray-400">Do</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-gray-400 hover:text-gray-600 ml-1">
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
                    onClick={() => setPageSize(size)}
                    className={cn('px-2 py-0.5 rounded-lg text-xs font-medium transition-all', pageSize === size ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100')}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {allRows.length} łącznie
            </span>
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
                className="h-8 px-4 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Oznacz jako opłacone
              </button>
              <button
                onClick={() => handleBulkAction('pending')}
                disabled={isBulkUpdating}
                className="h-8 px-4 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Oznacz jako nieopłacone
              </button>
              {bulkDeleteConfirm ? (
                <>
                  <span className="text-xs text-red-700 font-semibold self-center">Usunąć {selectedIds.size} płatności?</span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="h-8 px-4 text-xs font-semibold rounded-xl bg-red-700 text-white hover:bg-red-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Tak, usuń
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(false)}
                    className="h-8 px-3 text-xs font-medium rounded-xl bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Anuluj
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  disabled={isBulkDeleting}
                  className="h-8 px-4 text-xs font-semibold rounded-xl bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Usuń zaznaczone
                </button>
              )}
              <button
                onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false); }}
                className="h-8 px-3 text-xs font-medium rounded-xl bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
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
                    checked={displayedRows.length > 0 && displayedRows.every((r) => selectedIds.has(r.payment.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left py-2.5 pl-2 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Uczestnik</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Za co</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Kwota</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Termin</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Notatka</th>
                <th className="text-left py-2.5 pl-3 pr-5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Opłacono?</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                    {searchQuery || tripFilter !== 'all' || dateFrom || dateTo
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
              Strona {safePage} z {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (safePage <= 4) {
                  page = i + 1;
                } else if (safePage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = safePage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all',
                      safePage === page ? 'bg-blue-600 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
