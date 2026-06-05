'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { Plus, Loader2, Search, X, Check } from 'lucide-react';
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
  const [childQuery, setChildQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'PLN' | 'EUR'>('PLN');
  const [dueDate, setDueDate] = useState('');
  const [parentVisible, setParentVisible] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const selectedParticipant = useMemo(
    () => participants.find((p) => p.id === participantId) ?? null,
    [participants, participantId],
  );

  const filteredParticipants = useMemo(() => {
    const q = childQuery.trim().toLowerCase();
    if (!q) return participants.slice(0, 8);
    return participants
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.parentName.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [participants, childQuery]);

  function selectParticipant(id: string) {
    setParticipantId(id);
    setPickerOpen(false);
    setChildQuery('');
  }

  function resetForm() {
    setParticipantId('');
    setChildQuery('');
    setPickerOpen(false);
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
            {selectedParticipant ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {selectedParticipant.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {selectedParticipant.parentName}
                    {selectedParticipant.groupName ? ` · ${selectedParticipant.groupName}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setParticipantId('')}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-600"
                  aria-label="Zmień dziecko"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={childQuery}
                  onChange={(e) => {
                    setChildQuery(e.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => {
                    blurTimeout.current = setTimeout(() => setPickerOpen(false), 120);
                  }}
                  placeholder="Wpisz nazwisko dziecka..."
                  className="h-11 rounded-xl pl-9"
                />
                {pickerOpen && filteredParticipants.length > 0 && (
                  <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-gray-200">
                    {filteredParticipants.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (blurTimeout.current) clearTimeout(blurTimeout.current);
                            selectParticipant(p.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-blue-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                            <p className="truncate text-xs text-gray-400">
                              {p.parentName}
                              {p.groupName ? ` · ${p.groupName}` : ''}
                            </p>
                          </div>
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-transparent" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pickerOpen && childQuery.trim() && filteredParticipants.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl bg-white p-3 text-sm text-gray-400 shadow-lg ring-1 ring-gray-200">
                    Brak dziecka pasującego do „{childQuery.trim()}”
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Za co (opis płatności)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Dopłata za koszulkę"
              className="h-11 rounded-xl"
            />
            <p className="mt-1 text-xs text-gray-400">
              Ten opis pojawi się w kolumnie „Za co” — u admina i u rodzica.
            </p>
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
