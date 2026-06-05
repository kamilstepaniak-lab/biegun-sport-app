'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createManualPayment } from '@/lib/actions/payments';

interface ManualPaymentDialogProps {
  participants: {
    id: string;
    name: string;
    parentName: string;
    groupName: string | null;
  }[];
}

export function ManualPaymentDialog({ participants }: ManualPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'PLN' | 'EUR'>('PLN');
  const [dueDate, setDueDate] = useState('');
  const [parentVisible, setParentVisible] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setParticipantId('');
    setTitle('');
    setAmount('');
    setCurrency('PLN');
    setDueDate('');
    setParentVisible(true);
    setAdminNotes('');
  }

  function submit() {
    const parsedAmount = Number(amount.replace(',', '.'));
    startTransition(async () => {
      const result = await createManualPayment({
        participantId,
        title,
        amount: parsedAmount,
        currency,
        dueDate: dueDate || null,
        parentVisible,
        adminNotes,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success('Dodano płatność');
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Dodaj płatność
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dodaj płatność ręczną</DialogTitle>
          <DialogDescription>
            Płatność będzie przypisana bezpośrednio do dziecka, bez wyjazdu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Dziecko
            </label>
            <select
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="h-11 w-full rounded-xl bg-white px-3 text-base text-gray-800 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
            >
              <option value="">Wybierz dziecko</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name} — {participant.parentName}
                  {participant.groupName ? `, ${participant.groupName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Tytuł płatności
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Dopłata za koszulkę"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Kwota
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Waluta
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'PLN' | 'EUR')}
                className="h-11 w-full rounded-xl bg-white px-3 text-base text-gray-800 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Termin
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-100">
            <input
              type="checkbox"
              checked={parentVisible}
              onChange={(e) => setParentVisible(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            Widoczna dla rodzica
          </label>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notatka admina
            </label>
            <Input
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Opcjonalnie"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              onClick={submit}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Dodaj
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
