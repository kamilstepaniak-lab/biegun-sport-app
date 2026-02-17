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
} from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { updatePaymentStatus, updatePaymentAmount } from '@/lib/actions/payments';
import type { PaymentWithDetails } from '@/types';

interface PaymentsListProps {
  payments: PaymentWithDetails[];
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue';

interface GroupedPayment {
  key: string;
  participantId: string;
  participantName: string;
  tripTitle: string;
  tripId: string;
  dueDate: string | null;
  payments: PaymentWithDetails[];
}

export function PaymentsList({ payments }: PaymentsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Grupuj płatności po uczestnik + wyjazd + data
  const groupedPayments = useMemo(() => {
    const groups = new Map<string, GroupedPayment>();

    payments.forEach((payment) => {
      if (!payment.registration) return;

      const participant = payment.registration.participant;
      const trip = payment.registration.trip;
      const dueDate = payment.due_date || 'no-date';

      const key = `${participant.id}-${trip.id}-${dueDate}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          participantId: participant.id,
          participantName: `${participant.last_name} ${participant.first_name}`,
          tripTitle: trip.title,
          tripId: trip.id,
          dueDate: payment.due_date,
          payments: [],
        });
      }

      groups.get(key)!.payments.push(payment);
    });

    return Array.from(groups.values());
  }, [payments]);

  // Filtruj i sortuj
  const filteredGroups = useMemo(() => {
    let result = groupedPayments;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((g) =>
        g.participantName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((g) => {
        if (statusFilter === 'overdue') {
          return g.payments.some((p) =>
            p.status === 'overdue' || p.status === 'partially_paid_overdue'
          );
        }
        return g.payments.some((p) => p.status === statusFilter);
      });
    }

    result.sort((a, b) => a.participantName.localeCompare(b.participantName, 'pl'));

    return result;
  }, [groupedPayments, searchQuery, statusFilter]);

  async function handleStatusChange(paymentId: string, newStatus: 'pending' | 'paid') {
    setIsUpdating(paymentId);
    try {
      const result = await updatePaymentStatus(paymentId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(newStatus === 'paid' ? 'Oznaczono jako opłacone' : 'Oznaczono jako nieopłacone');
      }
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
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Kwota zaktualizowana');
        setEditingPayment(null);
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setIsUpdating(null);
    }
  }

  function getPaymentLabel(payment: PaymentWithDetails): string {
    if (payment.payment_type === 'installment') {
      return `Rata ${payment.installment_number}`;
    }
    if (payment.payment_type === 'season_pass') {
      return 'Karnet';
    }
    if (payment.payment_type === 'full') {
      return 'Pełna opłata';
    }
    return payment.payment_type;
  }

  // Statystyki
  const stats = {
    total: payments.length,
    pending: payments.filter((p) => p.status === 'pending' || p.status === 'overdue' || p.status === 'partially_paid_overdue').length,
    paid: payments.filter((p) => p.status === 'paid').length,
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'pending', label: 'Nieopłacone' },
    { key: 'paid', label: 'Opłacone' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <CreditCard className="h-5 w-5 text-blue-600" />
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-500">Opłacone</p>
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Szukaj po nazwisku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
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

          <div className="flex gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  statusFilter === f.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payments list */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_2fr_auto] gap-4 px-5 py-3 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nazwisko, imię</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Wyjazd</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Za co / Kwota</div>
            <div className="w-36 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filteredGroups.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                {searchQuery ? 'Brak płatności pasujących do wyszukiwania' : 'Brak płatności'}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.key}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_2fr_auto] gap-2 md:gap-4 px-5 py-3.5 items-center hover:bg-gray-50/50 transition-colors"
                >
                  {/* Nazwisko, imię */}
                  <div className="font-medium text-gray-900 text-sm">
                    {group.participantName}
                  </div>

                  {/* Wyjazd */}
                  <div className="text-sm text-gray-500 truncate">
                    {group.tripTitle}
                  </div>

                  {/* Za co / Kwota */}
                  <div className="space-y-1">
                    {group.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {getPaymentLabel(payment)}:
                        </span>
                        {editingPayment === payment.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-6 w-20 text-xs rounded-lg"
                              min="0"
                              step="0.01"
                            />
                            <span className="text-xs text-gray-400">{payment.currency}</span>
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                              onClick={() => saveAmount(payment.id)}
                              disabled={isUpdating === payment.id}
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                              onClick={() => setEditingPayment(null)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => startEditAmount(payment)}
                                className="font-semibold text-sm text-gray-900 hover:text-blue-600 cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                {payment.amount} {payment.currency}
                                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="rounded-lg">Kliknij aby edytować kwotę</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Status buttons */}
                  <div className="space-y-1 w-36">
                    {group.payments.map((payment) => {
                      const isPaid = payment.status === 'paid';
                      return (
                        <div key={payment.id} className="flex gap-1">
                          <button
                            className={`h-7 flex-1 text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all ${
                              isPaid
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-white text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-50'
                            }`}
                            onClick={() => handleStatusChange(payment.id, 'paid')}
                            disabled={isUpdating === payment.id}
                          >
                            <Check className="h-3 w-3" />
                            Opłacone
                          </button>
                          <button
                            className={`h-7 flex-1 text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all ${
                              !isPaid
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50'
                            }`}
                            onClick={() => handleStatusChange(payment.id, 'pending')}
                            disabled={isUpdating === payment.id}
                          >
                            <X className="h-3 w-3" />
                            Nie
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
