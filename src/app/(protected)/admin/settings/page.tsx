export const dynamic = 'force-dynamic';

import { Activity, Mail, ChevronDown, UserPlus, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { getActivityLogs, getEmailLogs } from '@/lib/actions/activity-logs';
import { ParentAccountsManager } from './parent-accounts-manager';
import { SyncJwtRolesButton } from './sync-jwt-roles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  contract_accepted:      { label: 'Akceptacja umowy',  color: 'bg-green-100 text-green-800' },
  profile_updated:        { label: 'Zmiana profilu',    color: 'bg-blue-600 text-blue-800' },
  registration_created:   { label: 'Zapis na wyjazd',   color: 'bg-purple-100 text-purple-800' },
  registration_cancelled: { label: 'Anulowanie zapisu', color: 'bg-red-100 text-red-800' },
  trip_email_sent:        { label: 'Wysłanie maili',    color: 'bg-amber-100 text-amber-800' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  welcome:           'Witamy',
  registration:      'Potwierdzenie zapisu',
  payment_confirmed: 'Płatność przyjęta',
  payment_reminder:  'Przypomnienie o płatności',
  trip_info:         'Informacja o wyjeździe',
};

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
  if (actionType === 'registration_created') {
    return (
      <div className="text-xs text-gray-600">
        {d.participantName ? <p className="font-medium text-gray-800">{str(d.participantName)}</p> : null}
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const [activityLogs, emailLogs] = await Promise.all([
    getActivityLogs(30),
    getEmailLogs(30),
  ]);

  return (
    <div className="space-y-3 max-w-4xl">
      <PageHeader
        title="Ustawienia"
        description="Konfiguracja aplikacji, logi i narzędzia administracyjne"
      />

      {/* ── Konta rodziców ────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <UserPlus className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Konta rodziców</p>
              <p className="text-xs text-gray-500">Twórz i resetuj hasła kont logowania rodziców</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <ParentAccountsManager />
        </div>
      </details>

      {/* ── Synchronizacja ról JWT ────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Synchronizacja ról JWT</p>
              <p className="text-xs text-gray-500">Zapisz role użytkowników w tokenach JWT</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <SyncJwtRolesButton />
        </div>
      </details>

      {/* ── Logi aktywności ───────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Logi aktywności</p>
              <p className="text-xs text-gray-500">Zdarzenia rodziców z ostatnich 30 dni · {activityLogs.length} wpisów</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>

        <div className="border-t border-gray-100">
          {activityLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2">
              <Activity className="h-8 w-8" />
              <p className="text-sm">Brak zdarzeń z ostatnich 30 dni.</p>
            </div>
          ) : (
            <>
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
                    {activityLogs.map((entry) => (
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
                          {renderDetails(entry.details as Record<string, unknown> | null, entry.action_type)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-400">
                Pokazano {activityLogs.length} zdarzeń z ostatnich 30 dni.
              </div>
            </>
          )}
        </div>
      </details>

      {/* ── Logi e-maili ──────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Logi e-maili</p>
              <p className="text-xs text-gray-500">Wysłane wiadomości z ostatnich 30 dni · {emailLogs.length} maili</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>

        <div className="border-t border-gray-100">
          {emailLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2">
              <Mail className="h-8 w-8" />
              <p className="text-sm">Brak wysłanych maili z ostatnich 30 dni.</p>
            </div>
          ) : (
            <>
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
                    {emailLogs.map((entry) => (
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
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-400">
                Pokazano {emailLogs.length} maili z ostatnich 30 dni.
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
