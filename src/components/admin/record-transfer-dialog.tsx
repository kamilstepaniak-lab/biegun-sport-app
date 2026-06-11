'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Landmark, Loader2, Search, X, Check } from 'lucide-react';
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
import {
  getUnpaidPaymentsForParticipant,
  recordAllocatedTransfer,
  type UnpaidPaymentRow,
} from '@/lib/actions/payments';
import { cn } from '@/lib/utils';

interface RecordTransferDialogProps {
  participants: {
    id: string;
    name: string;
    parentName: string;
    groupName: string | null;
  }[];
}

/**
 * Księgowanie jednego przelewu od rodzica: wpisujesz kwotę z wyciągu,
 * a system proponuje rozbicie na najstarsze nieopłacone raty dziecka (FIFO).
 * Rozbicie można ręcznie skorygować przed zapisem.
 */
export function RecordTransferDialog({ participants }: RecordTransferDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [childQuery, setChildQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [unpaid, setUnpaid] = useState<UnpaidPaymentRow[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'PLN' | 'EUR'>('PLN');
  const [method, setMethod] = useState<'cash' | 'transfer'>('transfer');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  // paymentId → kwota przydzielona (string, bo edytowalna w inputach)
  const [allocations, setAllocations] = useState<Record<string, string>>({});
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

  // Raty w wybranej walucie — tylko między nimi rozbijamy przelew.
  const currencyRows = useMemo(
    () => unpaid.filter((u) => u.currency === currency),
    [unpaid, currency],
  );

  const parsedAmount = Number(amount.replace(',', '.'));
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const allocatedSum = useMemo(
    () =>
      currencyRows.reduce((s, row) => {
        const v = Number((allocations[row.id] ?? '').replace(',', '.'));
        return s + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0),
    [currencyRows, allocations],
  );

  const unallocated = amountValid ? parsedAmount - allocatedSum : 0;

  function selectParticipant(id: string) {
    setParticipantId(id);
    setPickerOpen(false);
    setChildQuery('');
    setAllocations({});
    setLoadingUnpaid(true);
    getUnpaidPaymentsForParticipant(id)
      .then((rows) => setUnpaid(rows))
      .finally(() => setLoadingUnpaid(false));
  }

  // FIFO: rozdziel kwotę przelewu po najstarszych terminach (lista przychodzi
  // posortowana po effective_due_date), do wysokości pozostałej kwoty raty.
  function autoAllocate(total: number, rows: UnpaidPaymentRow[]) {
    let left = total;
    const next: Record<string, string> = {};
    for (const row of rows) {
      if (left <= 0) break;
      const part = Math.min(left, row.remaining);
      if (part > 0) {
        next[row.id] = String(Math.round(part * 100) / 100);
        left = Math.round((left - part) * 100) / 100;
      }
    }
    setAllocations(next);
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      autoAllocate(parsed, currencyRows);
    } else {
      setAllocations({});
    }
  }

  function handleCurrencyChange(next: 'PLN' | 'EUR') {
    setCurrency(next);
    const rows = unpaid.filter((u) => u.currency === next);
    if (amountValid) autoAllocate(parsedAmount, rows);
    else setAllocations({});
  }

  function resetForm() {
    setParticipantId('');
    setChildQuery('');
    setPickerOpen(false);
    setUnpaid([]);
    setAmount('');
    setCurrency('PLN');
    setMethod('transfer');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setAllocations({});
  }

  function submit() {
    const entries = currencyRows
      .map((row) => ({
        paymentId: row.id,
        amount: Number((allocations[row.id] ?? '').replace(',', '.')),
      }))
      .filter((a) => Number.isFinite(a.amount) && a.amount > 0);

    if (entries.length === 0) {
      toast.error('Rozbij kwotę na przynajmniej jedną ratę');
      return;
    }

    startTransition(async () => {
      const result = await recordAllocatedTransfer({
        participantId,
        allocations: entries,
        currency,
        transactionDate: date,
        paymentMethod: method,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        entries.length === 1
          ? 'Wpłata zaksięgowana'
          : `Przelew rozksięgowany na ${entries.length} pozycje`,
      );
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">
          <Landmark className="h-4 w-4" />
          Zaksięguj przelew
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Zaksięguj przelew</DialogTitle>
          <DialogDescription>
            Wpisz kwotę z wyciągu — system rozbije ją na najstarsze nieopłacone
            raty dziecka. Rozbicie możesz skorygować.
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
                  onClick={() => {
                    setParticipantId('');
                    setUnpaid([]);
                    setAllocations({});
                  }}
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
                  placeholder="Wpisz nazwisko dziecka lub rodzica..."
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

          {participantId && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Kwota przelewu
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="np. 1500"
                    className="h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Waluta
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as 'PLN' | 'EUR')}
                    className="h-11 w-full rounded-xl bg-white px-3 text-base text-gray-800 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
                  >
                    <option value="PLN">PLN</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Data wpłaty
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Rozbicie na raty */}
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-gray-100">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Rozbicie na raty ({currency})
                </p>
                {loadingUnpaid ? (
                  <p className="py-2 text-sm text-gray-400">Ładowanie nieopłaconych rat…</p>
                ) : currencyRows.length === 0 ? (
                  <p className="py-2 text-sm text-gray-400">
                    Brak nieopłaconych płatności w {currency} dla tego dziecka.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {currencyRows.map((row) => (
                      <li key={row.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {row.label}
                            <span className="font-normal text-gray-400"> · {row.trip_title}</span>
                          </p>
                          <p className="text-xs text-gray-400 tabular-nums">
                            do zapłaty {row.remaining.toFixed(0)} {row.currency}
                            {row.effective_due_date
                              ? ` · termin ${format(new Date(row.effective_due_date), 'd.MM.yyyy', { locale: pl })}`
                              : ' · termin wg ustaleń'}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={allocations[row.id] ?? ''}
                          onChange={(e) =>
                            setAllocations((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          placeholder="0"
                          className="h-9 w-24 rounded-lg text-right tabular-nums"
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {amountValid && currencyRows.length > 0 && (
                  <div
                    className={cn(
                      'mt-3 rounded-lg px-3 py-2 text-xs font-semibold',
                      Math.abs(unallocated) < 0.01
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                    )}
                  >
                    {Math.abs(unallocated) < 0.01
                      ? `Cała kwota ${parsedAmount.toFixed(2)} ${currency} rozbita na raty`
                      : unallocated > 0
                        ? `Nierozbite: ${unallocated.toFixed(2)} ${currency} — popraw kwoty albo zaksięguj częściowo`
                        : `Rozbito o ${Math.abs(unallocated).toFixed(2)} ${currency} więcej niż kwota przelewu`}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Metoda
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as 'cash' | 'transfer')}
                    className="h-11 w-full rounded-xl bg-white px-3 text-base text-gray-800 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
                  >
                    <option value="transfer">Przelew</option>
                    <option value="cash">Gotówka</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Notatka
                  </label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="np. nr przelewu, dopisek z wyciągu"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </>
          )}

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
              className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={submit}
              disabled={pending || !participantId || allocatedSum <= 0}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Zaksięguj
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
