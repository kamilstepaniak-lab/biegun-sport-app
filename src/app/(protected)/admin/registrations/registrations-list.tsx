'use client';

import { useMemo, useState, useTransition } from 'react';
import { format, differenceInYears, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Check, Copy, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  listTripRegistrationRequests,
  type TripRegistrationRequestRow,
} from '@/lib/actions/trip-registration-requests';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

function statusBadge(status: TripRegistrationRequestRow['status']) {
  if (status === 'pending')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Oczekuje
      </span>
    );
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Zatwierdzone
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Odrzucone
    </span>
  );
}

function formatSubmittedAt(iso: string): string {
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return iso;
  }
}

export default function RegistrationsList({
  initialRows,
}: {
  initialRows: TripRegistrationRequestRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<TripRegistrationRequestRow | null>(null);
  const [reason, setReason] = useState('');

  const sections = useMemo(() => {
    const map = new Map<string, TripRegistrationRequestRow[]>();
    [...rows]
      .sort((a, b) => a.child_last_name.localeCompare(b.child_last_name, 'pl'))
      .forEach((r) => {
        const letter = r.child_last_name.charAt(0).toUpperCase() || '#';
        const bucket = map.get(letter) ?? [];
        bucket.push(r);
        map.set(letter, bucket);
      });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pl'));
  }, [rows]);

  function refresh(nextStatus: StatusFilter = status, nextSearch: string = search) {
    startTransition(async () => {
      const res = await listTripRegistrationRequests({ status: nextStatus, search: nextSearch });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows(res.data ?? []);
    });
  }

  async function copy(text: string, key: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Skopiowano');
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Nie udało się skopiować');
    }
  }

  function approve(row: TripRegistrationRequestRow) {
    const ok = confirm(
      `Zatwierdzić zgłoszenie: ${row.child_last_name} ${row.child_first_name}?\n\n` +
        `• Konto rodzica (${row.parent_email}) zostanie utworzone (magic link), jeśli jeszcze nie istnieje.\n` +
        `• Dziecko trafi do CRM jako „Bez kategorii".\n` +
        `• Zostanie zapisane na wyjazd: ${row.trip_title ?? row.trip_id}.\n` +
        `• Standardowy mail rejestracyjny wyjdzie automatycznie.`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await approveRegistrationRequest(row.id);
      if ('error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Zgłoszenie zatwierdzone');
      refresh();
    });
  }

  function submitReject() {
    if (!rejectFor) return;
    const id = rejectFor.id;
    const r = reason;
    startTransition(async () => {
      const res = await rejectRegistrationRequest(id, r || null);
      if ('error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Zgłoszenie odrzucone');
      setRejectFor(null);
      setReason('');
      refresh();
    });
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(value) => {
              const v = value as StatusFilter;
              setStatus(v);
              refresh(v, search);
            }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl bg-white sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Oczekujące</SelectItem>
              <SelectItem value="approved">Zatwierdzone</SelectItem>
              <SelectItem value="rejected">Odrzucone</SelectItem>
              <SelectItem value="all">Wszystkie</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Szukaj (imię, nazwisko, email)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => refresh()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') refresh();
            }}
            className="h-11 rounded-xl bg-white sm:w-80"
          />
          <span className="text-xs text-slate-500">
            {rows.length} {rows.length === 1 ? 'wpis' : 'wpisów'}
            {pending && ' • aktualizuję…'}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Brak zgłoszeń
              {status !== 'all' &&
                ` o statusie „${
                  status === 'pending' ? 'oczekuje' : status === 'approved' ? 'zatwierdzone' : 'odrzucone'
                }"`}
              .
            </p>
          </div>
        ) : (
          sections.map(([letter, sectionRows]) => (
            <div key={letter} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {letter}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  {sectionRows.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col />
                      <col />
                      <col className="w-32" />
                      <col className="w-20" />
                      <col />
                      <col className="w-36" />
                      <col />
                      <col className="w-32" />
                      <col className="w-32" />
                      <col className="w-44" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2.5">Nazwisko i imię</th>
                        <th className="px-3 py-2.5">Wyjazd</th>
                        <th className="px-3 py-2.5">Data urodzenia</th>
                        <th className="px-3 py-2.5">Wzrost</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Telefon</th>
                        <th className="px-3 py-2.5">Uwagi</th>
                        <th className="px-3 py-2.5">Zgłoszono</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sectionRows.map((r, idx) => {
                        const age = (() => {
                          try {
                            return differenceInYears(new Date(), parseISO(r.child_birth_date));
                          } catch {
                            return null;
                          }
                        })();
                        const emailKey = `e-${r.id}`;
                        const phoneKey = `p-${r.id}`;

                        return (
                          <tr
                            key={r.id}
                            className={cn(
                              'transition-colors hover:bg-slate-50/70',
                              idx % 2 === 1 && 'bg-slate-50/30',
                            )}
                          >
                            <td className="px-3 py-2.5">
                              <span className="text-sm font-semibold text-slate-900">
                                {r.child_last_name} {r.child_first_name}
                              </span>
                            </td>

                            <td className="px-3 py-2.5">
                              <span className="line-clamp-2 text-sm text-slate-600">
                                {r.trip_title ?? (
                                  <span className="font-mono text-xs text-slate-400">{r.trip_id}</span>
                                )}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap text-sm text-slate-600">
                              {(() => {
                                try {
                                  return format(parseISO(r.child_birth_date), 'dd.MM.yyyy');
                                } catch {
                                  return r.child_birth_date;
                                }
                              })()}
                              {age !== null && (
                                <span className="ml-1 text-xs text-slate-400">({age} l.)</span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-sm text-slate-600">
                              {r.child_height_cm ? `${r.child_height_cm} cm` : '—'}
                            </td>

                            <td className="px-3 py-2.5 max-w-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copy(r.parent_email, emailKey)}
                                    className="group flex w-full items-center gap-1 truncate text-left text-sm text-slate-600 hover:text-blue-600"
                                  >
                                    <span className="truncate">{r.parent_email || '—'}</span>
                                    {copiedKey === emailKey ? (
                                      <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                            </td>

                            <td className="px-3 py-2.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copy(r.parent_phone ?? '', phoneKey)}
                                    className="group flex items-center gap-1 whitespace-nowrap text-sm text-slate-600 hover:text-blue-600"
                                  >
                                    {r.parent_phone || '—'}
                                    {copiedKey === phoneKey ? (
                                      <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Kliknij aby skopiować</TooltipContent>
                              </Tooltip>
                            </td>

                            <td className="px-3 py-2.5">
                              <span className="line-clamp-2 text-sm text-slate-600">
                                {r.organizer_notes || '—'}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">
                              {formatSubmittedAt(r.submitted_at)}
                            </td>

                            <td className="px-3 py-2.5">{statusBadge(r.status)}</td>

                            <td className="px-3 py-2.5 text-right">
                              {r.status === 'pending' ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => approve(r)}
                                    disabled={pending}
                                    className="h-7 gap-1 bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700"
                                  >
                                    {pending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    Zatwierdź
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setRejectFor(r);
                                      setReason('');
                                    }}
                                    disabled={pending}
                                    className="h-7 gap-1 px-2.5 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                    Odrzuć
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  {r.rejection_reason ?? ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}

        <Dialog open={rejectFor !== null} onOpenChange={(o) => !o && setRejectFor(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Odrzuć zgłoszenie — {rejectFor?.child_last_name} {rejectFor?.child_first_name}
              </DialogTitle>
              <DialogDescription>
                Powód (opcjonalny, zapisywany tylko wewnętrznie — nie jest wysyłany rodzicowi).
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Np. duplikat, dziecko poza grupą wiekową…"
              rows={4}
              className="resize-none"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectFor(null)} disabled={pending}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={submitReject} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Odrzuć
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
