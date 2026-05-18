'use client';

import { useState } from 'react';
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
import { addPaymentTransaction } from '@/lib/actions/payments';

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

  const parsed = parseFloat(amount);
  const amountValid = !isNaN(parsed) && parsed > 0;
  // Checkbox „zniżka" ma sens tylko gdy wpłata nie pokrywa należności.
  const showDiscount = amountValid && parsed < amountRemaining;

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
        showDiscount ? closeAsDiscount : false,
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
          {showDiscount && (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="rp-discount"
                checked={closeAsDiscount}
                onCheckedChange={(c) => setCloseAsDiscount(!!c)}
              />
              <Label htmlFor="rp-discount" className="font-normal cursor-pointer text-sm">
                Zniżka — zamknij płatność jako opłaconą mimo niższej kwoty
                (kwota należna spadnie do {parsed.toFixed(0)} {currency})
              </Label>
            </div>
          )}
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
