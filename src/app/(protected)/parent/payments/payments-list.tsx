'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, Clock, AlertCircle, CreditCard, Copy, Banknote, User } from 'lucide-react';
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
  if (method === 'both') return { label: 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-700' };
  return null;
}

function PaymentRow({ payment }: { payment: ParentPayment }) {
  const status = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const remaining = payment.amount - payment.amount_paid;
  const isOverdue = payment.due_date && new Date(payment.due_date) < new Date() && payment.status !== 'paid';

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
      {/* Linia 1: Wyjazd | Typ + metoda | Termin | Status | Kwota */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center">
        {/* Wyjazd */}
        <div className="font-medium text-gray-900 text-sm truncate">
          {payment.trip_title}
        </div>

        {/* Typ płatności + metoda */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">{paymentTypeLabel}</span>
          {methodStyle && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodStyle.className}`}>
              {methodStyle.label}
            </span>
          )}
        </div>

        {/* Termin */}
        <div className="text-sm">
          {payment.due_date ? (
            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
              {format(new Date(payment.due_date), 'd.MM.yyyy', { locale: pl })}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        {/* Status */}
        <div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${status.bgClass}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>

        {/* Kwota */}
        <div className="text-right">
          {payment.status === 'paid' ? (
            <span className="text-sm font-semibold text-emerald-600">{payment.amount.toFixed(0)} {payment.currency}</span>
          ) : (
            <div>
              <span className="text-sm font-bold text-gray-900">{remaining.toFixed(0)} {payment.currency}</span>
              {payment.amount_paid > 0 && (
                <span className="text-xs text-gray-400 ml-1">
                  (wpł. {payment.amount_paid.toFixed(0)})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Linia 2: Tytuł przelewu (tylko dla nieopłaconych) */}
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

function BankAccountsSection({ bankAccounts }: { bankAccounts: BankAccountInfo }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
          <Banknote className="h-4 w-4 text-orange-600" />
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

// Grupowanie płatności wg dziecka
function PaymentsGroupedByChild({ payments }: { payments: ParentPayment[] }) {
  const grouped = useMemo(() => {
    const childMap = new Map<string, { name: string; payments: ParentPayment[] }>();

    const sorted = [...payments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    sorted.forEach(payment => {
      const key = payment.child_name;
      const existing = childMap.get(key);
      if (existing) {
        existing.payments.push(payment);
      } else {
        childMap.set(key, { name: payment.child_name, payments: [payment] });
      }
    });

    return Array.from(childMap.values());
  }, [payments]);

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Brak płatności"
        description="Nie ma płatności do wyświetlenia."
      />
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.name}>
          {/* Separator z imieniem dziecka */}
          <div className="flex items-center gap-4 mb-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {group.name}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Nagłówek kolumn - tylko desktop */}
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

export function ParentPaymentsList({ pendingPayments, paidPayments, bankAccounts }: ParentPaymentsListProps) {
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

  const pendingCount = pendingPayments.length;
  const paidCount = paidPayments.length;

  return (
    <div className="space-y-6">
      <BankAccountsSection bankAccounts={bankAccounts} />

      <div className="space-y-4">
        {/* Summary header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Wszystkie płatności</h2>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">
                {pendingCount} oczekujących
              </span>
            )}
            {paidCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                {paidCount} opłaconych
              </span>
            )}
          </div>
        </div>

        {allPayments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Brak płatności"
            description="Nie masz jeszcze żadnych płatności."
          />
        ) : (
          <PaymentsGroupedByChild payments={allPayments} />
        )}
      </div>
    </div>
  );
}
