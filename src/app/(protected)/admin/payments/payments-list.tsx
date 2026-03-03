'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Check,
  Edit2,
  Save,
  CreditCard,
  CircleDollarSign,
  CheckCircle2,
  MessageSquare,
  CalendarDays,
  ListFilter,
  MapPin,
  ChevronDown,
  ChevronUp,
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

import { updatePaymentStatus, updatePaymentAmount, updatePaymentNote } from '@/lib/actions/payments';
import type { PaymentWithDetails } from '@/types';
import { cn } from '@/lib/utils';

interface PaymentsListProps {
  payments: PaymentWithDetails[];
}

type StatusFilter = 'all' | 'pending' | 'overdue';
type PageLimit = 25 | 50 | 100 | 200 | 'all';

interface FlatRow {
  payment: PaymentWithDetails;
  participantName: string;
  tripTitle: string;
  tripId: string;
  tripDepartureDate: string;
}

export function PaymentsList({ payments }: PaymentsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tripFilter, setTripFilter] = useState('all');
  const [pageLimit, setPageLimit] = useState<PageLimit>(50);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [paidExpanded, setPaidExpanded] = useState(false);

  // Spłaszcz do płaskiej listy wierszy
  const flatRows = useMemo<FlatRow[]>(() => {
    return payments
      .filter((p) => p.registration)
      .map((p) => ({
        payment: p,
        participantName: `${p.registration.participant.last_name} ${p.registration.participant.first_name}`,
        tripTitle: p.registration.trip.title,
        tripId: p.registration.trip.id,
        tripDepartureDate: p.registration.trip.departure_datetime,
      }));
  }, [payments]);

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

    if (statusFilter === 'pending') {
      result = result.filter(
        (r) => r.payment.status === 'pending' || r.payment.status === 'partially_paid'
      );
    } else if (statusFilter === 'overdue') {
      result = result.filter(
        (r) =>
          r.payment.status === 'overdue' || r.payment.status === 'partially_paid_overdue'
      );
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

    result.sort((a, b) => a.participantName.localeCompare(b.participantName, 'pl'));
    return result;
  }, [flatRows, searchQuery, tripFilter, statusFilter, dateFrom, dateTo]);

  // Rozdziel aktywne / opłacone
  const activeRows = useMemo(
    () => filteredRows.filter((r) => r.payment.status !== 'paid' && r.payment.status !== 'cancelled'),
    [filteredRows]
  );
  const paidRows = useMemo(
    () => filteredRows.filter((r) => r.payment.status === 'paid'),
    [filteredRows]
  );

  const displayedActive = useMemo(() => {
    if (pageLimit === 'all') return activeRows;
    return activeRows.slice(0, pageLimit);
  }, [activeRows, pageLimit]);

  // Handlers
  async function handleStatusChange(paymentId: string, newStatus: 'pending' | 'paid') {
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentStatus(paymentId, newStatus);
      if (result.error) toast.error(result.error);
      else toast.success(newStatus === 'paid' ? 'Oznaczono jako opłacone' : 'Oznaczono jako nieopłacone');
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }

  async function saveAmount(paymentId: string) {
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) { toast.error('Podaj poprawną kwotę'); return; }
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentAmount(paymentId, newAmount);
      if (result.error) toast.error(result.error);
      else { toast.success('Kwota zaktualizowana'); setEditingPayment(null); }
    } catch { toast.error('Wystąpił błąd'); }
    finally { setIsUpdating(null); }
  }

  async function saveNote(paymentId: string) {
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentNote(paymentId, editNote);
      if (result.error) toast.error(result.error);
      else { toast.success('Notatka zapisana'); setEditingNote(null); }
    } catch { toast.error('Wystąpił błąd'); }
    finally { setIsUpdating(null); }
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
      default: return { label: 'Nieopłacone', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' };
    }
  }

  const stats = {
    total: payments.length,
    pending: payments.filter((p) => p.status !== 'paid' && p.status !== 'cancelled').length,
    paid: payments.filter((p) => p.status === 'paid').length,
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'pending', label: 'Nieopłacone' },
    { key: 'overdue', label: 'Po terminie' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function renderRow(row: FlatRow, dimmed = false) {
    const { payment, participantName, tripTitle } = row;
    const isPaid = payment.status === 'paid';
    const isCancelled = payment.status === 'cancelled';
    const isOverdue = payment.status === 'overdue' || payment.status === 'partially_paid_overdue';
    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    const isDueDateOverdue = dueDate ? dueDate < today : false;
    const { label: statusLabel, cls: statusCls } = getStatusBadge(payment.status);

    return (
      <tr
        key={payment.id}
        className={cn(
          'border-b border-gray-100 transition-colors',
          isPaid ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : isOverdue ? 'bg-red-50/10 hover:bg-red-50/20' : 'hover:bg-gray-50/60',
          dimmed && 'opacity-50'
        )}
      >
        {/* Uczestnik + wyjazd */}
        <td className="py-3 pl-5 pr-3">
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

        {/* Opłacono? */}
        {!isCancelled && (
          <td className="py-3 pl-3 pr-5">
            <div className="flex gap-1.5">
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
            </div>
          </td>
        )}
        {isCancelled && <td className="py-3 pl-3 pr-5" />}
      </tr>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Wszystkie płatności</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <CircleDollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-xs text-gray-500">Nieopłacone</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
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
                <option value="all">Wszystkie wyjazdy</option>
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

            {/* Limit */}
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <ListFilter className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Pokaż</span>
              <div className="flex gap-1">
                {([25, 50, 100, 200, 'all'] as PageLimit[]).map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setPageLimit(limit)}
                    className={cn('px-2 py-0.5 rounded-lg text-xs font-medium transition-all', pageLimit === limit ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100')}
                  >
                    {limit === 'all' ? 'Wszystkie' : limit}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {displayedActive.length} z {activeRows.length} aktywnych
              {paidRows.length > 0 && ` · ${paidRows.length} opłaconych`}
            </span>
          </div>
        </div>

        {/* Tabela aktywnych */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left py-2.5 pl-5 pr-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Uczestnik</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Za co</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kwota</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Termin</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Notatka</th>
                <th className="text-left py-2.5 pl-3 pr-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Opłacono?</th>
              </tr>
            </thead>
            <tbody>
              {displayedActive.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-gray-400">
                    {searchQuery || tripFilter !== 'all' || dateFrom || dateTo
                      ? 'Brak płatności pasujących do filtrów'
                      : 'Brak aktywnych płatności'}
                  </td>
                </tr>
              ) : (
                displayedActive.map((row) => renderRow(row))
              )}
            </tbody>
          </table>
        </div>

        {/* Sekcja opłaconych */}
        {paidRows.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setPaidExpanded(!paidExpanded)}
              className="flex items-center gap-2 w-full px-4 py-3 bg-emerald-50 rounded-2xl ring-1 ring-emerald-100 hover:bg-emerald-100/80 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-800">Opłacone ({paidRows.length})</span>
              {paidExpanded
                ? <ChevronUp className="h-4 w-4 text-emerald-600 ml-auto" />
                : <ChevronDown className="h-4 w-4 text-emerald-600 ml-auto" />
              }
            </button>
            {paidExpanded && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {paidRows.map((row) => renderRow(row, true))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}
