export const dynamic = 'force-dynamic';

import { Activity, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { getActivityLogs, getEmailLogs } from '@/lib/actions/activity-logs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  contract_accepted:    { label: 'Akceptacja umowy',    color: 'bg-green-100 text-green-800' },
  profile_updated:      { label: 'Zmiana profilu',      color: 'bg-blue-100 text-blue-800' },
  registration_created: { label: 'Zapis na wyjazd',     color: 'bg-purple-100 text-purple-800' },
  registration_cancelled: { label: 'Anulowanie zapisu', color: 'bg-red-100 text-red-800' },
  trip_email_sent:      { label: 'Wysłanie maili',      color: 'bg-amber-100 text-amber-800' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  welcome:           'Witamy',
  registration:      'Potwierdzenie zapisu',
  payment_confirmed: 'Płatność przyjęta',
  payment_reminder:  'Przypomnienie o płatności',
  trip_info:         'Informacja o wyjeździe',
};

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

  if (actionType === 'contract_accepted') {
    return (
      <div className="text-xs text-gray-600">
        {details.participantName && <p className="font-medium text-gray-800">{String(details.participantName)}</p>}
        {details.tripTitle && <p className="text-gray-500">{String(details.tripTitle)}</p>}
        {details.contractNumber && <p className="text-gray-400 font-mono">#{details.contractNumber}</p>}
      </div>
    );
  }

  if (actionType === 'profile_updated') {
    const fields = Array.isArray(details.fields) ? details.fields : [];
    return (
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => (
          <span key={String(f)} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {String(f)}
          </span>
        ))}
      </div>
    );
  }

  if (actionType === 'registration_created') {
    return (
      <div className="text-xs text-gray-600">
        {details.participantName && <p className="font-medium text-gray-800">{String(details.participantName)}</p>}
        {details.tripTitle && <p className="text-gray-500">{String(details.tripTitle)}</p>}
      </div>
    );
  }

  if (actionType === 'trip_email_sent') {
    return (
      <div className="text-xs text-gray-600">
        {details.tripTitle && <p className="font-medium text-gray-800">{String(details.tripTitle)}</p>}
        {details.sent !== undefined && (
          <p className="text-gray-500">Wysłano: {String(details.sent)} · Błędy: {String(details.skipped ?? 0)}</p>
        )}
      </div>
    );
  }

  return <span className="text-xs text-gray-400">—</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === 'email' ? 'email' : 'activity';

  const [activityLogs, emailLogs] = await Promise.all([
    getActivityLogs(30),
    getEmailLogs(30),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logi systemowe"
        description="Historia zdarzeń i wysłanych maili z ostatnich 30 dni."
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <a
          href="/admin/logs?tab=activity"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'activity'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="h-4 w-4" />
          Aktywność
          <span className="ml-1 text-xs text-gray-400">({activityLogs.length})</span>
        </a>
        <a
          href="/admin/logs?tab=email"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'email'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail className="h-4 w-4" />
          Wysłane maile
          <span className="ml-1 text-xs text-gray-400">({emailLogs.length})</span>
        </a>
      </div>

      {/* ── TAB: Aktywność ── */}
      {activeTab === 'activity' && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          {activityLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
              <Activity className="h-10 w-10" />
              <p className="text-sm">Brak zdarzeń z ostatnich 30 dni.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Data i czas</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Użytkownik</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Zdarzenie</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Szczegóły</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activityLogs.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {entry.user_email ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge type={entry.action_type} />
                        </td>
                        <td className="px-4 py-3">
                          {renderDetails(entry.details as Record<string, unknown> | null, entry.action_type)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400">
                Pokazano {activityLogs.length} zdarzeń z ostatnich 30 dni.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Maile ── */}
      {activeTab === 'email' && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          {emailLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
              <Mail className="h-10 w-10" />
              <p className="text-sm">Brak wysłanych maili z ostatnich 30 dni.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Data i czas</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Do (e-mail)</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Temat</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Szablon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {emailLogs.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {formatDateTime(entry.sent_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                          {entry.to_email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[300px] truncate">
                          {entry.subject}
                        </td>
                        <td className="px-4 py-3">
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
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-400">
                Pokazano {emailLogs.length} maili z ostatnich 30 dni.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
