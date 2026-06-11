'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addPaymentTransaction, getPaymentTransactions } from '@/lib/actions/payments';
import type { PaymentTransaction } from '@/types';
import { cn } from '@/lib/utils';

interface RecordPaymentDialogProps {
  paymentId: string;
  currency: 'PLN' | 'EUR';
  amountRemaining: number; // amount - amount_paid (>0 = do zapłaty)
  onDone: () => void;
  children: React.ReactNode; // element wyzwalający (trigger)
}

export function RecordPaymentDialog({
  paymentId,
  currency,
  amountRemaining,
  onDone,
  children,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('transfer');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closeAsDiscount, setCloseAsDiscount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const parsed = parseFloat(amount);
  const amountValid = !isNaN(parsed) && parsed > 0;
  // Checkbox „zniżka" działa tylko gdy wpłata nie pokrywa należności,
  // ale wyświetlamy go zawsze (server-side i tak ignoruje gdy nie ma sensu).
  const discountApplicable = amountValid && parsed < amountRemaining;

  // Pobierz listę wcześniejszych wpłat dla tej płatności po otwarciu dialogu.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTx(true);
    getPaymentTransactions(paymentId)
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, paymentId]);

  const totalPaid = transactions.reduce((s, t) => s + (t.amount ?? 0), 0);

  async function handleSubmit() {
    if (!amountValid) {
      toast.error('Podaj poprawną kwotę wpłaty');
      return;
    }
    setSubmitting(true);
    try {
      const result = await addPaymentTransaction(
        paymentId,
        parsed,
        currency,
        date,
        method,
        undefined,
        discountApplicable ? closeAsDiscount : false,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wpłata zarejestrowana');
        setOpen(false);
        setAmount('');
        setCloseAsDiscount(false);
        onDone();
      }
    } catch {
      toast.error('Wystąpił błąd');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zarejestruj wpłatę</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Lista wcześniejszych wpłat — żeby admin widział co już zostało zarejestrowane */}
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Wpłaty zarejestrowane
              </span>
              {transactions.length > 0 && (
                <span className="text-xs font-semibold text-gray-700 tabular-nums">
                  Razem: {totalPaid.toFixed(0)} {currency}
                </span>
              )}
            </div>
            {loadingTx ? (
              <p className="text-xs text-gray-400">Ładowanie…</p>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-gray-400">Brak wpłat — to będzie pierwsza.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-gray-500 whitespace-nowrap">
                      {format(new Date(tx.transaction_date), 'd.MM.yyyy', { locale: pl })}
                    </span>
                    <span className="text-gray-500 text-[11px]">
                      {tx.payment_method === 'cash' ? 'Gotówka' : 'Przelew'}
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums ml-auto">
                      {tx.amount.toFixed(0)} {tx.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-amount">Kwota wpłaty ({currency})</Label>
            <Input
              id="rp-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="np. 322"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Metoda</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'cash' | 'transfer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Przelew</SelectItem>
                  <SelectItem value="cash">Gotówka</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-date">Data wpłaty</Label>
              <Input
                id="rp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Checkbox „zniżka" — zawsze widoczny. Aktywny tylko gdy wpłata < należność. */}
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border bg-slate-50 p-3',
              !discountApplicable && 'opacity-60',
            )}
          >
            <Checkbox
              id="rp-discount"
              checked={closeAsDiscount}
              disabled={!discountApplicable}
              onCheckedChange={(c) => setCloseAsDiscount(!!c)}
            />
            <Label htmlFor="rp-discount" className="font-normal cursor-pointer text-sm">
              Zniżka — zamknij płatność jako opłaconą mimo niższej kwoty
              {discountApplicable
                ? ` (kwota należna spadnie do ${parsed.toFixed(0)} ${currency})`
                : ' (dostępne gdy wpłata jest mniejsza od należności)'}
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !amountValid}>
              {submitting ? 'Zapisywanie...' : 'Zapisz wpłatę'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
