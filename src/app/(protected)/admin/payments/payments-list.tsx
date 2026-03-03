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

interface GroupedPayment {
  key: string;
  participantId: string;
  participantName: string;
  tripTitle: string;
  tripId: string;
  tripDepartureDate: string;
  payments: PaymentWithDetails[];
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

  // Grupuj płatności po uczestnik + wyjazd
  const groupedPayments = useMemo(() => {
    const groups = new Map<string, GroupedPayment>();
    payments.forEach((payment) => {
      if (!payment.registration) return;
      const participant = payment.registration.participant;
      const trip = payment.registration.trip;
      const key = `${participant.id}-${trip.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          participantId: participant.id,
          participantName: `${participant.last_name} ${participant.first_name}`,
          tripTitle: trip.title,
          tripId: trip.id,
          tripDepartureDate: trip.departure_datetime,
          payments: [],
        });
      }
      groups.get(key)!.payments.push(payment);
    });
    return Array.from(groups.values());
  }, [payments]);

  // Unikalne wyjazdy do filtra (posortowane chronologicznie)
  const availableTrips = useMemo(() => {
    const trips = new Map<string, { title: string; departure: string }>();
    groupedPayments.forEach((g) => {
      if (!trips.has(g.tripId)) {
        trips.set(g.tripId, { title: g.tripTitle, departure: g.tripDepartureDate });
      }
    });
    return Array.from(trips.entries())
      .map(([id, { title, departure }]) => ({ id, title, departure }))
      .sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
  }, [groupedPayments]);

  // Filtruj i sortuj
  const filteredGroups = useMemo(() => {
    let result = groupedPayments;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) =>
        g.participantName.toLowerCase().includes(q) ||
        g.tripTitle.toLowerCase().includes(q)
      );
    }

    if (tripFilter !== 'all') {
      result = result.filter((g) => g.tripId === tripFilter);
    }

    if (statusFilter === 'pending') {
      result = result.filter((g) =>
        g.payments.some((p) => p.status === 'pending' || p.status === 'partially_paid')
      );
    } else if (statusFilter === 'overdue') {
      result = result.filter((g) =>
        g.payments.some((p) => p.status === 'overdue' || p.status === 'partially_paid_overdue')
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((g) => g.payments.some((p) => new Date(p.created_at) >= from));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((g) => g.payments.some((p) => new Date(p.created_at) <= to));
    }

    result.sort((a, b) => a.participantName.localeCompare(b.participantName, 'pl'));
    return result;
  }, [groupedPayments, searchQuery, tripFilter, statusFilter, dateFrom, dateTo]);

  // Rozdziel na aktywne i w pełni opłacone
  const activeGroups = useMemo(
    () => filteredGroups.filter((g) => !g.payments.every((p) => p.status === 'paid' || p.status === 'cancelled')),
    [filteredGroups]
  );
  const paidGroups = useMemo(
    () => filteredGroups.filter((g) => g.payments.every((p) => p.status === 'paid' || p.status === 'cancelled')),
    [filteredGroups]
  );

  const displayedActive = useMemo(() => {
    if (pageLimit === 'all') return activeGroups;
    return activeGroups.slice(0, pageLimit);
  }, [activeGroups, pageLimit]);

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

  function startEditAmount(payment: PaymentWithDetails) {
    setEditingPayment(payment.id);
    setEditAmount(payment.amount.toString());
  }

  async function saveAmount(paymentId: string) {
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Podaj poprawną kwotę');
      return;
    }
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentAmount(paymentId, newAmount);
      if (result.error) toast.error(result.error);
      else { toast.success('Kwota zaktualizowana'); setEditingPayment(null); }
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
      else { toast.success('Notatka zapisana'); setEditingNote(null); }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }

  function getPaymentLabel(payment: PaymentWithDetails): string {
    if (payment.payment_type === 'installment') return `Rata ${payment.installment_number}`;
    if (payment.payment_type === 'season_pass') return 'Karnet';
    if (payment.payment_type === 'full') return 'Pełna opłata';
    return payment.payment_type;
  }

  function getStatusBadge(status: string) {
    if (status === 'paid') return { label: 'Opłacone', cls: 'bg-green-50 text-green-700' };
    if (status === 'overdue') return { label: 'Po terminie', cls: 'bg-red-50 text-red-700' };
    if (status === 'partially_paid_overdue') return { label: 'Po term. (częśc.)', cls: 'bg-red-50 text-red-700' };
    if (status === 'partially_paid') return { label: 'Częściowo', cls: 'bg-amber-50 text-amber-700' };
    if (status === 'cancelled') return { label: 'Anulowane', cls: 'bg-gray-100 text-gray-400' };
    return { label: 'Nieopłacone', cls: 'bg-orange-50 text-orange-700' };
  }

  // Stats (liczymy indywidualne płatności)
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

  function renderGroup(group: GroupedPayment, dimmed = false) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div
        key={group.key}
        className={cn(
          'border border-gray-100 rounded-2xl overflow-hidden bg-white',
          dimmed && 'opacity-60'
        )}
      >
        {/* Nagłówek grupy */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-700 select-none">
              {group.participantName.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-gray-900 truncate">{group.participantName}</span>
            <span className="text-gray-300 flex-shrink-0">·</span>
            <span className="text-sm text-gray-500 truncate">{group.tripTitle}</span>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
            {format(new Date(group.tripDepartureDate), 'd MMM yyyy', { locale: pl })}
          </span>
        </div>

        {/* Wiersze płatności */}
        <div className="divide-y divide-gray-50">
          {group.payments.map((payment) => {
            const isPaid = payment.status === 'paid';
            const isCancelled = payment.status === 'cancelled';
            const isOverdue =
              payment.status === 'overdue' || payment.status === 'partially_paid_overdue';
            const dueDate = payment.due_date ? new Date(payment.due_date) : null;
            const isDueDateOverdue = dueDate ? dueDate < today : false;
            const { label: statusLabel, cls: statusCls } = getStatusBadge(payment.status);

            return (
              <div
                key={payment.id}
                className={cn(
                  'flex items-center gap-4 px-4 py-2.5 flex-wrap md:flex-nowrap',
                  isPaid && 'bg-green-50/20',
                  isOverdue && 'bg-red-50/20',
                  isCancelled && 'opacity-40'
                )}
              >
                {/* Typ */}
                <div className="w-20 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-700">
                    {getPaymentLabel(payment)}
                  </span>
                </div>

                {/* Termin */}
                <div className="w-24 flex-shrink-0">
                  {dueDate ? (
                    <span className={cn(
                      'text-xs',
                      isDueDateOverdue && !isPaid ? 'text-red-600 font-semibold' : 'text-gray-400'
                    )}>
                      {format(dueDate, 'd.MM.yyyy', { locale: pl })}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </div>

                {/* Kwota */}
                <div className="w-28 flex-shrink-0">
                  {editingPayment === payment.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="h-6 w-20 text-xs rounded-lg"
                        min="0"
                        step="0.01"
                        onKeyDown={(e) => { if (e.key === 'Enter') saveAmount(payment.id); if (e.key === 'Escape') setEditingPayment(null); }}
                        autoFocus
                      />
                      <span className="text-xs text-gray-400">{payment.currency}</span>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100"
                        onClick={() => saveAmount(payment.id)}
                        disabled={isUpdating === payment.id}
                      >
                        <Save className="h-3 w-3 text-gray-500" />
                      </button>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100"
                        onClick={() => setEditingPayment(null)}
                      >
                        <X className="h-3 w-3 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => startEditAmount(payment)}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-0.5 group transition-colors"
                        >
                          {payment.amount} {payment.currency}
                          <Edit2 className="h-3 w-3 text-gray-300 group-hover:text-blue-500 ml-0.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-lg">Kliknij aby edytować kwotę</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusCls)}>
                    {statusLabel}
                  </span>
                </div>

                {/* Notatka */}
                <div className="flex-1 min-w-0">
                  {editingNote === payment.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="h-6 text-xs rounded-lg flex-1"
                        placeholder="Wpisz notatkę..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNote(payment.id);
                          if (e.key === 'Escape') setEditingNote(null);
                        }}
                        autoFocus
                      />
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100"
                        onClick={() => saveNote(payment.id)}
                        disabled={isUpdating === payment.id}
                      >
                        <Save className="h-3 w-3 text-gray-500" />
                      </button>
                      <button
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100"
                        onClick={() => setEditingNote(null)}
                      >
                        <X className="h-3 w-3 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingNote(payment.id); setEditNote(payment.admin_notes || ''); }}
                      className="flex items-center gap-1 text-xs group w-full text-left"
                    >
                      <MessageSquare className={cn(
                        'h-3 w-3 flex-shrink-0',
                        payment.admin_notes ? 'text-amber-500' : 'text-gray-300 group-hover:text-gray-400'
                      )} />
                      {payment.admin_notes ? (
                        <span className="text-amber-700 truncate group-hover:text-amber-900">{payment.admin_notes}</span>
                      ) : (
                        <span className="text-gray-300 group-hover:text-gray-400">Dodaj notatkę</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Przyciski Tak / Nie */}
                {!isCancelled && (
                  <div className="flex gap-1.5 flex-shrink-0 ml-auto">
                    <button
                      className={cn(
                        'h-7 px-3 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all',
                        isPaid
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                          : 'bg-green-50 text-green-700 ring-1 ring-green-200 hover:bg-green-100'
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
                )}
              </div>
            );
          })}
        </div>
      </div>
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
              <p className="text-xs text-gray-500">Wszystkie</p>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-500">Opłacone</p>
            </div>
          </div>
        </div>

        {/* Filtry */}
        <div className="flex flex-col gap-3">
          {/* Wiersz 1: search + trip + status */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Szukaj po nazwisku */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Szukaj po nazwisku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-8 rounded-xl bg-white ring-1 ring-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 w-52 transition-all"
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtr po wyjeździe */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className={cn(
                  'h-10 appearance-none pl-9 pr-8 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors',
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
              <ChevronDown className={cn(
                'absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none',
                tripFilter !== 'all' ? 'text-blue-200' : 'text-gray-400'
              )} />
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

          {/* Wiersz 2: daty + limit + info */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Od</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
              />
              <span className="text-xs text-gray-300">—</span>
              <span className="text-xs text-gray-400">Do</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-gray-200 px-3 py-2">
              <ListFilter className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">Pokaż</span>
              <div className="flex gap-1">
                {([25, 50, 100, 200, 'all'] as PageLimit[]).map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setPageLimit(limit)}
                    className={cn(
                      'px-2 py-0.5 rounded-lg text-xs font-medium transition-all',
                      pageLimit === limit ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {limit === 'all' ? 'Wszystkie' : limit}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {displayedActive.length} z {activeGroups.length} aktywnych
              {paidGroups.length > 0 && ` · ${paidGroups.length} opłaconych`}
            </span>
          </div>
        </div>

        {/* Lista aktywnych płatności */}
        <div className="space-y-2">
          {/* Nagłówek kolumn */}
          {displayedActive.length > 0 && (
            <div className="hidden md:flex items-center gap-4 px-4 py-1.5">
              <div className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Typ</div>
              <div className="w-24 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Termin</div>
              <div className="w-28 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Kwota</div>
              <div className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</div>
              <div className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notatka</div>
              <div className="w-24 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right ml-auto">Opłacono?</div>
            </div>
          )}

          {displayedActive.length === 0 ? (
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-12 text-center text-sm text-gray-400">
              {searchQuery || tripFilter !== 'all' || dateFrom || dateTo
                ? 'Brak płatności pasujących do filtrów'
                : 'Brak aktywnych płatności'}
            </div>
          ) : (
            displayedActive.map((group) => renderGroup(group))
          )}
        </div>

        {/* Sekcja opłaconych — zwijana */}
        {paidGroups.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setPaidExpanded(!paidExpanded)}
              className="flex items-center gap-2 w-full px-4 py-3 bg-green-50 rounded-2xl ring-1 ring-green-100 hover:bg-green-100/80 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-green-800">
                Opłacone ({paidGroups.length})
              </span>
              {paidExpanded ? (
                <ChevronUp className="h-4 w-4 text-green-600 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 text-green-600 ml-auto" />
              )}
            </button>
            {paidExpanded && (
              <div className="space-y-2">
                {paidGroups.map((group) => renderGroup(group, true))}
              </div>
            )}
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}
