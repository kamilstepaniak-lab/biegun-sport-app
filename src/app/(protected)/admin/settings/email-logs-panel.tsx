'use client';

import { useMemo, useState } from 'react';
import { Mail, Download, Search } from 'lucide-react';

type EmailLog = {
  id: string;
  sent_at: string;
  to_email: string;
  subject: string;
  template_id: string | null;
};

type QueueLog = {
  id: string;
  created_at: string;
  scheduled_at: string;
  sent_at: string | null;
  to_email: string;
  recipient_name: string | null;
  subject: string;
  template_id: string | null;
  source_type: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
};

const TEMPLATE_LABELS: Record<string, string> = {
  welcome:           'Witamy',
  registration:      'Potwierdzenie zapisu',
  payment_confirmed: 'Płatność przyjęta',
  payment_reminder:  'Przypomnienie o płatności',
  trip_info:         'Informacja o wyjeździe',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'W kolejce',
  sending: 'Wysyłanie',
  sent: 'Wysłano',
  failed: 'Błąd',
  bounced: 'Zwrotka',
  cancelled: 'Anulowano',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(rows: EmailLog[]) {
  const header = ['Data i czas', 'Do (e-mail)', 'Temat', 'Szablon'];
  const lines = [header.map(escapeCsv).join(',')];
  for (const r of rows) {
    lines.push([
      formatDateTime(r.sent_at),
      r.to_email,
      r.subject,
      r.template_id ? (TEMPLATE_LABELS[r.template_id] ?? r.template_id) : '',
    ].map(escapeCsv).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logi-maili-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function EmailLogsPanel({ logs, queueLogs = [] }: { logs: EmailLog[]; queueLogs?: QueueLog[] }) {
  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const availableTemplates = useMemo(() => {
    const set = new Set(logs.map((l) => l.template_id).filter((t): t is string => !!t));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    return logs.filter((l) => {
      if (templateFilter && l.template_id !== templateFilter) return false;
      const t = new Date(l.sent_at).getTime();
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      if (q) {
        const hay = `${l.to_email} ${l.subject}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, templateFilter, dateFrom, dateTo]);

  if (logs.length === 0 && queueLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2">
        <Mail className="h-8 w-8" />
        <p className="text-sm">Brak wysłanych maili z ostatnich 30 dni.</p>
      </div>
    );
  }

  return (
    <>
      {queueLogs.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-4 py-3 bg-blue-50/50">
            <p className="text-xs font-semibold text-blue-900">Kolejka systemowych e-maili</p>
            <p className="text-xs text-blue-700">Status techniczny: do kogo system ma wysłać, co już przyjął Gmail i gdzie są błędy.</p>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Utworzono</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Do</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Temat</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Szablon</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Status</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Próby</th>
                  <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Błąd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {queueLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap font-mono">{formatDateTime(entry.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-gray-700">{entry.recipient_name ?? entry.to_email}</div>
                      <div className="text-xs text-gray-400">{entry.to_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[260px] truncate">{entry.subject}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{entry.template_id ? (TEMPLATE_LABELS[entry.template_id] ?? entry.template_id) : entry.source_type}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{entry.attempt_count}</td>
                    <td className="px-4 py-2.5 text-xs text-red-600 max-w-[220px] truncate">{entry.last_error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50/50 border-b border-gray-100">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj (e-mail, temat)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        >
          <option value="">Wszystkie szablony</option>
          {availableTemplates.map((t) => (
            <option key={t} value={t}>{TEMPLATE_LABELS[t] ?? t}</option>
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
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Do (e-mail)</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Temat</th>
              <th className="px-4 py-2.5 font-medium text-gray-500 text-xs">Szablon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap font-mono">
                  {formatDateTime(entry.sent_at)}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700 font-medium">
                  {entry.to_email}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[260px] truncate">
                  {entry.subject}
                </td>
                <td className="px-4 py-2.5">
                  {entry.template_id ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                      {TEMPLATE_LABELS[entry.template_id] ?? entry.template_id}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
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
        Pokazano {filtered.length} z {logs.length} maili.
      </div>
    </>
  );
}
