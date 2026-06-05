'use client';

import { useMemo, useState } from 'react';
import { Activity, Download, Search } from 'lucide-react';

type ActivityLog = {
  id: string;
  created_at: string;
  user_email: string | null;
  action_type: string;
  details: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  contract_accepted:        { label: 'Akceptacja umowy',     color: 'bg-emerald-100 text-emerald-800' },
  profile_updated:          { label: 'Zmiana profilu',       color: 'bg-blue-100 text-blue-800' },
  registration_created:     { label: 'Zapis na wyjazd',      color: 'bg-blue-100 text-blue-800' },
  registration_cancelled:   { label: 'Anulowanie zapisu',    color: 'bg-red-100 text-red-800' },
  trip_email_sent:          { label: 'Wysłanie maili',       color: 'bg-amber-100 text-amber-800' },
  payment_deleted:          { label: 'Usunięcie płatności',  color: 'bg-red-100 text-red-800' },
  payment_recorded:         { label: 'Rejestracja wpłaty',   color: 'bg-emerald-100 text-emerald-800' },
  payment_amount_changed:   { label: 'Zmiana kwoty',         color: 'bg-amber-100 text-amber-800' },
  payment_status_changed:   { label: 'Zmiana statusu wpłaty', color: 'bg-amber-100 text-amber-800' },
  contracts_removed:        { label: 'Usunięcie umów',       color: 'bg-red-100 text-red-800' },
  message_created:          { label: 'Nowa wiadomość',       color: 'bg-blue-100 text-blue-800' },
  message_updated:          { label: 'Edycja wiadomości',    color: 'bg-blue-100 text-blue-800' },
  message_deleted:          { label: 'Usunięcie wiadomości', color: 'bg-red-100 text-red-800' },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function str(val: unknown): string {
  return val != null ? String(val) : '';
}

function ActionBadge({ type }: { type: string }) {
  const a = ACTION_LABELS[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${a.color}`}>
      {a.label}
    </span>
  );
}

function renderDetails(details: Record<string, unknown> | null, actionType: string) {
  if (!details) return <span className="text-gray-400 text-xs">—</span>;
  const d = details as Record<string, string | number | boolean | null | undefined>;

  if (actionType === 'contract_accepted') {
    return (
      <div className="text-xs text-gray-600">
        {d.participantName ? <p className="font-medium text-gray-800">{str(d.participantName)}</p> : null}
        {d.tripTitle ? <p className="text-gray-500">{str(d.tripTitle)}</p> : null}
        {d.contractNumber ? <p className="text-gray-400 font-mono">#{str(d.contractNumber)}</p> : null}
      </div>
    );
  }
  if (actionType === 'profile_updated') {
    const fields = Array.isArray(details.fields) ? (details.fields as unknown[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => (
          <span key={str(f)} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{str(f)}</span>
        ))}
      </div>
    );
  }
  if (actionType === 'registration_created' || actionType === 'registration_cancelled') {
    return (
      <div className="text-xs text-gray-600">
        {d.participantName ? <p className="font-medium text-gray-800">{str(d.participantName)}</p> : null}
        {d.tripTitle ? <p className="text-gray-500">{str(d.tripTitle)}</p> : null}
      </div>
    );
  }
  if (actionType === 'payment_recorded' || actionType === 'payment_amount_changed' || actionType === 'payment_status_changed' || actionType === 'payment_deleted') {
    return (
      <div className="text-xs text-gray-600">
        {d.participantName ? <p className="font-medium text-gray-800">{str(d.participantName)}</p> : null}
        {d.tripTitle ? <p className="text-gray-500">{str(d.tripTitle)}</p> : null}
        {d.amount != null ? <p className="text-gray-500">Kwota: {str(d.amount)} {str(d.currency ?? '')}</p> : null}
        {d.oldStatus && d.newStatus ? <p className="text-gray-400">{str(d.oldStatus)} → {str(d.newStatus)}</p> : null}
      </div>
    );
  }
  if (actionType === 'message_created' || actionType === 'message_updated' || actionType === 'message_deleted') {
    return (
      <div className="text-xs text-gray-600">
        {d.title ? <p className="font-medium text-gray-800 truncate max-w-[280px]">{str(d.title)}</p> : null}
      </div>
    );
  }
  if (actionType === 'contracts_removed') {
    return (
      <div className="text-xs text-gray-600">
        {d.count != null ? <p className="text-gray-700">Usunięto: {str(d.count)}</p> : null}
        {d.tripTitle ? <p className="text-gray-500">{str(d.tripTitle)}</p> : null}
      </div>
    );
  }
  if (actionType === 'trip_email_sent') {
    return (
      <div className="text-xs text-gray-600">
        {d.tripTitle ? <p className="font-medium text-gray-800">{str(d.tripTitle)}</p> : null}
        {d.sent !== undefined ? (
          <p className="text-gray-500">Wysłano: {str(d.sent)} · Błędy: {str(d.skipped ?? 0)}</p>
        ) : null}
      </div>
    );
  }
  return <span className="text-xs text-gray-400">—</span>;
}

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(rows: ActivityLog[]) {
  const header = ['Data i czas', 'Użytkownik', 'Typ zdarzenia', 'Etykieta', 'Szczegóły'];
  const lines = [header.map(escapeCsv).join(',')];
  for (const r of rows) {
    const label = ACTION_LABELS[r.action_type]?.label ?? r.action_type;
    lines.push([
      formatDateTime(r.created_at),
      r.user_email ?? '',
      r.action_type,
      label,
      r.details ? JSON.stringify(r.details) : '',
    ].map(escapeCsv).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logi-aktywnosci-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ActivityLogsPanel({ logs }: { logs: ActivityLog[] }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const availableActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action_type));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    return logs.filter((l) => {
      if (actionFilter && l.action_type !== actionFilter) return false;
      const t = new Date(l.created_at).getTime();
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      if (q) {
        const hay = `${l.user_email ?? ''} ${l.action_type} ${JSON.stringify(l.details ?? {})}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, dateFrom, dateTo]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2">
        <Activity className="h-8 w-8" />
        <p className="text-sm">Brak zdarzeń z ostatnich 30 dni.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50/50 border-b border-gray-100">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj (e-mail, nazwa, treść...)"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        >
          <option value="">Wszystkie zdarzenia</option>
          {availableActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <button
          type="button"
          onClick={() => downloadCsv(filtered)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">Data i czas</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Użytkownik</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Zdarzenie</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Szczegóły</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap font-mono">
                  {formatDateTime(entry.created_at)}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600">
                  {entry.user_email ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <ActionBadge type={entry.action_type} />
                </td>
                <td className="px-4 py-2.5">
                  {renderDetails(entry.details, entry.action_type)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">
                  Brak wyników dla wybranych filtrów.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-400">
        Pokazano {filtered.length} z {logs.length} zdarzeń.
      </div>
    </>
  );
}
