'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  listTripRegistrationRequests,
  type TripRegistrationRequestRow,
} from '@/lib/actions/trip-registration-requests';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

function statusBadge(status: TripRegistrationRequestRow['status']) {
  if (status === 'pending')
    return <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">Oczekuje</span>;
  if (status === 'approved')
    return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Zatwierdzone</span>;
  return <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Odrzucone</span>;
}

function ageFromBirth(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
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
  const [rejectFor, setRejectFor] = useState<TripRegistrationRequestRow | null>(null);
  const [reason, setReason] = useState('');

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

  function approve(row: TripRegistrationRequestRow) {
    const ok = confirm(
      `Zatwierdzić zgłoszenie dziecka ${row.child_first_name} ${row.child_last_name}?\n\n` +
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value as StatusFilter;
            setStatus(v);
            refresh(v, search);
          }}
          className="rounded border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="pending">Oczekujące</option>
          <option value="approved">Zatwierdzone</option>
          <option value="rejected">Odrzucone</option>
          <option value="all">Wszystkie</option>
        </select>
        <input
          placeholder="Szukaj (imię, nazwisko, email)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={() => refresh()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') refresh();
          }}
          className="rounded border border-input bg-background px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {rows.length} wpisów{pending ? ' • aktualizuję…' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Dziecko</th>
              <th className="px-3 py-2">Data ur. (wiek)</th>
              <th className="px-3 py-2">Wzrost</th>
              <th className="px-3 py-2">Rodzic</th>
              <th className="px-3 py-2">Wyjazd</th>
              <th className="px-3 py-2">Zgłoszono</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {r.child_first_name} {r.child_last_name}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.child_birth_date}
                  <span className="ml-1 text-slate-500">({ageFromBirth(r.child_birth_date)} lat)</span>
                </td>
                <td className="px-3 py-2 text-xs">{r.child_height_cm ? `${r.child_height_cm} cm` : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  <div>{r.parent_email}</div>
                  <div className="text-slate-500">{r.parent_phone ?? ''}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.trip_title ?? r.trip_id}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {new Date(r.submitted_at).toLocaleString('pl-PL')}
                </td>
                <td className="px-3 py-2">{statusBadge(r.status)}</td>
                <td className="px-3 py-2 text-right">
                  {r.status === 'pending' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => approve(r)}
                        disabled={pending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        <span className="ml-1">Zatwierdź</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRejectFor(r);
                          setReason('');
                        }}
                        disabled={pending}
                      >
                        <X className="h-3 w-3" />
                        <span className="ml-1">Odrzuć</span>
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{r.rejection_reason ?? ''}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                  Brak zgłoszeń{status !== 'all' ? ` o statusie „${status === 'pending' ? 'oczekuje' : status === 'approved' ? 'zatwierdzone' : 'odrzucone'}"` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-4 shadow-xl">
            <h2 className="text-sm font-semibold">
              Odrzuć zgłoszenie: {rejectFor.child_first_name} {rejectFor.child_last_name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Powód (opcjonalny, zapisywany tylko wewnętrznie, nie jest wysyłany rodzicowi).
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 h-24 w-full rounded border border-input bg-background p-2 text-sm"
              placeholder="Np. duplikat, dziecko poza grupą wiekową…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectFor(null)} disabled={pending}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={submitReject} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Odrzuć'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
